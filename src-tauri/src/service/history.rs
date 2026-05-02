// History service - Business logic for history operations
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::history::*;
use crate::models::{HistoryQueryParams, HistoryListResponse, UserActionLog, FrontendHistoryListResponse, FrontendHistoryRecord, FrontendChatSession, FrontendArticle};

/// Convert database UserActionLog to frontend format
fn log_to_frontend_record(log: UserActionLog) -> FrontendHistoryRecord {
    FrontendHistoryRecord {
        id: log.log_id.to_string(),
        article_id: log.article_id.to_string(),
        article: log.article.map(|p| p.into()),
        action: log.action_type,
        timestamp: log.created_at.unwrap_or_default(),
    }
}

/// Get reading history - returns frontend format
pub fn get_reading_history_list(conn: &DbConnection, params: &HistoryQueryParams) -> Result<FrontendHistoryListResponse, String> {
    let response = get_reading_history(conn, params)?;

    Ok(FrontendHistoryListResponse {
        records: response.records.into_iter().map(log_to_frontend_record).collect(),
        total: response.total,
        page: response.page,
        page_size: response.page_size,
    })
}

/// Get chat history
pub fn get_chat_history_list(conn: &DbConnection, params: &HistoryQueryParams) -> Result<Vec<FrontendChatSession>, String> {
    let sessions = get_chat_history(conn, params)?;

    Ok(sessions.into_iter().map(|s| FrontendChatSession {
        id: s.session_id.to_string(),
        title: s.title.unwrap_or_else(|| match s.mode.as_str() {
            "chat" => "新对话".to_string(),
            "paper_search" => "AI搜索推荐".to_string(),
            "chapter_summary" => "章节总结".to_string(),
            _ => "新对话".to_string(),
        }),
        mode: s.mode,
        created_at: s.created_at.unwrap_or_default(),
        updated_at: s.updated_at.unwrap_or_default(),
        article_id: s.article_id.map(|id| id.to_string()),
        message_count: s.message_count,
    }).collect())
}

/// Log action
pub fn log_user_action(conn: &DbConnection, article_id: i64, action_type: &str) -> Result<(), String> {
    log_action(conn, article_id, action_type)
}

/// Delete recent action
pub fn delete_user_action(conn: &DbConnection, article_id: i64, action_type: &str) -> Result<(), String> {
    delete_recent_action(conn, article_id, action_type)
}