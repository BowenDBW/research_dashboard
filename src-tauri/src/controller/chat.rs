// Chat controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::chat::*;
use crate::models::{CreateSessionRequest, FrontendChatSession, FrontendChatMessage};
use tauri::State;

/// Create a new chat session
#[tauri::command]
pub async fn chat_create_session(
    state: State<'_, Arc<AppState>>,
    mode: String,
    article_id: Option<i64>,
    title: Option<String>,
) -> Result<FrontendChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let req = CreateSessionRequest {
        mode,
        article_id,
        title,
    };

    create_chat_session(&conn, &req)
}

/// Get session by ID
#[tauri::command]
pub async fn chat_get_session(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<FrontendChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_chat_session(&conn, session_id)
}

/// Get session messages
#[tauri::command]
pub async fn chat_get_messages(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<Vec<FrontendChatMessage>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_session_messages_list(&conn, session_id)
}

/// Delete a session
#[tauri::command]
pub async fn chat_delete_session(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    delete_chat_session(&conn, session_id)
}

/// Get recent sessions
#[tauri::command]
pub async fn chat_get_sessions(
    state: State<'_, Arc<AppState>>,
    mode: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<FrontendChatSession>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_recent_sessions_list(&conn, mode.as_deref(), limit.unwrap_or(20))
}