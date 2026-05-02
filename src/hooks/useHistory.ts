import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HistoryRecord, HistoryFilters, StatsData } from '../types';

interface HistoryListResponse {
  records: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFiltersState] = useState<HistoryFilters>({
    dateRange: [null, null],
    actions: [],
  });
  const [loading, setLoading] = useState(false);

  const setFilters = useCallback((newFilters: Partial<HistoryFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invoke<HistoryListResponse>('history_reading', {
        page,
        pageSize,
        startDate: filters.dateRange[0] || null,
        endDate: filters.dateRange[1] || null,
        actions: filters.actions.length > 0 ? filters.actions : null,
      });
      setRecords(response.records);
      setTotalCount(response.total);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setRecords([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  const logAction = useCallback(async (articleId: string, actionType: string) => {
    try {
      await invoke('history_log', { articleId: parseInt(articleId), actionType });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }, []);

  const deleteRecentAction = useCallback(async (articleId: string, actionType: string) => {
    try {
      await invoke('history_delete_recent', { articleId: parseInt(articleId), actionType });
    } catch (error) {
      console.error('Failed to delete action:', error);
    }
  }, []);

  const fetchStatsData = useCallback(async (startDate: string, endDate: string) => {
    try {
      return await invoke<StatsData>('stats_get', { startDate, endDate });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return null;
    }
  }, []);

  return {
    records,
    totalCount,
    page,
    pageSize,
    filters,
    loading,
    fetchRecords,
    setFilters,
    setPage,
    setPageSize,
    logAction,
    deleteRecentAction,
    fetchStatsData,
  };
}