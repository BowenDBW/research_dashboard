import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  StatsData,
  ReadingStats,
  HourlyDistribution,
  WeeklyHourData,
  DailyHourData,
  DomainDistribution,
  KeywordItem,
  HeatmapCell,
} from '../types/stats';

// Backend response types (match Rust models with snake_case)
interface BackendReadingStats {
  today_count: number;
  week_count: number;
  month_count: number;
  total_favorites: number;
  total_chats: number;
  avg_daily_count: number;
}

interface BackendHourlyDistribution {
  hour: number;
  count: number;
}

interface BackendWeeklyHourData {
  day: string;
  day_index: number;
  hour: number;
  count: number;
}

interface BackendDailyHourData {
  date: string;
  hour: number;
  count: number;
}

interface BackendDomainDistribution {
  domain: string;
  count: number;
  percentage: number;
}

interface BackendKeywordData {
  text: string;
  value: number;
}

interface BackendHeatmapData {
  date: string;
  count: number;
  level: number;
}

interface BackendStatsResponse {
  reading_stats: BackendReadingStats;
  hourly_distribution: BackendHourlyDistribution[];
  weekly_hour_data: BackendWeeklyHourData[];
  daily_hour_data: BackendDailyHourData[];
  domain_distribution: BackendDomainDistribution[];
  keywords: BackendKeywordData[];
  heatmap_data: BackendHeatmapData[];
}

interface BackendTodayStats {
  today_count: number;
  total_paper_count: number;
  favorite_count: number;
  chat_count: number;
}

interface BackendTrendItem {
  date: string;
  count: number;
}

// Conversion functions
function readingStatsToFrontend(stats: BackendReadingStats): ReadingStats {
  return {
    todayCount: stats.today_count,
    weekCount: stats.week_count,
    monthCount: stats.month_count,
    totalFavorites: stats.total_favorites,
    totalChats: stats.total_chats,
    avgDailyCount: stats.avg_daily_count,
  };
}

function hourlyToFrontend(h: BackendHourlyDistribution): HourlyDistribution {
  return { hour: h.hour, count: h.count };
}

function weeklyHourToFrontend(w: BackendWeeklyHourData): WeeklyHourData {
  return {
    day: w.day,
    dayIndex: w.day_index,
    hour: w.hour,
    count: w.count,
  };
}

function dailyHourToFrontend(d: BackendDailyHourData): DailyHourData {
  return { date: d.date, hour: d.hour, count: d.count };
}

function domainToFrontend(d: BackendDomainDistribution): DomainDistribution {
  return { domain: d.domain, count: d.count, percentage: d.percentage };
}

function keywordToFrontend(k: BackendKeywordData): KeywordItem {
  return { text: k.text, value: k.value };
}

function heatmapToFrontend(h: BackendHeatmapData): HeatmapCell {
  return { date: h.date, count: h.count, level: h.level };
}

function statsResponseToFrontend(response: BackendStatsResponse): StatsData {
  return {
    readingStats: readingStatsToFrontend(response.reading_stats),
    hourlyDistribution: response.hourly_distribution.map(hourlyToFrontend),
    weeklyHourData: response.weekly_hour_data.map(weeklyHourToFrontend),
    dailyHourData: response.daily_hour_data.map(dailyHourToFrontend),
    domainDistribution: response.domain_distribution.map(domainToFrontend),
    keywords: response.keywords.map(keywordToFrontend),
    heatmapData: response.heatmap_data.map(heatmapToFrontend),
  };
}

interface StatsStore {
  statsData: StatsData | null;
  todayStats: { todayCount: number; totalPapers: number; totalFavorites: number; totalChats: number } | null;
  readingTrend: { date: string; count: number }[];
  loading: boolean;
  dateRange: { startDate: string; endDate: string };

  // Actions
  fetchStats: (startDate: string, endDate: string) => Promise<void>;
  fetchTodayStats: () => Promise<void>;
  fetchReadingTrend: (days: number) => Promise<void>;
  setDateRange: (startDate: string, endDate: string) => void;
}

// Default date range: last 30 days
function getDefaultDateRange() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    startDate: formatDate(thirtyDaysAgo),
    endDate: formatDate(today),
  };
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  statsData: null,
  todayStats: null,
  readingTrend: [],
  loading: false,
  dateRange: getDefaultDateRange(),

  fetchStats: async (startDate: string, endDate: string) => {
    set({ loading: true, dateRange: { startDate, endDate } });
    try {
      const response = await invoke<BackendStatsResponse>('stats_get', {
        startDate,
        endDate,
      });

      const statsData = statsResponseToFrontend(response);
      set({ statsData, loading: false });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({ statsData: null, loading: false });
    }
  },

  fetchTodayStats: async () => {
    try {
      const response = await invoke<BackendTodayStats>('stats_today');

      set({
        todayStats: {
          todayCount: response.today_count,
          totalPapers: response.total_paper_count,
          totalFavorites: response.favorite_count,
          totalChats: response.chat_count,
        },
      });
    } catch (error) {
      console.error('Failed to fetch today stats:', error);
      set({ todayStats: null });
    }
  },

  fetchReadingTrend: async (days: number) => {
    try {
      const response = await invoke<BackendTrendItem[]>('stats_trend', { days });

      set({
        readingTrend: response.map((item) => ({
          date: item.date,
          count: item.count,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch reading trend:', error);
      set({ readingTrend: [] });
    }
  },

  setDateRange: (startDate: string, endDate: string) => {
    set({ dateRange: { startDate, endDate } });
  },
}));