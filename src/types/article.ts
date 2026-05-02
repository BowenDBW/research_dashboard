export interface VenueRanking {
  id: number;
  venueId: number;
  rankingSource: string;
  rankingCategory: string | null;
  rankingYear: number | null;
  categoryDetail: string | null;
}

export interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;           // Venue display name (abbreviation or name)
  sourceType: string;
  publishDate: string;
  abstract: string;
  url: string;              // Publication link (文章信息页网址)
  pdfUrl: string;
  pdfPath?: string;         // Local PDF path
  preprintNumber?: string;  // arXiv编号等预印本编号
  venueId?: number;         // Venue ID from database
  venueName?: string;       // Venue full name
  venueAbbreviation?: string; // Venue abbreviation
  venueType?: string;       // 'journal' | 'conference'
  rankings?: VenueRanking[]; // Venue分区信息
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