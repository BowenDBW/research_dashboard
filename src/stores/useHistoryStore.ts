import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { HistoryRecord, HistoryFilters, StatsData } from '../types';

interface HistoryListResponse {
  records: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: HistoryFilters;
  loading: boolean;
  fetchRecords: (page: number, pageSize: number, filters: HistoryFilters) => Promise<void>;
  updateFilters: (newFilters: Partial<HistoryFilters>) => void;
  updatePage: (newPage: number) => void;
  setPageSize: (size: number) => void;
  logAction: (articleId: string, actionType: string) => Promise<void>;
  deleteRecentAction: (articleId: string, actionType: string) => Promise<void>;
  fetchStatsData: (startDate: string, endDate: string) => Promise<StatsData | null>;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  records: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {
    dateRange: [null, null],
    actions: [],
  },
  loading: false,

  fetchRecords: async (page, pageSize, filters) => {
    set({ loading: true });
    try {
      const response = await invoke<HistoryListResponse>('history_reading', {
        page,
        pageSize,
        startDate: filters.dateRange[0] || null,
        endDate: filters.dateRange[1] || null,
        actions: filters.actions.length > 0 ? filters.actions : null,
      });
      set({ records: response.records, totalCount: response.total });
    } catch (error) {
      console.error('Failed to fetch history:', error);
      set({ records: [], totalCount: 0 });
    } finally {
      set({ loading: false });
    }
  },

  updateFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1,
    }));
  },

  updatePage: (newPage) => {
    set({ page: newPage });
  },

  setPageSize: (size) => {
    set({ pageSize: size });
  },

  logAction: async (articleId, actionType) => {
    try {
      await invoke('history_log', { articleId: parseInt(articleId), actionType });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  },

  deleteRecentAction: async (articleId, actionType) => {
    try {
      await invoke('history_delete_recent', { articleId: parseInt(articleId), actionType });
    } catch (error) {
      console.error('Failed to delete action:', error);
    }
  },

  fetchStatsData: async (startDate, endDate) => {
    try {
      return await invoke<StatsData>('stats_get', { startDate, endDate });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return null;
    }
  },
}));