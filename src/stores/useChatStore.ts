import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ChatSession, ChatMessage, ChatMode, SendMessageResponse } from '../types';

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  messagesLoading: boolean;
  sendingMessage: boolean;

  fetchSessions: (mode?: ChatMode, limit?: number) => Promise<void>;
  createSession: (mode?: ChatMode, articleInfo?: { articleId: string; articleTitle: string }) => Promise<string>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  fetchMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, messageOrContent: string | ChatMessage) => void;
  sendMessage: (sessionId: string, content: string, modelId: string) => Promise<void>;
  getCurrentMessages: () => ChatMessage[];
  updateSessionTitle: (sessionId: string, title: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  messagesLoading: false,
  sendingMessage: false,

  fetchSessions: async (mode?: ChatMode, limit?: number) => {
    try {
      const response = await invoke<ChatSession[]>('chat_get_sessions', {
        mode: mode || null,
        limit: limit || 20,
      });

      // Fetch messages for each session that might have messages
      const messagesData: Record<string, ChatMessage[]> = {};
      await Promise.all(
        response.map(async (session) => {
          try {
            const msgs = await invoke<ChatMessage[]>('chat_get_messages', {
              sessionId: parseInt(session.id),
            });
            if (msgs.length > 0) {
              messagesData[session.id] = msgs;
            }
          } catch (e) {
            console.error(`Failed to fetch messages for session ${session.id}:`, e);
          }
        })
      );

      // Update both sessions and messages at the same time to avoid race condition
      set({ sessions: response, messages: messagesData });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      set({ sessions: [] });
    }
  },

  createSession: async (mode: ChatMode = 'chat', articleInfo?: { articleId: string; articleTitle: string }) => {
    try {
      const response = await invoke<ChatSession>('chat_create_session', {
        mode,
        articleId: articleInfo ? parseInt(articleInfo.articleId) : null,
        title: articleInfo ? `总结: ${articleInfo.articleTitle}` : null,
      });
      set((state) => ({
        sessions: [response, ...state.sessions],
        currentSessionId: response.id,
        messages: { ...state.messages, [response.id]: [] },
      }));
      return response.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  switchSession: async (sessionId: string) => {
    set({ currentSessionId: sessionId, messagesLoading: true });
    try {
      const response = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });
      set((state) => ({
        messages: { ...state.messages, [sessionId]: response },
        messagesLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set((state) => ({
        messages: { ...state.messages, [sessionId]: [] },
        messagesLoading: false,
      }));
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await invoke('chat_delete_session', { sessionId: parseInt(sessionId) });
      set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== sessionId);
        const newMessages = { ...state.messages };
        delete newMessages[sessionId];
        return {
          sessions: newSessions,
          messages: newMessages,
          currentSessionId: state.currentSessionId === sessionId
            ? (newSessions.length > 0 ? newSessions[0].id : null)
            : state.currentSessionId,
        };
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  fetchMessages: async (sessionId: string) => {
    set({ messagesLoading: true });
    try {
      const response = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });
      set((state) => ({
        messages: { ...state.messages, [sessionId]: response },
        messagesLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set((state) => ({
        messages: { ...state.messages, [sessionId]: [] },
        messagesLoading: false,
      }));
    }
  },

  addMessage: (sessionId: string, messageOrContent: string | ChatMessage) => {
    const userMsg: ChatMessage = typeof messageOrContent === 'string'
      ? {
          id: `temp-user-${Date.now()}`,
          sessionId,
          role: 'user',
          content: messageOrContent,
          timestamp: new Date().toISOString(),
        }
      : messageOrContent;
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
      },
    }));
  },

  sendMessage: async (sessionId: string, content: string, modelId: string) => {
    // Immediately show user message in UI
    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMessage],
      },
      sendingMessage: true,
    }));

    try {
      // Call backend to send message (backend saves both user and assistant messages)
      const response = await invoke<SendMessageResponse>('chat_send_message', {
        sessionId: parseInt(sessionId),
        content,
        modelId,
      });

      // Fetch complete message list from backend
      const messagesResponse = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });

      // Update messages and potentially session title
      set((state) => {
        const newState: Partial<ChatStore> = {
          messages: { ...state.messages, [sessionId]: messagesResponse },
          sendingMessage: false,
        };

        // If backend generated a new title, update the session
        if (response.updatedSessionTitle) {
          newState.sessions = state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, title: response.updatedSessionTitle! }
              : s
          );
        }

        return newState;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the temp user message on error
      set((state) => ({
        messages: {
          ...state.messages,
          [sessionId]: (state.messages[sessionId] || []).filter(m => m.id !== userMessage.id),
        },
        sendingMessage: false,
      }));
      throw error;
    }
  },

  getCurrentMessages: () => {
    const { currentSessionId, messages } = get();
    return currentSessionId ? messages[currentSessionId] || [] : [];
  },

  updateSessionTitle: (sessionId: string, title: string) => {
    set((state) => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId ? { ...s, title } : s
      ),
    }));
  },
}));

// Set up event listener for session title updates from backend
let titleUpdateListener: UnlistenFn | null = null;

export async function initChatEventListeners() {
  if (titleUpdateListener) return; // Already initialized

  titleUpdateListener = await listen<{ sessionId: string; title: string }>(
    'session-title-updated',
    (event) => {
      useChatStore.getState().updateSessionTitle(event.payload.sessionId, event.payload.title);
    }
  );
}

// Export as useChat for backwards compatibility
export const useChat = useChatStore;