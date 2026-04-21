export type ChatMode = 'chat' | 'paper_search' | 'chapter_summary';

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
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
}

export interface ChatContext {
  articleId?: string;
  dateRange?: [string, string];
}