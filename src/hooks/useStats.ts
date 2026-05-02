import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StatsData } from '../types/stats';

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

export function useStats() {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const response = await invoke<StatsResponse>('stats_get', { startDate, endDate });
      setStatsData(response);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTodayStats = useCallback(async () => {
    try {
      const response = await invoke<TodayStatsResponse>('stats_today');
      setTodayStats(response);
    } catch (error) {
      console.error('Failed to fetch today stats:', error);
    }
  }, []);

  const fetchTrend = useCallback(async (days: number) => {
    try {
      return await invoke<{ date: string; count: number }[]>('stats_trend', { days });
    } catch (error) {
      console.error('Failed to fetch trend:', error);
      return [];
    }
  }, []);

  return {
    statsData,
    todayStats,
    loading,
    fetchStats,
    fetchTodayStats,
    fetchTrend,
  };
}