// Stats service - Business logic for statistics
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::stats::*;
use crate::models::{StatsResponse, ReadingStats, HourlyDistribution, WeeklyHourData, DailyHourData, DomainDistribution, KeywordData, HeatmapData, FrontendStatsResponse, FrontendReadingStats, FrontendHourlyDistribution, FrontendWeeklyHourData, FrontendDailyHourData, FrontendDomainDistribution, FrontendKeywordData, FrontendHeatmapData, FrontendTodayStats, FrontendTrendItem};

/// Convert database StatsResponse to frontend format
pub fn stats_to_frontend(stats: StatsResponse) -> FrontendStatsResponse {
    FrontendStatsResponse {
        reading_stats: FrontendReadingStats {
            today_count: stats.reading_stats.today_count,
            week_count: stats.reading_stats.week_count,
            month_count: stats.reading_stats.month_count,
            total_favorites: stats.reading_stats.total_favorites,
            total_chats: stats.reading_stats.total_chats,
            avg_daily_count: stats.reading_stats.avg_daily_count,
        },
        hourly_distribution: stats.hourly_distribution.into_iter().map(|h| FrontendHourlyDistribution {
            hour: h.hour,
            count: h.count,
        }).collect(),
        weekly_hour_data: stats.weekly_hour_data.into_iter().map(|w| FrontendWeeklyHourData {
            day: w.day,
            day_index: w.day_index,
            hour: w.hour,
            count: w.count,
        }).collect(),
        daily_hour_data: stats.daily_hour_data.into_iter().map(|d| FrontendDailyHourData {
            date: d.date,
            hour: d.hour,
            count: d.count,
        }).collect(),
        domain_distribution: stats.domain_distribution.into_iter().map(|d| FrontendDomainDistribution {
            domain: d.domain,
            count: d.count,
            percentage: d.percentage,
        }).collect(),
        keywords: stats.keywords.into_iter().map(|k| FrontendKeywordData {
            text: k.text,
            value: k.value,
        }).collect(),
        heatmap_data: stats.heatmap_data.into_iter().map(|h| FrontendHeatmapData {
            date: h.date,
            count: h.count,
            level: h.level,
        }).collect(),
    }
}

/// Get comprehensive statistics - returns frontend format
pub fn get_statistics(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<FrontendStatsResponse, String> {
    let stats = get_stats(conn, start_date, end_date)?;
    Ok(stats_to_frontend(stats))
}

/// Get today's stats - returns frontend format
pub fn get_today_statistics(conn: &DbConnection) -> Result<FrontendTodayStats, String> {
    let (today_count, total_papers, total_favorites, total_chats) = get_today_stats(conn)?;

    Ok(FrontendTodayStats {
        today_count,
        total_paper_count: total_papers,
        favorite_count: total_favorites,
        chat_count: total_chats,
    })
}

/// Get reading trend - returns frontend format
pub fn get_reading_trend_data(conn: &DbConnection, days: i32) -> Result<Vec<FrontendTrendItem>, String> {
    let trend = get_reading_trend(conn, days)?;

    Ok(trend.into_iter().map(|(date, count)| FrontendTrendItem {
        date,
        count,
    }).collect())
}