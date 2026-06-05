// Settings module - application settings and storage path management
// Handles settings.json, data directory, and related file operations

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;

use crate::llm::{ConnectionTestResult, test_local_connection};
use crate::llm::cloud::CloudLlmProvider;
use crate::AppState;

// ==========================================
// Storage path management
// ==========================================

/// Get data directory path: ~/.research_dashboard/
pub fn get_data_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home_dir.join(".research_dashboard"))
}

/// Ensure data directory exists, create if not
pub fn ensure_data_dir() -> Result<PathBuf, String> {
    let data_dir = get_data_dir()?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    Ok(data_dir)
}

/// Get settings file path: ~/.research_dashboard/settings.json
pub fn get_settings_path() -> Result<PathBuf, String> {
    Ok(ensure_data_dir()?.join("settings.json"))
}

/// Get layout file path: ~/.research_dashboard/layout.json
pub fn get_layout_path() -> Result<PathBuf, String> {
    Ok(ensure_data_dir()?.join("layout.json"))
}

/// Get PDFs directory path: ~/.research_dashboard/pdfs/
pub fn ensure_pdfs_dir() -> Result<PathBuf, String> {
    let pdfs_dir = ensure_data_dir()?.join("pdfs");
    if !pdfs_dir.exists() {
        fs::create_dir_all(&pdfs_dir)
            .map_err(|e| format!("创建PDF目录失败: {}", e))?;
    }
    Ok(pdfs_dir)
}

/// Get database file path: ~/.research_dashboard/research_dashboard.db
pub fn get_db_path() -> Result<PathBuf, String> {
    Ok(ensure_data_dir()?.join("research_dashboard.db"))
}

/// Get PDF storage path from settings, fallback to default
pub fn get_pdf_storage_path() -> Result<PathBuf, String> {
    let settings = ensure_settings()?;
    let custom_path = settings["pdfStoragePath"].as_str();

    if let Some(path) = custom_path {
        if !path.is_empty() {
            let pdf_path = PathBuf::from(path);
            if !pdf_path.exists() {
                fs::create_dir_all(&pdf_path)
                    .map_err(|e| format!("创建PDF存储目录失败: {}", e))?;
            }
            return Ok(pdf_path);
        }
    }

    // Fallback to default
    ensure_pdfs_dir()
}

// ==========================================
// Settings file operations
// ==========================================

/// Get default settings
fn get_default_settings() -> Value {
    serde_json::json!({
        "crawlerCategories": [],
        "crawlIntervalHours": 4,
        "lastCrawlTime": null,
        "pdfStoragePath": "",
        "autoLaunch": false,
        "cloudProviders": [],
        "localProviders": [],
        "selectedModelId": null,
        "statsCardConfig": {
            "cards": [
                {"id": "view-today-1", "type": "view_today", "enabled": true},
                {"id": "read-today-1", "type": "read_today", "enabled": true},
                {"id": "view-week-1", "type": "view_week", "enabled": true},
                {"id": "read-week-1", "type": "read_week", "enabled": true}
            ],
            "sidebarCards": [
                {"id": "sidebar-view-today-1", "type": "view_today", "enabled": true},
                {"id": "sidebar-favorite-total-1", "type": "favorite_total", "enabled": true}
            ]
        }
    })
}

/// Ensure settings file exists, return settings content with defaults merged
pub fn ensure_settings() -> Result<Value, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        let mut json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析设置JSON失败: {}", e))?;

        // Merge with defaults for any missing fields
        let default = get_default_settings();
        if let (Some(obj), Some(default_obj)) = (json.as_object_mut(), default.as_object()) {
            for (key, value) in default_obj {
                if !obj.contains_key(key) {
                    obj.insert(key.clone(), value.clone());
                }
            }
        }

        Ok(json)
    } else {
        let default = get_default_settings();
        let content = serde_json::to_string_pretty(&default)
            .map_err(|e| format!("序列化设置失败: {}", e))?;
        fs::write(&settings_path, content)
            .map_err(|e| format!("写入设置文件失败: {}", e))?;
        Ok(default)
    }
}

// ==========================================
// Tauri Commands
// ==========================================

#[tauri::command]
pub fn get_settings() -> Result<Value, String> {
    ensure_settings()
}

#[tauri::command]
pub fn save_settings(settings: Value) -> Result<(), String> {
    let settings_path = get_settings_path()?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn test_connection(provider_id: String, provider_type: String, settings: Value) -> Result<ConnectionTestResult, String> {
    match provider_type.as_str() {
        "cloud" => {
            let providers = settings["cloudProviders"].as_array()
                .ok_or("cloudProviders 配置无效")?;
            let provider = providers.iter()
                .find(|p| p["id"] == provider_id)
                .ok_or("找不到 Provider")?;

            let endpoint = provider["endpoint"].as_str()
                .ok_or("endpoint 配置无效")?.to_string();
            let api_key = provider["apiKey"].as_str()
                .ok_or("apiKey 配置无效")?.to_string();

            CloudLlmProvider::test_connection(&endpoint, &api_key).await
        }
        "local" => {
            let providers = settings["localProviders"].as_array()
                .ok_or("localProviders 配置无效")?;
            let provider = providers.iter()
                .find(|p| p["id"] == provider_id)
                .ok_or("找不到 Provider")?;

            let endpoint = provider["endpoint"].as_str()
                .ok_or("endpoint 配置无效")?.to_string();

            test_local_connection(&endpoint).await
        }
        _ => Err("无效的 provider 类型".to_string()),
    }
}

#[tauri::command]
pub fn copy_pdf_to_storage(source_path: String, article_id: i64) -> Result<String, String> {
    let source = PathBuf::from(&source_path);

    // Check source exists
    if !source.exists() {
        return Err("源PDF文件不存在".to_string());
    }

    // Get PDF storage path
    let storage_path = get_pdf_storage_path()?;

    // Generate new filename: article_id_original_name.pdf
    let original_name = source.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf");

    let new_filename = format!("{}_{}", article_id, original_name);
    let dest_path = storage_path.join(&new_filename);

    // Copy file
    fs::copy(&source, &dest_path)
        .map_err(|e| format!("复制PDF文件失败: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_pdf_dir() -> Result<String, String> {
    let path = get_pdf_storage_path()?;
    Ok(path.to_string_lossy().to_string())
}

// ==========================================
// Storage statistics and disk usage
// ==========================================

/// Calculate size of a directory recursively
fn calculate_dir_size(path: &std::path::Path) -> Result<u64, String> {
    let mut total = 0u64;
    if path.is_dir() {
        let entries = fs::read_dir(path)
            .map_err(|e| format!("读取目录失败: {}", e))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            let meta = entry.metadata().map_err(|e| format!("获取文件元数据失败: {}", e))?;
            if meta.is_dir() {
                total += calculate_dir_size(&entry.path())?;
            } else {
                total += meta.len();
            }
        }
    }
    Ok(total)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsage {
    pub total_gb: f64,
    pub free_gb: f64,
    pub app_gb: f64,
}

#[tauri::command]
pub fn get_disk_usage() -> Result<DiskUsage, String> {
    // Calculate app data size
    let data_dir = get_data_dir()?;
    let app_bytes = calculate_dir_size(&data_dir)?;
    let app_gb = (app_bytes as f64) / (1024.0 * 1024.0 * 1024.0);

    // Get total/free disk space on the filesystem where data dir lives
    let (total_gb, free_gb) = if data_dir.exists() {
        let total = fs2::total_space(&data_dir).unwrap_or(0);
        let available = fs2::available_space(&data_dir).unwrap_or(0);
        let total_gb = (total as f64) / (1024.0 * 1024.0 * 1024.0);
        let free_gb = (available as f64) / (1024.0 * 1024.0 * 1024.0);
        (total_gb, free_gb)
    } else {
        (0.0, 0.0)
    };

    Ok(DiskUsage { total_gb, free_gb, app_gb })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySizes {
    pub chat_history_mb: f64,
    pub reading_history_mb: f64,
    pub article_database_mb: f64,
    pub pdf_files_mb: f64,
    pub total_mb: f64,
}

#[tauri::command]
pub fn get_storage_stats(state: tauri::State<'_, std::sync::Arc<AppState>>) -> Result<CategorySizes, String> {
    use std::sync::Arc;

    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // DB file size
    let db_path = get_db_path()?;
    let db_bytes = if db_path.exists() {
        fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    let db_total_mb = (db_bytes as f64) / (1024.0 * 1024.0);

    // PDF directory size
    let pdf_dir = get_pdf_storage_path()?;
    let pdf_bytes = calculate_dir_size(&pdf_dir)?;
    let pdf_mb = (pdf_bytes as f64) / (1024.0 * 1024.0);

    // Estimate per-category sizes within DB by counting rows
    let chat_msg_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM chat_messages", [], |row| row.get(0))
        .unwrap_or(0);
    let chat_session_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM chat_sessions", [], |row| row.get(0))
        .unwrap_or(0);
    let history_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM user_action_logs", [], |row| row.get(0))
        .unwrap_or(0);
    let article_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM papers", [], |row| row.get(0))
        .unwrap_or(0);

    // Estimate: ~1KB per message, ~100B per session, ~200B per history entry
    let chat_estimated = (chat_msg_count as f64 * 1024.0 + chat_session_count as f64 * 100.0)
        / (1024.0 * 1024.0);
    let reading_estimated = (history_count as f64 * 200.0) / (1024.0 * 1024.0);
    // Remaining DB space is articles + overhead
    let article_estimated = if chat_estimated + reading_estimated < db_total_mb {
        db_total_mb - chat_estimated - reading_estimated
    } else {
        // If estimates exceed DB size, just divide proportionally
        let total_count = chat_msg_count + chat_session_count + history_count + article_count;
        if total_count > 0 {
            db_total_mb * (article_count as f64) / (total_count as f64)
        } else {
            db_total_mb
        }
    };

    let total_mb = db_total_mb + pdf_mb;

    Ok(CategorySizes {
        chat_history_mb: (chat_estimated * 100.0).round() / 100.0,
        reading_history_mb: (reading_estimated * 100.0).round() / 100.0,
        article_database_mb: (article_estimated * 100.0).round() / 100.0,
        pdf_files_mb: (pdf_mb * 100.0).round() / 100.0,
        total_mb: (total_mb * 100.0).round() / 100.0,
    })
}

// ==========================================
// Data cleanup
// ==========================================

#[tauri::command]
pub fn cleanup_chat_history(state: tauri::State<'_, std::sync::Arc<AppState>>, months: i64) -> Result<i64, String> {
    use std::sync::Arc;

    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // Delete chat sessions not updated in N months (cascades to messages)
    let affected = conn.execute(
        "DELETE FROM chat_sessions WHERE updated_at < datetime('now', ?)",
        rusqlite::params![format!("-{} months", months)],
    ).map_err(|e| format!("清理聊天记录失败: {}", e))?;

    Ok(affected as i64)
}

#[tauri::command]
pub fn cleanup_reading_history(state: tauri::State<'_, std::sync::Arc<AppState>>, months: i64) -> Result<i64, String> {
    use std::sync::Arc;

    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // Delete old reading history
    let affected = conn.execute(
        "DELETE FROM user_action_logs WHERE created_at < datetime('now', ?)",
        rusqlite::params![format!("-{} months", months)],
    ).map_err(|e| format!("清理阅读记录失败: {}", e))?;

    Ok(affected as i64)
}

#[tauri::command]
pub fn cleanup_articles_and_pdfs(state: tauri::State<'_, std::sync::Arc<AppState>>, months: i64) -> Result<i64, String> {
    use std::sync::Arc;

    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // Find old articles that have PDF files
    let mut stmt = conn.prepare(
        "SELECT article_id, pdf_path FROM papers WHERE publication_date < datetime('now', ?) AND pdf_path IS NOT NULL"
    ).map_err(|e| format!("查询旧文章失败: {}", e))?;

    let old_papers: Vec<(i64, Option<String>)> = stmt.query_map(
        rusqlite::params![format!("-{} months", months)],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("查询旧文章失败: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    // Delete PDF files
    let pdf_dir = get_pdf_storage_path()?;
    for (_, pdf_path_opt) in &old_papers {
        if let Some(pdf_path) = pdf_path_opt {
            let path = std::path::Path::new(pdf_path);
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            // Also try under pdf_dir (for legacy paths)
            if let Some(filename) = path.file_name() {
                let alt_path = pdf_dir.join(filename);
                if alt_path.exists() {
                    let _ = fs::remove_file(&alt_path);
                }
            }
        }
    }

    // Delete the paper records (cascades to favorites, history, etc.)
    let affected = conn.execute(
        "DELETE FROM papers WHERE publication_date < datetime('now', ?)",
        rusqlite::params![format!("-{} months", months)],
    ).map_err(|e| format!("清理文章失败: {}", e))?;

    Ok(affected as i64)
}

// ==========================================
// PDF storage path change
// ==========================================

#[tauri::command]
pub fn change_pdf_storage_path(state: tauri::State<'_, std::sync::Arc<AppState>>, new_path: String) -> Result<(), String> {
    use std::sync::Arc;

    let old_path = get_pdf_storage_path()?;
    let new_path_buf = std::path::PathBuf::from(&new_path);

    // Validate new path
    if !new_path_buf.exists() {
        fs::create_dir_all(&new_path_buf)
            .map_err(|e| format!("创建新目录失败: {}", e))?;
    }

    // Move all files from old to new directory
    if old_path.exists() && old_path != new_path_buf {
        let entries = fs::read_dir(&old_path)
            .map_err(|e| format!("读取旧PDF目录失败: {}", e))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                let filename = entry.file_name();
                let dest = new_path_buf.join(&filename);
                fs::rename(entry.path(), &dest)
                    .or_else(|_| fs::copy(entry.path(), &dest).and_then(|_| fs::remove_file(entry.path())))
                    .map_err(|e| format!("移动文件失败: {}", e))?;
            }
        }
    }

    // Update pdf_path in papers table
    let old_path_str = old_path.to_string_lossy().to_string();
    let new_path_str = new_path_buf.to_string_lossy().to_string();

    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // Update pdf_path for all papers where it starts with the old path
    conn.execute(
        "UPDATE papers SET pdf_path = REPLACE(pdf_path, ?, ?) WHERE pdf_path LIKE ?",
        rusqlite::params![old_path_str, new_path_str, format!("{}%", old_path_str)],
    ).map_err(|e| format!("更新文章PDF路径失败: {}", e))?;

    // Update settings
    let mut settings = ensure_settings()?;
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("pdfStoragePath".to_string(), Value::String(new_path));
    }
    save_settings(settings)?;

    Ok(())
}