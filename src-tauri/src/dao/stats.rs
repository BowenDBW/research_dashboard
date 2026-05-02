// Stats CRUD operations
// Handles statistics and analytics queries

use crate::dao::{DbConnection};
use crate::models::*;
use rusqlite::{params};
use std::collections::HashMap;
use itertools::Itertools;

/// Get comprehensive statistics
pub fn get_stats(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<StatsResponse, String> {
    let reading_stats = get_reading_stats(conn, start_date, end_date)?;
    let hourly_distribution = get_hourly_distribution(conn, start_date, end_date)?;
    let weekly_hour_data = get_weekly_hour_data(conn, start_date, end_date)?;
    let daily_hour_data = get_daily_hour_data(conn, start_date, end_date)?;
    let domain_distribution = get_domain_distribution(conn, start_date, end_date)?;
    let keywords = get_keywords(conn, start_date, end_date)?;
    let heatmap_data = get_heatmap_data(conn, start_date, end_date)?;

    Ok(StatsResponse {
        reading_stats,
        hourly_distribution,
        weekly_hour_data,
        daily_hour_data,
        domain_distribution,
        keywords,
        heatmap_data,
    })
}

/// Get today's quick stats (for sidebar, deduplicated)
pub fn get_today_stats(conn: &DbConnection) -> Result<(i64, i64, i64, i64), String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Today's reading count (deduplicated: unique articles today)
    let today_count: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT article_id) FROM user_action_logs WHERE DATE(created_at) = ?",
        params![today],
        |row| row.get(0)
    ).map_err(|e| format!("查询今日阅读数失败: {}", e))?;

    // Total papers
    let total_papers: i64 = conn.query_row(
        "SELECT COUNT(*) FROM papers",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询论文总数失败: {}", e))?;

    // Total favorites
    let total_favorites: i64 = conn.query_row(
        "SELECT COUNT(*) FROM favorite_papers",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询收藏总数失败: {}", e))?;

    // Total chat sessions
    let total_chats: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_sessions",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询对话总数失败: {}", e))?;

    Ok((today_count, total_papers, total_favorites, total_chats))
}

/// Get reading stats (deduplicated: each article counted once per day)
fn get_reading_stats(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<ReadingStats, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Today's count (deduplicated: unique articles today)
    let today_count: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT article_id) FROM user_action_logs WHERE DATE(created_at) = ?",
        params![today],
        |row| row.get(0)
    ).map_err(|e| format!("查询今日阅读数失败: {}", e))?;

    // Week count (deduplicated: unique articles in last 7 days, each day counted separately)
    // We count unique (article_id, date) pairs
    let week_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM (
            SELECT DISTINCT article_id, DATE(created_at) as date
            FROM user_action_logs
            WHERE created_at >= DATE('now', '-7 days')
        )",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询本周阅读数失败: {}", e))?;

    // Month count (deduplicated: unique (article_id, date) pairs in date range)
    let month_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM (
            SELECT DISTINCT article_id, DATE(created_at) as date
            FROM user_action_logs
            WHERE created_at >= ? AND created_at <= ?
        )",
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| row.get(0)
    ).map_err(|e| format!("查询本月阅读数失败: {}", e))?;

    // Total favorites (from favorite_papers table)
    let total_favorites: i64 = conn.query_row(
        "SELECT COUNT(*) FROM favorite_papers",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询收藏总数失败: {}", e))?;

    // Total chats
    let total_chats: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chat_sessions",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("查询对话总数失败: {}", e))?;

    // Calculate average daily count
    let days = chrono::NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|e| format!("解析日期失败: {}", e))?
        .signed_duration_since(
            chrono::NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
                .map_err(|e| format!("解析日期失败: {}", e))?
        )
        .num_days() + 1;

    let avg_daily_count = if days > 0 {
        month_count as f64 / days as f64
    } else {
        0.0
    };

    Ok(ReadingStats {
        today_count,
        week_count,
        month_count,
        total_favorites,
        total_chats,
        avg_daily_count,
    })
}

/// Get hourly distribution (deduplicated: each article counted once per hour per day)
fn get_hourly_distribution(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<HourlyDistribution>, String> {
    // Deduplicate: for each hour, count unique (article_id, date) pairs in that hour
    let sql = "SELECT strftime('%H', created_at) as hour, COUNT(*) as count
               FROM (
                   SELECT DISTINCT article_id, DATE(created_at) as date, strftime('%H', created_at) as hour
                   FROM user_action_logs
                   WHERE created_at >= ? AND created_at <= ?
               )
               GROUP BY hour
               ORDER BY hour";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let distribution: Vec<HourlyDistribution> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| Ok(HourlyDistribution {
            hour: row.get::<_, String>(0)?.parse().unwrap_or(0),
            count: row.get(1)?,
        })
    ).map_err(|e| format!("查询小时分布失败: {}", e))?
    .filter_map(|h| h.ok())
    .collect();

    Ok(distribution)
}

/// Get weekly hour data (day of week x hour, deduplicated)
fn get_weekly_hour_data(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<WeeklyHourData>, String> {
    // Deduplicate: count unique (article_id, date) pairs for each day_of_week + hour
    let sql = "SELECT strftime('%w', created_at) as day_of_week,
                      strftime('%H', created_at) as hour,
                      COUNT(*) as count
               FROM (
                   SELECT DISTINCT article_id, DATE(created_at) as date,
                          strftime('%w', created_at) as day_of_week,
                          strftime('%H', created_at) as hour
                   FROM user_action_logs
                   WHERE created_at >= ? AND created_at <= ?
               )
               GROUP BY day_of_week, hour";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let data: Vec<WeeklyHourData> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| {
            let day_index: i32 = row.get::<_, String>(0)?.parse().unwrap_or(0);
            let day_names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
            Ok(WeeklyHourData {
                day: day_names[day_index as usize].to_string(),
                day_index,
                hour: row.get::<_, String>(1)?.parse().unwrap_or(0),
                count: row.get(2)?,
            })
        }
    ).map_err(|e| format!("查询周小时分布失败: {}", e))?
    .filter_map(|d| d.ok())
    .collect();

    Ok(data)
}

/// Get daily hour data (for heatmap, deduplicated)
fn get_daily_hour_data(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<DailyHourData>, String> {
    // Deduplicate: count unique (article_id, date) pairs for each date + hour
    let sql = "SELECT date, hour, COUNT(*) as count
               FROM (
                   SELECT DISTINCT article_id, DATE(created_at) as date,
                          strftime('%H', created_at) as hour
                   FROM user_action_logs
                   WHERE created_at >= ? AND created_at <= ?
               )
               GROUP BY date, hour";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let data: Vec<DailyHourData> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| Ok(DailyHourData {
            date: row.get(0)?,
            hour: row.get::<_, String>(1)?.parse().unwrap_or(0),
            count: row.get(2)?,
        })
    ).map_err(|e| format!("查询日小时分布失败: {}", e))?
    .filter_map(|d| d.ok())
    .collect();

    Ok(data)
}

/// Get domain distribution (deduplicated)
fn get_domain_distribution(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<DomainDistribution>, String> {
    // Deduplicate: count unique (article_id, date) pairs, then join with paper categories
    let sql = "SELECT pc.category as domain, COUNT(*) as count
               FROM (
                   SELECT DISTINCT article_id, DATE(created_at) as date
                   FROM user_action_logs
                   WHERE created_at >= ? AND created_at <= ?
               ) l
               JOIN papers p ON l.article_id = p.article_id
               JOIN paper_categories pc ON p.article_id = pc.article_id
               GROUP BY pc.category
               ORDER BY count DESC
               LIMIT 10";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    // Get total for percentage calculation (deduplicated)
    let total_sql = "SELECT COUNT(*) FROM (
        SELECT DISTINCT article_id, DATE(created_at) as date
        FROM user_action_logs
        WHERE created_at >= ? AND created_at <= ?
    )";
    let total: i64 = conn.query_row(
        total_sql,
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| row.get(0)
    ).map_err(|e| format!("查询总数失败: {}", e))?;

    let distribution: Vec<DomainDistribution> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| {
            let count: i64 = row.get(1)?;
            let percentage = if total > 0 {
                (count as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            Ok(DomainDistribution {
                domain: row.get(0)?,
                count,
                percentage,
            })
        }
    ).map_err(|e| format!("查询领域分布失败: {}", e))?
    .filter_map(|d| d.ok())
    .collect();

    Ok(distribution)
}

/// Get keywords from paper titles (deduplicated)
fn get_keywords(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<KeywordData>, String> {
    // Deduplicate: get titles from unique (article_id, date) pairs
    let sql = "SELECT DISTINCT p.title
               FROM (
                   SELECT DISTINCT article_id, DATE(created_at) as date
                   FROM user_action_logs
                   WHERE created_at >= ? AND created_at <= ?
               ) l
               JOIN papers p ON l.article_id = p.article_id";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let titles: Vec<String> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| row.get(0)
    ).map_err(|e| format!("查询标题失败: {}", e))?
    .filter_map(|t| t.ok())
    .collect();

    // Simple keyword extraction (split by spaces, filter short words)
    // This is a basic implementation; a more sophisticated approach would use NLP
    let mut word_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    for title in titles {
        let words = title.split_whitespace()
            .filter(|w| w.len() > 3) // Filter short words
            .map(|w| w.to_lowercase());

        for word in words {
            *word_counts.entry(word).or_insert(0) += 1;
        }
    }

    // Sort by count and take top 20
    let keywords: Vec<KeywordData> = word_counts
        .into_iter()
        .filter(|(_, count)| *count > 1) // Only words appearing more than once
        .sorted_by(|a, b| b.1.cmp(&a.1))
        .take(20)
        .map(|(text, value)| KeywordData { text, value })
        .collect();

    Ok(keywords)
}

/// Get heatmap data (daily counts with levels, deduplicated)
fn get_heatmap_data(conn: &DbConnection, start_date: &str, end_date: &str) -> Result<Vec<HeatmapData>, String> {
    // Deduplicate: count unique articles per day
    let sql = "SELECT DATE(created_at) as date, COUNT(DISTINCT article_id) as count
               FROM user_action_logs
               WHERE created_at >= ? AND created_at <= ?
               GROUP BY date
               ORDER BY date";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let data: Vec<HeatmapData> = stmt.query_map(
        params![format!("{} 00:00:00", start_date), format!("{} 23:59:59", end_date)],
        |row| {
            let count: i64 = row.get(1)?;
            // Calculate level: 0=0, 1=1-2, 2=3-4, 3=5-6, 4=>6
            let level = if count == 0 { 0 }
                        else if count <= 2 { 1 }
                        else if count <= 4 { 2 }
                        else if count <= 6 { 3 }
                        else { 4 };
            Ok(HeatmapData {
                date: row.get(0)?,
                count,
                level,
            })
        }
    ).map_err(|e| format!("查询热力图数据失败: {}", e))?
    .filter_map(|h| h.ok())
    .collect();

    Ok(data)
}

/// Get reading trend (deduplicated)
pub fn get_reading_trend(conn: &DbConnection, days: i32) -> Result<Vec<(String, i64)>, String> {
    // Deduplicate: count unique articles per day
    let sql = "SELECT DATE(created_at) as date, COUNT(DISTINCT article_id) as count
               FROM user_action_logs
               WHERE created_at >= DATE('now', ? || ' days')
               GROUP BY date
               ORDER BY date";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let trend: Vec<(String, i64)> = stmt.query_map(
        params![format!("-{}", days)],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| format!("查询趋势失败: {}", e))?
    .filter_map(|t| t.ok())
    .collect();

    Ok(trend)
}