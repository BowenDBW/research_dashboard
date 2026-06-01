import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { StatsData } from '../types/stats.ts';

interface StatsResponse {
  readingStats: StatsData['readingStats'];
  hourlyDistribution: StatsData['hourlyDistribution'];
  weeklyHourData: StatsData['weeklyHourData'];
  dailyHourData: StatsData['dailyHourData'];
  domainDistribution: StatsData['domainDistribution'];
  keywords: StatsData['keywords'];
  heatmapData: StatsData['heatmapData'];
}

interface TodayStatsResponse {
  todayCount: number;
  totalPaperCount: number;
  favoriteCount: number;
  chatCount: number;
}

interface StatsStore {
  statsData: StatsData | null;
  todayStats: TodayStatsResponse | null;
  loading: boolean;
  fetchStats: (startDate: string, endDate: string) => Promise<void>;
  fetchTodayStats: () => Promise<void>;
  fetchTrend: (days: number) => Promise<{ date: string; count: number }[]>;
}

export const useStatsStore = create<StatsStore>((set) => ({
  statsData: null,
  todayStats: null,
  loading: false,

  fetchStats: async (startDate, endDate) => {
    set({ loading: true });
    try {
      const response = await invoke<StatsResponse>('stats_get', { startDate, endDate });
      set({ statsData: response });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchTodayStats: async () => {
    try {
      const response = await invoke<TodayStatsResponse>('stats_today');
      set({ todayStats: response });
    } catch (error) {
      console.error('Failed to fetch today stats:', error);
    }
  },

  fetchTrend: async (days) => {
    try {
      return await invoke<{ date: string; count: number }[]>('stats_trend', { days });
    } catch (error) {
      console.error('Failed to fetch trend:', error);
      return [];
    }
  },
}));