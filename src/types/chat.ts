import { Article } from './article';

export type ChatMode = 'chat' | 'paper_search' | 'chapter_summary';

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
  /** 该会话的消息条数（后端返回，用于判断是否为空会话） */
  messageCount?: number;
  // Context for chapter_summary mode
  articleId?: string;
  articleTitle?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** 检索结果：该消息关联的文章列表（普通文本消息为空） */
  articles?: Article[];
}

export interface SendMessageResponse {
  message: ChatMessage;
  updatedSessionTitle?: string;
}

export interface ChatContext {
  articleId?: string;
  dateRange?: [string, string];
}