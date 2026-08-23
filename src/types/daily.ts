import { Article } from './article';

/** 一天内的一封来源邮件（Scholar Alert）及其推荐的文章 */
export interface DailyRecommendationGroup {
  /** 邮件标题（如 "2 new related researches to John"）；旧数据无邮件信息时为 "" */
  emailSubject: string;
  articles: Article[];
}

export interface DailyRecommendation {
  id: string;
  date: string;           // YYYY-MM-DD format
  articleCount: number;   // 推荐文章数量
  groups: DailyRecommendationGroup[]; // 按来源邮件分组的文章（邮件标题为组小标题）
  createdAt: string;
  updatedAt: string;
}

export interface DailyRecommendationListItem {
  id: string;
  date: string;
  articleCount: number;
}
