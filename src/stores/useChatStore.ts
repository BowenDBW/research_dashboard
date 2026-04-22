import { create } from 'zustand';
import { ChatSession, ChatMessage, ChatMode } from '../types';

// Generate mock chat sessions with messages
const generateMockSessions = (): { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> } => {
  const now = Date.now();
  const mockSessions: ChatSession[] = [
    {
      id: 'session-1',
      title: '关于 Transformer 架构的讨论',
      mode: 'chat',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    },
    {
      id: 'session-2',
      title: '搜索注意力机制相关论文',
      mode: 'paper_search',
      createdAt: new Date(now - 86400000).toISOString(),
      updatedAt: new Date(now - 86400000).toISOString(),
    },
    {
      id: 'session-3',
      title: 'Attention Is All You Need 总结',
      mode: 'chapter_summary',
      articleId: '1',
      articleTitle: 'Attention Is All You Need',
      createdAt: new Date(now - 172800000).toISOString(),
      updatedAt: new Date(now - 172800000).toISOString(),
    },
    {
      id: 'session-4',
      title: 'BERT 模型原理解析',
      mode: 'chat',
      createdAt: new Date(now - 259200000).toISOString(),
      updatedAt: new Date(now - 259200000).toISOString(),
    },
    {
      id: 'session-5',
      title: '搜索 GPT 系列论文',
      mode: 'paper_search',
      createdAt: new Date(now - 345600000).toISOString(),
      updatedAt: new Date(now - 345600000).toISOString(),
    },
  ];

  const mockMessages: Record<string, ChatMessage[]> = {
    'session-1': [
      { id: 'm1-1', sessionId: 'session-1', role: 'user', content: '请解释一下 Transformer 架构的核心思想', timestamp: new Date(now).toISOString() },
      { id: 'm1-2', sessionId: 'session-1', role: 'assistant', content: 'Transformer 的核心思想是自注意力机制（Self-Attention）...', timestamp: new Date(now).toISOString() },
      { id: 'm1-3', sessionId: 'session-1', role: 'user', content: '自注意力机制是如何计算的？', timestamp: new Date(now).toISOString() },
      { id: 'm1-4', sessionId: 'session-1', role: 'assistant', content: '自注意力机制通过 Query、Key、Value 三个矩阵来计算...', timestamp: new Date(now).toISOString() },
    ],
    'session-2': [
      { id: 'm2-1', sessionId: 'session-2', role: 'user', content: '搜索关于注意力机制的最新论文', timestamp: new Date(now - 86400000).toISOString() },
      { id: 'm2-2', sessionId: 'session-2', role: 'assistant', content: '找到了以下相关论文：\n1. Efficient Attention...\n2. Linear Attention...', timestamp: new Date(now - 86400000).toISOString() },
    ],
    'session-3': [
      { id: 'm3-1', sessionId: 'session-3', role: 'user', content: '请总结这篇论文的主要贡献', timestamp: new Date(now - 172800000).toISOString() },
      { id: 'm3-2', sessionId: 'session-3', role: 'assistant', content: '这篇论文的主要贡献包括：\n1. 提出了 Transformer 架构...\n2. 引入了多头注意力机制...', timestamp: new Date(now - 172800000).toISOString() },
    ],
    'session-4': [
      { id: 'm4-1', sessionId: 'session-4', role: 'user', content: 'BERT 和 GPT 有什么区别？', timestamp: new Date(now - 259200000).toISOString() },
      { id: 'm4-2', sessionId: 'session-4', role: 'assistant', content: 'BERT 使用双向编码器，适合理解任务；GPT 使用单向解码器，适合生成任务...', timestamp: new Date(now - 259200000).toISOString() },
    ],
    'session-5': [
      { id: 'm5-1', sessionId: 'session-5', role: 'user', content: '搜索 GPT-4 相关论文', timestamp: new Date(now - 345600000).toISOString() },
      { id: 'm5-2', sessionId: 'session-5', role: 'assistant', content: '找到以下论文：\n1. GPT-4 Technical Report...', timestamp: new Date(now - 345600000).toISOString() },
    ],
  };

  return { sessions: mockSessions, messages: mockMessages };
};

const mockData = generateMockSessions();

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
  sessions: mockData.sessions,
  currentSessionId: null,
  messages: mockData.messages,

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