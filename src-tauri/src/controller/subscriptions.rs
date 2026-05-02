// Subscriptions controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::subscriptions::*;
use crate::models::{FrontendSubscriptions, FrontendSubscribedAuthor, FrontendSubscribedCategory, FrontendSubscribedKeyword};
use tauri::State;

/// Get all subscriptions
#[tauri::command]
pub async fn subscriptions_get(
    state: State<'_, Arc<AppState>>,
) -> Result<FrontendSubscriptions, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_all(&conn)
}

/// Add subscribed author
#[tauri::command]
pub async fn subscriptions_add_author(
    state: State<'_, Arc<AppState>>,
    author_name: String,
) -> Result<FrontendSubscribedAuthor, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    add_author(&conn, &author_name)
}

/// Remove subscribed author
#[tauri::command]
pub async fn subscriptions_remove_author(
    state: State<'_, Arc<AppState>>,
    id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    remove_author(&conn, id)
}

/// Add subscribed category
#[tauri::command]
pub async fn subscriptions_add_category(
    state: State<'_, Arc<AppState>>,
    category: String,
) -> Result<FrontendSubscribedCategory, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    add_category(&conn, &category)
}

/// Remove subscribed category
#[tauri::command]
pub async fn subscriptions_remove_category(
    state: State<'_, Arc<AppState>>,
    id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    remove_category(&conn, id)
}

/// Add subscribed keyword
#[tauri::command]
pub async fn subscriptions_add_keyword(
    state: State<'_, Arc<AppState>>,
    keyword: String,
) -> Result<FrontendSubscribedKeyword, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    add_keyword(&conn, &keyword)
}

/// Remove subscribed keyword
#[tauri::command]
pub async fn subscriptions_remove_keyword(
    state: State<'_, Arc<AppState>>,
    id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    remove_keyword(&conn, id)
}