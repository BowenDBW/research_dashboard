// History controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::history::*;
use crate::models::{HistoryQueryParams, FrontendHistoryListResponse, FrontendChatSession};
use tauri::State;

/// Get reading history
#[tauri::command]
pub async fn history_reading(
    state: State<'_, Arc<AppState>>,
    page: i32,
    page_size: i32,
    start_date: Option<String>,
    end_date: Option<String>,
    actions: Option<Vec<String>>,
) -> Result<FrontendHistoryListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let params = HistoryQueryParams {
        page,
        page_size,
        start_date,
        end_date,
        actions,
        modes: None,
    };

    get_reading_history_list(&conn, &params)
}

/// Get chat history
#[tauri::command]
pub async fn history_chat(
    state: State<'_, Arc<AppState>>,
    page_size: i32,
    start_date: Option<String>,
    end_date: Option<String>,
    modes: Option<Vec<String>>,
) -> Result<Vec<FrontendChatSession>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let params = HistoryQueryParams {
        page: 1,
        page_size,
        start_date,
        end_date,
        actions: None,
        modes,
    };

    get_chat_history_list(&conn, &params)
}

/// Log user action
#[tauri::command]
pub async fn history_log(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    action_type: String,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    log_user_action(&conn, article_id, &action_type)
}

/// Delete recent action (for undo)
#[tauri::command]
pub async fn history_delete_recent(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    action_type: String,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    delete_user_action(&conn, article_id, &action_type)
}