// Daily Recommendations CRUD operations
// Handles daily recommendation queries

use crate::dao::{DbConnection};
use crate::models::*;
use crate::dao::papers::{get_paper_by_id, paper_from_row};
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

    // Get total count of unique dates.
    // 与 items 的 GROUP BY 完全同口径（同一子查询），保证总数与实际行数恒等，
    // 避免 NULL/畸形 created_at 等数据导致 COUNT(DISTINCT ...) 与分组行数不一致（总数错）。
    let count_sql = format!(
        "SELECT COUNT(*) FROM (
             SELECT DATE(d.created_at) AS date FROM daily_recommendations d {}
             GROUP BY DATE(d.created_at)
         )",
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

/// Get daily recommendation detail for a specific date, grouped by source email.
/// 同一天的推荐按邮件分组（email_id 相同属于同一封 Scholar Alert 邮件），
/// 组内保留文章顺序；旧数据（无 email_id）归为单一未分组组（email_subject 为空）。
pub fn get_daily_recommendation_by_date(conn: &DbConnection, date: &str) -> Result<DailyRecommendationDetail, String> {
    // email_id（FK 到 scholar_emails）与 e.subject 追加在 paper_from_row 需要的 12 列之后，
    // 避免破坏列映射。天内按邮件接收时间升序 -> 邮件 id -> created_at 排序，保证分组稳定且按时间。
    let sql = "SELECT p.article_id, p.title, p.abstract, p.publication_date, p.preprint_number,
                      p.venue_id, v.name, v.abbreviation, p.publication_link, p.pdf_link, p.pdf_path, v.venue_type,
                      d.email_id, e.subject
               FROM daily_recommendations d
               JOIN papers p ON d.article_id = p.article_id
               LEFT JOIN venues v ON p.venue_id = v.venue_id
               LEFT JOIN scholar_emails e ON d.email_id = e.id
               WHERE DATE(d.created_at) = ?
               ORDER BY e.received_at ASC, d.email_id ASC, d.created_at DESC, p.article_id ASC";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    // 分组（email_id -> group）。保持 SQL 返回的组顺序。
    let mut groups: Vec<DailyRecommendationGroup> = Vec::new();
    let mut group_index: std::collections::HashMap<i64, usize> = std::collections::HashMap::new();

    let rows = stmt.query_map(params![date], |row| {
        let paper = paper_from_row(row)?;
        let email_id: Option<i64> = row.get(12).unwrap_or(None);
        let email_subject: Option<String> = row.get(13).unwrap_or(None);
        Ok((paper, email_id, email_subject))
    })
    .map_err(|e| format!("查询推荐详情失败: {}", e))?;

    for row in rows {
        let (paper, email_id, email_subject) = row.map_err(|e| format!("读取推荐详情行失败: {}", e))?;
        let key = email_id.unwrap_or(-1); // NULL -> -1，归为未分组组

        // 补全作者/分类等信息（保留论文自身信息）
        let full_paper = get_paper_by_id(conn, paper.article_id).unwrap_or(paper);

        let idx = match group_index.get(&key) {
            Some(&i) => i,
            None => {
                groups.push(DailyRecommendationGroup {
                    email_subject: email_subject.unwrap_or_default(),
                    articles: Vec::new(),
                });
                let i = groups.len() - 1;
                group_index.insert(key, i);
                i
            }
        };
        groups[idx].articles.push(full_paper);
    }

    // Get article count
    let count_sql = "SELECT COUNT(*) FROM daily_recommendations WHERE DATE(created_at) = ?";
    let article_count: i64 = conn.query_row(count_sql, params![date], |row| row.get(0))
        .map_err(|e| format!("查询推荐数量失败: {}", e))?;

    Ok(DailyRecommendationDetail {
        id: 0,
        date: date.to_string(),
        article_count,
        groups,
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

/// 写入一封来源邮件（Scholar Alert），返回其行 id（供 daily_recommendations.email_id 外键引用）。
/// 同一封邮件（按 gmail_message_id 去重）只存一行，邮件标题等字段不随每条推荐重复。
pub fn upsert_scholar_email(
    conn: &DbConnection,
    gmail_message_id: &str,
    subject: &str,
    sender: &str,
    received_at: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT OR IGNORE INTO scholar_emails (gmail_message_id, subject, sender, received_at)
         VALUES (?, ?, ?, ?)",
        params![gmail_message_id, subject, sender, received_at]
    ).map_err(|e| format!("写入来源邮件失败: {}", e))?;

    let id = conn.query_row(
        "SELECT id FROM scholar_emails WHERE gmail_message_id = ?",
        params![gmail_message_id],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| format!("查询来源邮件失败: {}", e))?;

    Ok(id)
}

/// Add a daily recommendation.
/// `recommended_at` 是文章被推荐的时间；对 Gmail Scholar Alert 就是邮件发送日期。
/// 存入 created_at 列，供前端按日期分组展示 —— 分组时间必须与邮件发送时间一致，
/// 而不是同步/爬取时间。
/// `email_row_id` 关联 scholar_emails 表的一行（来源邮件），供前端按邮件分组显示小标题。
pub fn add_daily_recommendation(
    conn: &DbConnection,
    article_id: i64,
    source: &str,
    recommended_at: &str,
    email_row_id: Option<i64>,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO daily_recommendations
         (article_id, source, created_at, email_id)
         VALUES (?, ?, ?, ?)",
        params![article_id, source, recommended_at, email_row_id]
    ).map_err(|e| format!("添加推荐失败: {}", e))?;

    Ok(())
}

/// 数据库里 google 来源推荐「停在哪一天」：`MAX(created_at)`（即最后处理到的邮件日期）。
/// 爬取搜索窗口据此构造 `after:` —— 上次爬取时间只决定是否触发，读多早取决于这里。
pub fn get_max_google_date(conn: &DbConnection) -> Result<Option<String>, String> {
    let result = conn.query_row(
        "SELECT MAX(created_at) FROM daily_recommendations WHERE source = 'google'",
        [],
        |row| row.get::<_, Option<String>>(0),
    );
    match result {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("查询最大推荐日期失败: {}", e)),
    }
}