export interface ReadingStats {
  // View counts (view_abstract action)
  todayCount: number;         // Today's view count
  weekCount: number;          // Last 7 days view count
  days30Count: number;        // Last 30 days view count
  monthCount: number;         // This month's view count (calendar month)
  // Read counts (download action)
  todayReadCount: number;     // Today's read count
  weekReadCount: number;      // Last 7 days read count
  days30ReadCount: number;    // Last 30 days read count
  monthReadCount: number;     // This month's read count (calendar month)
  // Favorites
  weekFavorites: number;      // Last 7 days favorites
  days30Favorites: number;    // Last 30 days favorites
  totalFavorites: number;     // Total favorites
  // Chats
  weekChats: number;          // Last 7 days chats
  days30Chats: number;        // Last 30 days chats
  totalChats: number;         // Total chats
  // Average
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
