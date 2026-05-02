import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Article, ArticleFilters, PaginatedArticles } from '../types';

// Backend response types (match Rust models)
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

interface BackendPaperListResponse {
  articles: BackendPaper[];
  total: number;
  page: number;
  page_size: number;
}

interface BackendPaperQueryParams {
  page: number;
  page_size: number;
  query: string | null;
  start_date: string | null;
  end_date: string | null;
  sources: string[] | null;
  domains: string[] | null;
  subscribed_only: boolean;
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

interface ArticleStore {
  articles: Article[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: ArticleFilters;
  sources: string[];
  domains: string[];
  loading: boolean;
  subscribedOnly: boolean;
  setFilters: (filters: Partial<ArticleFilters>) => void;
  fetchArticles: () => Promise<void>;
  fetchSources: () => Promise<void>;
  fetchDomains: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSubscribedOnly: (value: boolean) => void;
}

export const useArticleStore = create<ArticleStore>((set, get) => ({
  articles: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {
    dateRange: [null, null],
    sources: [],
    author: '',
    domains: [],
  },
  sources: [],
  domains: [],
  loading: false,
  subscribedOnly: false,

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  fetchArticles: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize, subscribedOnly } = get();

      const params: BackendPaperQueryParams = {
        page,
        page_size: pageSize,
        query: filters.author || null,
        start_date: filters.dateRange[0] || null,
        end_date: filters.dateRange[1] || null,
        sources: filters.sources.length > 0 ? filters.sources : null,
        domains: filters.domains.length > 0 ? filters.domains : null,
        subscribed_only: subscribedOnly,
      };

      const response = await invoke<BackendPaperListResponse>('papers_list', { params });

      const articles = response.articles.map(paperToArticle);

      set({
        articles,
        totalCount: response.total,
        page: response.page,
        pageSize: response.page_size,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      set({ loading: false, articles: [], totalCount: 0 });
    }
  },

  fetchSources: async () => {
    try {
      const sources = await invoke<string[]>('papers_sources');
      set({ sources });
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      set({ sources: [] });
    }
  },

  fetchDomains: async () => {
    try {
      const domains = await invoke<string[]>('papers_domains');
      set({ domains });
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      set({ domains: [] });
    }
  },

  setPage: (page) => set({ page }),
  setPageSize: (size) => set({ pageSize: size, page: 1 }),
  setSubscribedOnly: (value) => set({ subscribedOnly: value }),
}));