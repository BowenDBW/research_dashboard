import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DailyRecommendation, DailyRecommendationListItem } from '../types';

interface DailyListResponse {
  items: DailyRecommendationListItem[];
  total: number;
}

export function useDaily() {
  const [recommendations, setRecommendations] = useState<DailyRecommendationListItem[]>([]);
  const [totalRecommendations, setTotalRecommendations] = useState(0);
  const [currentRecommendation, setCurrentRecommendation] = useState<DailyRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = useCallback(async (page: number, pageSize: number, month?: string) => {
    setLoading(true);
    try {
      const response = await invoke<DailyListResponse>('daily_list', {
        page,
        pageSize,
        month: month || null,
      });
      setRecommendations(response.items);
      setTotalRecommendations(response.total);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendationById = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const response = await invoke<DailyRecommendation>('daily_detail', { date });
      setCurrentRecommendation(response);
      return response;
    } catch (error) {
      console.error('Failed to fetch recommendation:', error);
      setCurrentRecommendation(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    recommendations,
    totalRecommendations,
    currentRecommendation,
    loading,
    fetchRecommendations,
    fetchRecommendationById,
  };
}