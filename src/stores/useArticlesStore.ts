import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Article } from '../types';

interface PaperListResponse {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

interface VenueRanking {
  id: number;
  venueId: number;
  rankingSource: string;
  rankingCategory: string | null;
}

interface VenueSearchResult {
  venueId: number;
  name: string;
  abbreviation?: string;
  venueType?: string;
  rankings?: VenueRanking[];
}

interface ArticlesStore {
  articles: Article[];
  totalCount: number;
  loading: boolean;
  fetchArticles: (params: {
    page: number;
    pageSize: number;
    query?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sources?: string[] | null;
    domains?: string[] | null;
    subscribedOnly?: boolean;
  }) => Promise<void>;
  fetchSources: () => Promise<string[]>;
  fetchDomains: () => Promise<string[]>;
  searchVenues: (query: string, limit?: number) => Promise<VenueSearchResult[]>;
}

export const useArticlesStore = create<ArticlesStore>((set) => ({
  articles: [],
  totalCount: 0,
  loading: false,

  fetchArticles: async (params) => {
    set({ loading: true });
    try {
      const response = await invoke<PaperListResponse>('papers_list', params);
      set({ articles: response.articles, totalCount: response.total });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      set({ articles: [], totalCount: 0 });
    } finally {
      set({ loading: false });
    }
  },

  fetchSources: async () => {
    try {
      return await invoke<string[]>('papers_sources');
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      return [];
    }
  },

  fetchDomains: async () => {
    try {
      return await invoke<string[]>('papers_domains');
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      return [];
    }
  },

  searchVenues: async (query, limit = 20) => {
    if (!query || query.length < 1) return [];
    try {
      return await invoke<VenueSearchResult[]>('papers_search_venue', { name: query, limit });
    } catch (error) {
      console.error('Failed to search venues:', error);
      return [];
    }
  },
}));