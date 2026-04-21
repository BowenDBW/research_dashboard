import { Article } from './article';

export interface DailyRecommendation {
  id: string;
  date: string;           // YYYY-MM-DD format
  articleCount: number;   // 推荐文章数量
  articles: Article[];    // 推荐的文章列表
  createdAt: string;
  updatedAt: string;
}

export interface DailyRecommendationListItem {
  id: string;
  date: string;
  articleCount: number;
}
