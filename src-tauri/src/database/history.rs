// History CRUD operations
// Handles user action logs and chat history

use crate::database::{DbConnection, models::*};
use crate::database::papers::get_paper_by_id;
use rusqlite::{params, Row};

/// Get a user action log from a database row
fn action_log_from_row(row: &Row) -> Result<UserActionLog, rusqlite::Error> {
    Ok(UserActionLog {
        log_id: row.get(0)?,
        article_id: row.get(1)?,
        action_type: row.get(2)?,
        created_at: row.get(3)?,
        article: None,
    })
}

/// Record a user action
pub fn log_action(conn: &DbConnection, article_id: i64, action_type: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO user_action_logs (article_id, action_type) VALUES (?, ?)",
        params![article_id, action_type]
    ).map_err(|e| format!("记录操作失败: {}", e))?;

    Ok(())
}

/// Get reading history with filters
pub fn get_reading_history(conn: &DbConnection, params: &HistoryQueryParams) -> Result<HistoryListResponse, String> {
    let offset = (params.page - 1) * params.page_size;

    let mut conditions: Vec<String> = vec![];
    let mut bind_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Date range filter
    if let Some(start_date) = &params.start_date {
        conditions.push("l.created_at >= ?".to_string());
        bind_params.push(Box::new(format!("{} 00:00:00", start_date)));
    }
    if let Some(end_date) = &params.end_date {
        conditions.push("l.created_at <= ?".to_string());
        bind_params.push(Box::new(format!("{} 23:59:59", end_date)));
    }

    // Action type filter
    if let Some(actions) = &params.actions {
        if !actions.is_empty() {
            let placeholders: Vec<String> = actions.iter().map(|_| "?".to_string()).collect();
            conditions.push(format!("l.action_type IN ({})", placeholders.join(",")));
            for action in actions {
                bind_params.push(Box::new(action.clone()));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM user_action_logs l {}", where_clause);
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), |row| row.get(0))
        .map_err(|e| format!("查询历史总数失败: {}", e))?;

    // Get logs
    let sql = format!(
        "SELECT l.log_id, l.article_id, l.action_type, l.created_at
         FROM user_action_logs l
         {}
         ORDER BY l.created_at DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    bind_params.push(Box::new(params.page_size));
    bind_params.push(Box::new(offset));

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let logs: Vec<UserActionLog> = stmt.query_map(rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), action_log_from_row)
        .map_err(|e| format!("查询历史失败: {}", e))?
        .filter_map(|l| l.ok())
        .collect();

    // Fill in article details
    let mut records: Vec<UserActionLog> = vec![];
    for log in logs {
        let article = get_paper_by_id(conn, log.article_id).ok();
        records.push(UserActionLog {
            log_id: log.log_id,
            article_id: log.article_id,
            action_type: log.action_type,
            created_at: log.created_at,
            article,
        });
    }

    Ok(HistoryListResponse {
        records,
        total,
        page: params.page,
        page_size: params.page_size,
    })
}

/// Get reading history grouped by date
pub fn get_reading_history_grouped(conn: &DbConnection, params: &HistoryQueryParams) -> Result<Vec<(String, Vec<UserActionLog>)>, String> {
    let history = get_reading_history(conn, params)?;

    // Group by date
    let mut groups: Vec<(String, Vec<UserActionLog>)> = vec![];
    for record in history.records {
        let date = record.created_at
            .as_ref()
            .map(|t| t.split(' ').next().unwrap_or("").to_string())
            .unwrap_or_default();

        if let Some(group) = groups.iter_mut().find(|g| g.0 == date) {
            group.1.push(record);
        } else {
            groups.push((date, vec![record]));
        }
    }

    Ok(groups)
}

/// Get chat history with filters
pub fn get_chat_history(conn: &DbConnection, params: &HistoryQueryParams) -> Result<Vec<ChatSession>, String> {
    let limit = params.page_size;

    let mut conditions: Vec<String> = vec![];
    let mut bind_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Date range filter
    if let Some(start_date) = &params.start_date {
        conditions.push("s.updated_at >= ?".to_string());
        bind_params.push(Box::new(format!("{} 00:00:00", start_date)));
    }
    if let Some(end_date) = &params.end_date {
        conditions.push("s.updated_at <= ?".to_string());
        bind_params.push(Box::new(format!("{} 23:59:59", end_date)));
    }

    // Mode filter
    if let Some(modes) = &params.modes {
        if !modes.is_empty() {
            let placeholders: Vec<String> = modes.iter().map(|_| "?".to_string()).collect();
            conditions.push(format!("s.mode IN ({})", placeholders.join(",")));
            for mode in modes {
                bind_params.push(Box::new(mode.clone()));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT s.session_id, s.title, s.mode, s.article_id, s.created_at, s.updated_at,
                COUNT(m.message_id) as message_count
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON s.session_id = m.session_id
         {}
         GROUP BY s.session_id
         ORDER BY s.updated_at DESC
         LIMIT ?",
        where_clause
    );

    bind_params.push(Box::new(limit));

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let sessions: Vec<ChatSession> = stmt.query_map(rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), |row| {
        Ok(ChatSession {
            session_id: row.get(0)?,
            title: row.get(1)?,
            mode: row.get(2)?,
            article_id: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            message_count: Some(row.get(6)?),
        })
    }).map_err(|e| format!("查询对话历史失败: {}", e))?
    .filter_map(|s| s.ok())
    .collect();

    Ok(sessions)
}