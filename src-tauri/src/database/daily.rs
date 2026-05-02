// Daily Recommendations CRUD operations
// Handles daily recommendation queries

use crate::database::{DbConnection, models::*};
use crate::database::papers::{get_paper_by_id, paper_from_row};
use rusqlite::{params};

/// Get daily recommendation list
pub fn get_daily_recommendations(conn: &DbConnection, page: i32, page_size: i32, month: Option<&str>) -> Result<DailyRecommendationListResponse, String> {
    let offset = (page - 1) * page_size;

    // Build WHERE clause for month filter
    let where_clause = if let Some(m) = month {
        format!("WHERE strftime('%Y-%m', d.created_at) = '{}'", m)
    } else {
        String::new()
    };

    // Get grouped items by date
    let sql = format!(
        "SELECT DATE(d.created_at) as date, COUNT(*) as article_count
         FROM daily_recommendations d
         {}
         GROUP BY DATE(d.created_at)
         ORDER BY date DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let items: Vec<DailyRecommendationItem> = stmt.query_map(params![page_size, offset], |row| {
        Ok(DailyRecommendationItem {
            id: 0, // Will be filled later
            date: row.get(0)?,
            article_count: row.get(1)?,
        })
    }).map_err(|e| format!("查询推荐列表失败: {}", e))?
    .filter_map(|i| i.ok())
    .collect();

    // Get total count of unique dates
    let count_sql = format!(
        "SELECT COUNT(DISTINCT DATE(created_at)) FROM daily_recommendations {}",
        where_clause
    );
    let total: i64 = conn.query_row(&count_sql, [], |row| row.get(0))
        .map_err(|e| format!("查询推荐总数失败: {}", e))?;

    Ok(DailyRecommendationListResponse {
        items,
        total,
        page,
        page_size,
    })
}

/// Get daily recommendation detail for a specific date
pub fn get_daily_recommendation_by_date(conn: &DbConnection, date: &str) -> Result<DailyRecommendationDetail, String> {
    // Get papers for this date
    let sql = "SELECT p.article_id, p.title, p.abstract, p.publication_date, p.preprint_number,
                      p.publication_venue, p.publication_link, p.pdf_link, p.pdf_path
               FROM daily_recommendations d
               JOIN papers p ON d.article_id = p.article_id
               WHERE DATE(d.created_at) = ?
               ORDER BY d.created_at DESC";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let papers: Vec<Paper> = stmt.query_map(params![date], paper_from_row)
        .map_err(|e| format!("查询推荐详情失败: {}", e))?
        .filter_map(|p| p.ok())
        .collect();

    // Fill in authors and categories for each paper
    let mut articles: Vec<Paper> = vec![];
    for paper in papers {
        let article_id = paper.article_id;
        let full_paper = get_paper_by_id(conn, article_id).unwrap_or(paper);
        articles.push(full_paper);
    }

    // Get article count
    let count_sql = "SELECT COUNT(*) FROM daily_recommendations WHERE DATE(created_at) = ?";
    let article_count: i64 = conn.query_row(count_sql, params![date], |row| row.get(0))
        .map_err(|e| format!("查询推荐数量失败: {}", e))?;

    Ok(DailyRecommendationDetail {
        id: 0,
        date: date.to_string(),
        article_count,
        articles,
        created_at: None,
    })
}

/// Get recent daily recommendations (for sidebar)
pub fn get_recent_recommendations(conn: &DbConnection, limit: i32) -> Result<Vec<DailyRecommendationItem>, String> {
    let sql = "SELECT DATE(created_at) as date, COUNT(*) as article_count
               FROM daily_recommendations
               GROUP BY DATE(created_at)
               ORDER BY date DESC
               LIMIT ?";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let items: Vec<DailyRecommendationItem> = stmt.query_map(params![limit], |row| {
        Ok(DailyRecommendationItem {
            id: 0,
            date: row.get(0)?,
            article_count: row.get(1)?,
        })
    }).map_err(|e| format!("查询最近推荐失败: {}", e))?
    .filter_map(|i| i.ok())
    .collect();

    Ok(items)
}

/// Add a daily recommendation
pub fn add_daily_recommendation(conn: &DbConnection, article_id: i64, source: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO daily_recommendations (article_id, source) VALUES (?, ?)",
        params![article_id, source]
    ).map_err(|e| format!("添加推荐失败: {}", e))?;

    Ok(())
}