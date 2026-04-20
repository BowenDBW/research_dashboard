import { Article } from './article';

export interface HistoryRecord {
  id: string;
  articleId: string;
  article: Article;
  action: 'view_abstract' | 'view_source' | 'favorite' | 'download';
  timestamp: string;
}

export interface HistoryFilters {
  dateRange: [string | null, string | null];
  actions: string[];
}