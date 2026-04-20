import { create } from 'zustand';
import { ChatSession, ChatMessage, ChatMode } from '../types';

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  createSession: (mode?: ChatMode) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, msg: ChatMessage) => void;
  appendStreamToken: (sessionId: string, token: string) => void;
  getCurrentMessages: () => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [
    {
      id: 'session-1',
      title: '关于 Transformer 的讨论',
      mode: 'chat',
      createdAt: '2024-01-10T10:00:00',
      updatedAt: '2024-01-10T10:30:00',
    },
    {
      id: 'session-2',
      title: '论文搜索：深度学习',
      mode: 'paper_search',
      createdAt: '2024-01-09T15:00:00',
      updatedAt: '2024-01-09T15:20:00',
    },
  ],
  currentSessionId: 'session-1',
  messages: {
    'session-1': [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '请解释一下 Transformer 的工作原理',
        timestamp: '2024-01-10T10:00:00',
      },
      {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Transformer 是一种基于自注意力机制的神经网络架构。它通过多头注意力机制来处理序列数据，能够并行计算，相比 RNN 更高效。',
        timestamp: '2024-01-10T10:01:00',
      },
    ],
    'session-2': [
      {
        id: 'msg-3',
        sessionId: 'session-2',
        role: 'user',
        content: '搜索关于深度学习的最新论文',
        timestamp: '2024-01-09T15:00:00',
      },
    ],
  },

  createSession: (mode = 'chat') => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: '新对话',
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), msg],
      },
    }));
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