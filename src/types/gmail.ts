import { Article } from './article';

/** Gmail configuration in settings */
export interface GmailConfig {
  email: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  syncIntervalHours: number;
  lastSyncTime?: string;
  /** Email recorded at authorize time; used to detect when the email field no longer matches the authorized account */
  authorizedEmail?: string;
}

/** Gmail OAuth authorization status */
export interface GmailAuthStatus {
  authorized: boolean;
  email: string;
}

/** Gmail sync progress / status (mirrors backend GmailSyncStatusResponse) */
export interface GmailSyncProgress {
  running: boolean;
  totalEmails: number;
  processed: number;
  totalArticles: number;
  errors: string[];
  message: string;
}

/** Gmail recommendation list item (grouped by date) */
export interface GmailRecommendationListItem {
  id: string;
  date: string;
  articleCount: number;
}

/** Gmail recommendation list response */
export interface GmailRecommendationListResponse {
  items: GmailRecommendationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Gmail recommendation entry (one paper from one email) */
export interface GmailRecommendationEntry {
  id: number;
  gmailMessageId: string;
  articleId: number | null;
  scholarName: string;
  recommendedAt: string;
  senderEmail: string | null;
  subject: string | null;
  articleTitle: string;
  articleUrl: string | null;
  articleAuthors: string | null;
  createdAt: string | null;
  rawJson: string | null;
  /** Joined paper data, if article_id is set */
  paper: Article | null;
}

/** Gmail recommendation detail for a specific date */
export interface GmailRecommendationDetail {
  id: string;
  date: string;
  articleCount: number;
  entries: GmailRecommendationEntry[];
  createdAt: string;
}