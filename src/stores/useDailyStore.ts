import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { DailyRecommendation, DailyRecommendationListItem } from '../types';

interface DailyListResponse {
  items: DailyRecommendationListItem[];
  total: number;
}

interface DailyStore {
  recommendations: DailyRecommendationListItem[];
  totalRecommendations: number;
  currentRecommendation: DailyRecommendation | null;
  loading: boolean;
  fetchRecommendations: (page: number, pageSize: number, month?: string) => Promise<void>;
  fetchRecommendationById: (date: string) => Promise<DailyRecommendation | null>;
}

export const useDailyStore = create<DailyStore>((set) => ({
  recommendations: [],
  totalRecommendations: 0,
  currentRecommendation: null,
  loading: false,

  fetchRecommendations: async (page, pageSize, month) => {
    set({ loading: true });
    try {
      const response = await invoke<DailyListResponse>('daily_list', {
        page,
        pageSize,
        month: month || null,
      });
      set({ recommendations: response.items, totalRecommendations: response.total });
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      set({ recommendations: [] });
    } finally {
      set({ loading: false });
    }
  },

  fetchRecommendationById: async (date) => {
    set({ loading: true });
    try {
      const response = await invoke<DailyRecommendation>('daily_detail', { date });
      set({ currentRecommendation: response });
      return response;
    } catch (error) {
      console.error('Failed to fetch recommendation:', error);
      set({ currentRecommendation: null });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));