export interface ReadingStats {
  todayCount: number;
  monthCount: number;
  weekCount: number;
  totalFavorites: number;
  totalChats: number;
  avgDailyCount: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
}

export interface WeeklyHourData {
  day: string;
  dayIndex: number;
  hour: number;
  count: number;
}

export interface DailyHourData {
  date: string;
  hour: number;
  count: number;
}

export interface DomainDistribution {
  domain: string;
  count: number;
  percentage: number;
}

export interface KeywordItem {
  text: string;
  value: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
  level: number; // 0-4 用于颜色等级
}

export interface StatsData {
  readingStats: ReadingStats;
  hourlyDistribution: HourlyDistribution[];
  weeklyHourData: WeeklyHourData[];
  dailyHourData: DailyHourData[];
  domainDistribution: DomainDistribution[];
  keywords: KeywordItem[];
  heatmapData: HeatmapCell[];
}
