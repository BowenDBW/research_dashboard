// Favorites controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::favorites::*;
use crate::models::{FrontendFolderContents, FrontendFavoriteFolder, FrontendFavoritePaper, FrontendBreadcrumbItem};
use tauri::State;

/// Get folder contents
#[tauri::command]
pub async fn favorites_contents(
    state: State<'_, Arc<AppState>>,
    folder_id: Option<i64>,
) -> Result<FrontendFolderContents, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_folder_contents_list(&conn, folder_id)
}

/// Create a new folder
#[tauri::command]
pub async fn favorites_create_folder(
    state: State<'_, Arc<AppState>>,
    name: String,
    parent_id: Option<i64>,
) -> Result<FrontendFavoriteFolder, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    create_new_folder(&conn, &name, parent_id)
}

/// Rename a folder
#[tauri::command]
pub async fn favorites_rename_folder(
    state: State<'_, Arc<AppState>>,
    folder_id: i64,
    new_name: String,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    rename_folder_by_id(&conn, folder_id, &new_name)
}

/// Delete a folder
#[tauri::command]
pub async fn favorites_delete_folder(
    state: State<'_, Arc<AppState>>,
    folder_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    delete_folder_by_id(&conn, folder_id)
}

/// Move a folder
#[tauri::command]
pub async fn favorites_move_folder(
    state: State<'_, Arc<AppState>>,
    folder_id: i64,
    new_parent_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    move_folder_to(&conn, folder_id, new_parent_id)
}

/// Add paper to favorites
#[tauri::command]
pub async fn favorites_add(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    folder_id: Option<i64>,
) -> Result<FrontendFavoritePaper, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    add_paper_favorite(&conn, article_id, folder_id)
}

/// Remove paper from favorites
#[tauri::command]
pub async fn favorites_remove(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    remove_paper_favorite(&conn, article_id)
}

/// Move favorite paper to another folder
#[tauri::command]
pub async fn favorites_move_paper(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    new_folder_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    move_favorite_paper(&conn, article_id, new_folder_id)
}

/// Get folder path (breadcrumb)
#[tauri::command]
pub async fn favorites_path(
    state: State<'_, Arc<AppState>>,
    folder_id: Option<i64>,
) -> Result<Vec<FrontendBreadcrumbItem>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_folder_path_list(&conn, folder_id)
}