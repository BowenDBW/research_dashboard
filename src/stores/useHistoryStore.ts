import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { HistoryRecord, HistoryFilters, Article } from '../types';

// Backend response types (match Rust models)
interface BackendUserActionLog {
  log_id: number;
  article_id: number;
  action_type: string;
  created_at: string | null;
  article: BackendPaper | null;
}

interface BackendPaper {
  article_id: number;
  title: string;
  abstract_text: string | null;
  publication_date: string | null;
  preprint_number: string | null;
  publication_venue: string | null;
  publication_link: string | null;
  pdf_link: string | null;
  pdf_path: string | null;
  authors: string[] | null;
  categories: string[] | null;
  is_favorited: boolean | null;
}

interface BackendHistoryListResponse {
  records: BackendUserActionLog[];
  total: number;
  page: number;
  page_size: number;
}

interface BackendHistoryQueryParams {
  page: number;
  page_size: number;
  start_date: string | null;
  end_date: string | null;
  actions: string[] | null;
  modes: string[] | null;
}

// Convert backend paper to frontend Article
function paperToArticle(paper: BackendPaper): Article {
  return {
    id: String(paper.article_id),
    title: paper.title,
    authors: paper.authors || [],
    source: paper.publication_venue || 'arXiv',
    sourceType: paper.publication_venue?.toLowerCase() || 'arxiv',
    publishDate: paper.publication_date || '',
    abstract: paper.abstract_text || '',
    url: paper.publication_link || '',
    pdfUrl: paper.pdf_link || '',
    domains: paper.categories || [],
    isFavorited: paper.is_favorited || false,
    metadata: {},
  };
}

// Convert backend log to frontend HistoryRecord
function logToRecord(log: BackendUserActionLog): HistoryRecord {
  return {
    id: String(log.log_id),
    articleId: String(log.article_id),
    article: log.article ? paperToArticle(log.article) : {
      id: String(log.article_id),
      title: 'Unknown',
      authors: [],
      source: 'arXiv',
      sourceType: 'arxiv',
      publishDate: '',
      abstract: '',
      url: '',
      pdfUrl: '',
      domains: [],
      isFavorited: false,
      metadata: {},
    },
    action: log.action_type as HistoryRecord['action'],
    timestamp: log.created_at || new Date().toISOString(),
  };
}

interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: HistoryFilters;
  loading: boolean;

  // Fetch history records
  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  setPage: (page: number) => void;

  // Log action
  logAction: (articleId: string, actionType: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  records: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {
    dateRange: [null, null],
    actions: [],
  },
  loading: false,

  fetchRecords: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();

      const params: BackendHistoryQueryParams = {
        page,
        page_size: pageSize,
        start_date: filters.dateRange[0] || null,
        end_date: filters.dateRange[1] || null,
        actions: filters.actions.length > 0 ? filters.actions : null,
        modes: null,
      };

      const response = await invoke<BackendHistoryListResponse>('history_reading', { params });

      const records = response.records.map(logToRecord);

      set({
        records,
        totalCount: response.total,
        page: response.page,
        pageSize: response.page_size,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch history records:', error);
      set({ records: [], totalCount: 0, loading: false });
    }
  },

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  setPage: (page) => set({ page }),

  logAction: async (articleId: string, actionType: string) => {
    try {
      await invoke('history_log', {
        articleId: parseInt(articleId),
        actionType,
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  },
}));