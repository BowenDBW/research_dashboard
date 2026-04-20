export interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;
  sourceType: string;
  publishDate: string;
  abstract: string;
  url: string;
  pdfUrl: string;
  domains: string[];
  isFavorited: boolean;
  metadata: Record<string, unknown>;
}

export interface PaginatedArticles {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArticleFilters {
  dateRange: [string | null, string | null];
  sources: string[];
  author: string;
  domains: string[];
}