import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ChatSession, ChatMessage, ChatMode } from '../types';

// Backend response types (match Rust models)
interface BackendChatSession {
  session_id: number;
  title: string | null;
  mode: string;
  article_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number | null;
}

interface BackendChatMessage {
  message_id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string | null;
}

interface CreateSessionRequest {
  mode: string;
  article_id: number | null;
  title: string | null;
}

// Convert backend session to frontend ChatSession
function sessionToFrontend(session: BackendChatSession): ChatSession {
  return {
    id: String(session.session_id),
    title: session.title || '新对话',
    mode: session.mode as ChatMode,
    createdAt: session.created_at || new Date().toISOString(),
    updatedAt: session.updated_at || new Date().toISOString(),
    articleId: session.article_id ? String(session.article_id) : undefined,
    articleTitle: undefined, // Backend doesn't store article title, need separate lookup if needed
  };
}

// Convert backend message to frontend ChatMessage
function messageToFrontend(msg: BackendChatMessage): ChatMessage {
  return {
    id: String(msg.message_id),
    sessionId: String(msg.session_id),
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: msg.created_at || new Date().toISOString(),
  };
}

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  loading: boolean;
  messagesLoading: boolean;

  // Session management
  fetchSessions: (mode?: ChatMode, limit?: number) => Promise<void>;
  createSession: (mode?: ChatMode, articleInfo?: { articleId: string; articleTitle: string }) => Promise<string>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // Message management
  fetchMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, content: string) => Promise<void>;
  getCurrentMessages: () => ChatMessage[];

  // Stream handling for assistant response
  appendStreamToken: (sessionId: string, token: string) => void;
  startAssistantMessage: (sessionId: string) => void;
  finalizeAssistantMessage: (sessionId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  loading: false,
  messagesLoading: false,

  fetchSessions: async (mode?: ChatMode, limit = 20) => {
    set({ loading: true });
    try {
      const response = await invoke<BackendChatSession[]>('chat_get_sessions', {
        mode: mode || null,
        limit,
      });

      const sessions = response.map(sessionToFrontend);

      set({ sessions, loading: false });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      set({ sessions: [], loading: false });
    }
  },

  createSession: async (mode = 'chat', articleInfo?: { articleId: string; articleTitle: string }) => {
    try {
      const request: CreateSessionRequest = {
        mode,
        article_id: articleInfo ? parseInt(articleInfo.articleId) : null,
        title: articleInfo ? `总结: ${articleInfo.articleTitle}` : null,
      };

      const response = await invoke<BackendChatSession>('chat_create_session', { req: request });

      const newSession = sessionToFrontend(response);
      const sessionId = newSession.id;

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSessionId: sessionId,
        messages: { ...state.messages, [sessionId]: [] },
      }));

      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  switchSession: async (id: string) => {
    set({ currentSessionId: id, messagesLoading: true });
    try {
      const response = await invoke<BackendChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(id),
      });

      const msgs = response.map(messageToFrontend);

      set((state) => ({
        messages: { ...state.messages, [id]: msgs },
        messagesLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set((state) => ({
        messages: { ...state.messages, [id]: [] },
        messagesLoading: false,
      }));
    }
  },

  deleteSession: async (id: string) => {
    try {
      await invoke('chat_delete_session', { sessionId: parseInt(id) });

      set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== id);
        const newMessages = { ...state.messages };
        delete newMessages[id];

        let newCurrentId = state.currentSessionId;
        if (state.currentSessionId === id) {
          newCurrentId = newSessions.length > 0 ? newSessions[0].id : null;
        }

        return {
          sessions: newSessions,
          messages: newMessages,
          currentSessionId: newCurrentId,
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
      const response = await invoke<BackendChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });

      const msgs = response.map(messageToFrontend);

      set((state) => ({
        messages: { ...state.messages, [sessionId]: msgs },
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

  addMessage: async (sessionId: string, content: string) => {
    // Add user message to state immediately
    const userMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
      },
    }));

    // Note: The actual message sending with AI response should be handled
    // in a separate component that deals with SSE streaming
    // This function just adds the user message to local state
  },

  appendStreamToken: (sessionId: string, token: string) => {
    set((state) => {
      const msgs = state.messages[sessionId] || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        return {
          messages: {
            ...state.messages,
            [sessionId]: [
              ...msgs.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + token },
            ],
          },
        };
      }
      return state;
    });
  },

  startAssistantMessage: (sessionId: string) => {
    const assistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      sessionId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), assistantMsg],
      },
    }));
  },

  finalizeAssistantMessage: (sessionId: string) => {
    // This can be used to finalize the assistant message after streaming ends
    // For now, the message is already in state from startAssistantMessage and appendStreamToken
  },

  getCurrentMessages: () => {
    const { currentSessionId, messages } = get();
    return currentSessionId ? messages[currentSessionId] || [] : [];
  },
}));