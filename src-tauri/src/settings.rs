// Settings module - application settings and storage path management
// Handles settings.json, data directory, and related file operations

use std::fs;
use std::path::PathBuf;
use serde_json::Value;
use tauri::Manager;

use crate::llm::{CloudLlmProvider, ConnectionTestResult, test_local_connection};

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
        "selectedModelId": null
    })
}

/// Ensure settings file exists, return settings content
pub fn ensure_settings() -> Result<Value, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        let json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析设置JSON失败: {}", e))?;
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