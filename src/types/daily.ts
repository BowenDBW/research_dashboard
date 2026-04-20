export interface DailyReport {
  id: string;
  date: string;           // YYYY-MM-DD format
  title: string;          // 日报标题
  summary: string;        // 精简摘要
  content: string;        // Markdown content
  articleCount: number;   // 包含文章数量
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportListItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  articleCount: number;
}
