// Daily controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::daily::*;
use crate::models::{FrontendDailyListResponse, FrontendDailyRecommendationDetail, FrontendDailyRecommendationItem};
use tauri::State;

/// Get daily recommendation list
#[tauri::command]
pub async fn daily_list(
    state: State<'_, Arc<AppState>>,
    page: i32,
    page_size: i32,
    month: Option<String>,
) -> Result<FrontendDailyListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_daily_list(&conn, page, page_size, month.as_deref())
}

/// Get daily recommendation detail by date
#[tauri::command]
pub async fn daily_detail(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<FrontendDailyRecommendationDetail, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_daily_detail(&conn, &date)
}

/// Get recent daily recommendations
#[tauri::command]
pub async fn daily_recent(
    state: State<'_, Arc<AppState>>,
    limit: Option<i32>,
) -> Result<Vec<FrontendDailyRecommendationItem>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_recent_daily(&conn, limit.unwrap_or(7))
}