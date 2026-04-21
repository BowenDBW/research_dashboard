import { create } from 'zustand';
import { ChatSession, ChatMessage, ChatMode } from '../types';

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  createSession: (mode?: ChatMode, articleInfo?: { articleId: string; articleTitle: string }) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, msg: ChatMessage) => void;
  appendStreamToken: (sessionId: string, token: string) => void;
  getCurrentMessages: () => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},

  createSession: (mode = 'chat', articleInfo?: { articleId: string; articleTitle: string }) => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: articleInfo ? `总结: ${articleInfo.articleTitle}` : '新对话',
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      articleId: articleInfo?.articleId,
      articleTitle: articleInfo?.articleTitle,
    };
    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: id,
      messages: { ...state.messages, [id]: [] },
    }));
    return id;
  },

  switchSession: (id) => {
    set({ currentSessionId: id });
  },

  deleteSession: (id) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      const newMessages = { ...state.messages };
      delete newMessages[id];

      // If deleting current session, switch to another one
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
  },

  addMessage: (sessionId, msg) => {
    set((state) => {
      // Update session's updatedAt timestamp
      const updatedSessions = state.sessions.map(s =>
        s.id === sessionId ? { ...s, updatedAt: new Date().toISOString() } : s
      );

      return {
        sessions: updatedSessions,
        messages: {
          ...state.messages,
          [sessionId]: [...(state.messages[sessionId] || []), msg],
        },
      };
    });
  },

  appendStreamToken: (sessionId, token) => {
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

  getCurrentMessages: () => {
    const { currentSessionId, messages } = get();
    return currentSessionId ? messages[currentSessionId] || [] : [];
  },
}));