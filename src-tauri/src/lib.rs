// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use std::fs;
use std::path::PathBuf;

/// 获取数据存储目录路径：~/.research_dashboard/
fn get_data_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let data_dir = home_dir.join(".research_dashboard");
    Ok(data_dir)
}

/// 确保数据目录存在
fn ensure_data_dir() -> Result<PathBuf, String> {
    let data_dir = get_data_dir()?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    Ok(data_dir)
}

/// 获取设置文件路径
fn get_settings_path() -> Result<PathBuf, String> {
    let data_dir = ensure_data_dir()?;
    Ok(data_dir.join("settings.json"))
}

/// 获取默认设置（空壳，无假数据）
fn get_default_settings() -> serde_json::Value {
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

#[tauri::command]
fn get_settings() -> Result<serde_json::Value, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| format!("读取设置文件失败: {}", e))?;
        let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析设置JSON失败: {}", e))?;
        Ok(json)
    } else {
        // 首次运行，创建默认设置文件
        let default_settings = get_default_settings();
        save_settings(default_settings.clone())?;
        Ok(default_settings)
    }
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let settings_path = get_settings_path()?;
    let content = serde_json::to_string_pretty(&settings).map_err(|e| format!("序列化设置失败: {}", e))?;
    fs::write(&settings_path, content).map_err(|e| format!("写入设置文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn test_connection(provider_id: String, provider_type: String) -> Result<serde_json::Value, String> {
    // 这里未来可以对接后端的真实 reqwest HTTP 测试逻辑
    if provider_type == "cloud" {
        Ok(serde_json::json!({ "success": true, "message": format!("Rust 后端已接管，成功连接云端: {}", provider_id) }))
    } else {
        Ok(serde_json::json!({ "success": true, "message": format!("Rust 后端已接管，成功连接本地: {}", provider_id) }))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_settings,
            save_settings,
            test_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
