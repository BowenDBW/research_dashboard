import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { DailyRecommendation, DailyRecommendationListItem } from '../types';
import { Article } from '../types/article';

// Backend response types (match Rust models)
interface BackendDailyRecommendationItem {
  id: number;
  date: string;
  article_count: number;
}

interface BackendDailyRecommendationDetail {
  id: number;
  date: string;
  article_count: number;
  articles: BackendPaper[];
  created_at: string | null;
}

interface BackendDailyListResponse {
  items: BackendDailyRecommendationItem[];
  total: number;
  page: number;
  page_size: number;
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

// Convert backend item to frontend DailyRecommendationListItem
function itemToListItem(item: BackendDailyRecommendationItem): DailyRecommendationListItem {
  return {
    id: String(item.id),
    date: item.date,
    articleCount: item.article_count,
  };
}

// Convert backend detail to frontend DailyRecommendation
function detailToRecommendation(detail: BackendDailyRecommendationDetail): DailyRecommendation {
  return {
    id: String(detail.id),
    date: detail.date,
    articleCount: detail.article_count,
    articles: detail.articles.map(paperToArticle),
    createdAt: detail.created_at || `${detail.date}T00:00:00`,
    updatedAt: detail.created_at || `${detail.date}T00:00:00`,
  };
}

interface DailyStore {
  recommendations: DailyRecommendationListItem[];
  currentRecommendation: DailyRecommendation | null;
  loading: boolean;
  totalRecommendations: number;

  // Actions
  fetchRecommendations: (page: number, pageSize: number, searchMonth?: string) => Promise<void>;
  fetchRecommendationById: (id: string) => Promise<DailyRecommendation | null>;
  getRecentRecommendations: () => DailyRecommendationListItem[];
}

export const useDailyStore = create<DailyStore>((set, get) => ({
  recommendations: [],
  currentRecommendation: null,
  loading: false,
  totalRecommendations: 0,

  fetchRecommendations: async (page: number, pageSize: number, searchMonth?: string) => {
    set({ loading: true });
    try {
      const response = await invoke<BackendDailyListResponse>('daily_list', {
        page,
        pageSize,
        month: searchMonth || null,
      });

      const recommendations = response.items.map(itemToListItem);

      set({
        recommendations,
        totalRecommendations: response.total,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      set({ recommendations: [], totalRecommendations: 0, loading: false });
    }
  },

  fetchRecommendationById: async (id: string) => {
    // id is the date string (YYYY-MM-DD format)
    set({ loading: true });
    try {
      const response = await invoke<BackendDailyRecommendationDetail>('daily_detail', {
        date: id,
      });

      const recommendation = detailToRecommendation(response);
      set({ currentRecommendation: recommendation, loading: false });
      return recommendation;
    } catch (error) {
      console.error('Failed to fetch recommendation detail:', error);
      set({ currentRecommendation: null, loading: false });
      return null;
    }
  },

  getRecentRecommendations: () => {
    // This returns the cached recommendations from state
    // For real data, call fetchRecommendations first
    return get().recommendations.slice(0, 5);
  },
}));