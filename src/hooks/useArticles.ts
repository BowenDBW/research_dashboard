import { useState, useCallback } from 'react';
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

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchArticles = useCallback(async (params: {
    page: number;
    pageSize: number;
    query?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sources?: string[] | null;
    domains?: string[] | null;
    subscribedOnly?: boolean;
  }) => {
    setLoading(true);
    try {
      const response = await invoke<PaperListResponse>('papers_list', params);
      setArticles(response.articles);
      setTotalCount(response.total);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticles([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      return await invoke<string[]>('papers_sources');
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      return [];
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      return await invoke<string[]>('papers_domains');
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      return [];
    }
  }, []);

  const searchVenues = useCallback(async (query: string, limit = 20): Promise<VenueSearchResult[]> => {
    if (!query || query.length < 1) return [];
    try {
      return await invoke<VenueSearchResult[]>('papers_search_venue', { name: query, limit });
    } catch (error) {
      console.error('Failed to search venues:', error);
      return [];
    }
  }, []);

  return {
    articles,
    totalCount,
    loading,
    fetchArticles,
    fetchSources,
    fetchDomains,
    searchVenues,
  };
}