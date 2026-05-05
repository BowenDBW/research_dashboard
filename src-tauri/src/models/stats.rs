// Stats models

use serde::{Deserialize, Serialize};

/// Reading statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingStats {
    // View counts (view_abstract action)
    pub today_count: i64,        // Today's view count
    pub week_count: i64,         // Last 7 days view count
    pub days_30_count: i64,      // Last 30 days view count
    pub month_count: i64,        // This month's view count (calendar month)
    // Read counts (download action)
    pub today_read_count: i64,   // Today's read count
    pub week_read_count: i64,    // Last 7 days read count
    pub days_30_read_count: i64, // Last 30 days read count
    pub month_read_count: i64,   // This month's read count (calendar month)
    // Favorites
    pub week_favorites: i64,     // Last 7 days favorites
    pub days_30_favorites: i64,  // Last 30 days favorites
    pub total_favorites: i64,    // Total favorites
    // Chats
    pub week_chats: i64,         // Last 7 days chats
    pub days_30_chats: i64,      // Last 30 days chats
    pub total_chats: i64,        // Total chats
    // Average
    pub avg_daily_count: f64,
}

/// Hourly distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyDistribution {
    pub hour: i32,
    pub count: i64,
}

/// Weekly hour data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyHourData {
    pub day: String,
    pub day_index: i32,
    pub hour: i32,
    pub count: i64,
}

/// Daily hour data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyHourData {
    pub date: String,
    pub hour: i32,
    pub count: i64,
}

/// Domain distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainDistribution {
    pub domain: String,
    pub count: i64,
    pub percentage: f64,
}

/// Keyword data for word cloud
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordData {
    pub text: String,
    pub value: i64,
}

/// Heatmap data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapData {
    pub date: String,
    pub count: i64,
    pub level: i32,
}

/// Full stats response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsResponse {
    pub reading_stats: ReadingStats,
    pub hourly_distribution: Vec<HourlyDistribution>,
    pub weekly_hour_data: Vec<WeeklyHourData>,
    pub daily_hour_data: Vec<DailyHourData>,
    pub domain_distribution: Vec<DomainDistribution>,
    pub keywords: Vec<KeywordData>,
    pub heatmap_data: Vec<HeatmapData>,
}