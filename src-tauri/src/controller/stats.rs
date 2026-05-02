// Stats controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::stats::*;
use crate::models::{FrontendStatsResponse, FrontendTodayStats, FrontendTrendItem};
use tauri::State;

/// Get comprehensive statistics
#[tauri::command]
pub async fn stats_get(
    state: State<'_, Arc<AppState>>,
    start_date: String,
    end_date: String,
) -> Result<FrontendStatsResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_statistics(&conn, &start_date, &end_date)
}

/// Get today's quick stats
#[tauri::command]
pub async fn stats_today(
    state: State<'_, Arc<AppState>>,
) -> Result<FrontendTodayStats, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_today_statistics(&conn)
}

/// Get reading trend
#[tauri::command]
pub async fn stats_trend(
    state: State<'_, Arc<AppState>>,
    days: i32,
) -> Result<Vec<FrontendTrendItem>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_reading_trend_data(&conn, days)
}