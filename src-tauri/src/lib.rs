// Research Dashboard backend entry point
// Integrates all modules and registers Tauri commands

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

// Module imports
mod database;
mod llm;
mod layout;

use database::{DbPool, ensure_database, models::*};
use database::papers::{get_papers, get_paper_by_id, get_sources, get_categories, get_subscribed_papers};
use database::favorites::{
    get_folder_contents, create_folder, rename_folder, delete_folder, move_folder,
    add_favorite, remove_favorite, move_favorite, get_folder_path
};
use database::subscriptions::{
    get_all_subscriptions, add_subscribed_author, remove_subscribed_author,
    add_subscribed_category, remove_subscribed_category,
    add_subscribed_keyword, remove_subscribed_keyword
};
use database::history::{log_action, get_reading_history, get_chat_history};
use database::stats::{get_stats, get_today_stats, get_reading_trend};
use database::chat::{
    create_session, get_session_by_id, get_session_messages, add_message,
    delete_session, get_recent_sessions, update_session_title
};
use database::daily::{
    get_daily_recommendations, get_daily_recommendation_by_date, get_recent_recommendations
};
use llm::{CloudLlmProvider, ProviderConfig, ConnectionTestResult, test_local_connection};
use layout::{get_layout, save_layout};

// ==========================================
// Application state
// ==========================================

pub struct AppState {
    db_pool: DbPool,
}

// ==========================================
// Helper functions
// ==========================================

/// Get data directory path: ~/.research_dashboard/
fn get_data_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home_dir.join(".research_dashboard"))
}

/// Ensure data directory exists
fn ensure_data_dir() -> Result<PathBuf, String> {
    let data_dir = get_data_dir()?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    Ok(data_dir)
}

/// Get settings file path
fn get_settings_path() -> Result<PathBuf, String> {
    let data_dir = ensure_data_dir()?;
    Ok(data_dir.join("settings.json"))
}

/// Get default settings
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

/// Ensure settings file exists
fn ensure_settings() -> Result<serde_json::Value, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        let json: serde_json::Value = serde_json::from_str(&content)
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

/// Ensure PDF storage directory exists
fn ensure_pdfs_dir() -> Result<PathBuf, String> {
    let data_dir = ensure_data_dir()?;
    let pdfs_dir = data_dir.join("pdfs");
    if !pdfs_dir.exists() {
        fs::create_dir_all(&pdfs_dir)
            .map_err(|e| format!("创建PDF目录失败: {}", e))?;
    }
    Ok(pdfs_dir)
}

// ==========================================
// Settings Tauri Commands
// ==========================================

#[tauri::command]
fn get_settings() -> Result<serde_json::Value, String> {
    ensure_settings()
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let settings_path = get_settings_path()?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn test_connection(provider_id: String, provider_type: String, settings: serde_json::Value) -> Result<ConnectionTestResult, String> {
    match provider_type.as_str() {
        "cloud" => {
            // Find provider in settings
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
            // Find provider in settings
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

// ==========================================
// Layout Tauri Commands
// ==========================================

#[tauri::command]
fn get_layout_config() -> Result<LayoutConfig, String> {
    get_layout()
}

#[tauri::command]
fn save_layout_config(layout: LayoutConfig) -> Result<(), String> {
    save_layout(&layout)
}

// ==========================================
// Papers Tauri Commands
// ==========================================

#[tauri::command]
fn papers_list(state: tauri::State<'_, Arc<AppState>>, params: PaperQueryParams) -> Result<PaperListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_papers(&conn, &params)
}

#[tauri::command]
fn paper_detail(state: tauri::State<'_, Arc<AppState>>, article_id: i64) -> Result<Paper, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_paper_by_id(&conn, article_id)
}

#[tauri::command]
fn papers_sources(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<String>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_sources(&conn)
}

#[tauri::command]
fn papers_domains(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<String>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_categories(&conn)
}

#[tauri::command]
fn papers_subscribed(state: tauri::State<'_, Arc<AppState>>, page: i32, page_size: i32) -> Result<PaperListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_subscribed_papers(&conn, page, page_size)
}

// ==========================================
// Favorites Tauri Commands
// ==========================================

#[tauri::command]
fn favorites_contents(state: tauri::State<'_, Arc<AppState>>, folder_id: Option<i64>) -> Result<FolderContents, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_folder_contents(&conn, folder_id)
}

#[tauri::command]
fn favorites_create_folder(state: tauri::State<'_, Arc<AppState>>, name: String, parent_id: Option<i64>) -> Result<FavoriteFolder, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    create_folder(&conn, &name, parent_id)
}

#[tauri::command]
fn favorites_rename_folder(state: tauri::State<'_, Arc<AppState>>, folder_id: i64, name: String) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    rename_folder(&conn, folder_id, &name)
}

#[tauri::command]
fn favorites_delete_folder(state: tauri::State<'_, Arc<AppState>>, folder_id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    delete_folder(&conn, folder_id)
}

#[tauri::command]
fn favorites_move_folder(state: tauri::State<'_, Arc<AppState>>, folder_id: i64, new_parent_id: Option<i64>) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    move_folder(&conn, folder_id, new_parent_id)
}

#[tauri::command]
fn favorites_add(state: tauri::State<'_, Arc<AppState>>, article_id: i64, folder_id: Option<i64>) -> Result<FavoritePaper, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    add_favorite(&conn, article_id, folder_id)
}

#[tauri::command]
fn favorites_remove(state: tauri::State<'_, Arc<AppState>>, article_id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    remove_favorite(&conn, article_id)
}

#[tauri::command]
fn favorites_move_paper(state: tauri::State<'_, Arc<AppState>>, article_id: i64, new_folder_id: Option<i64>) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    move_favorite(&conn, article_id, new_folder_id)
}

#[tauri::command]
fn favorites_path(state: tauri::State<'_, Arc<AppState>>, folder_id: Option<i64>) -> Result<Vec<BreadcrumbItem>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_folder_path(&conn, folder_id)
}

// ==========================================
// Subscriptions Tauri Commands
// ==========================================

#[tauri::command]
fn subscriptions_get(state: tauri::State<'_, Arc<AppState>>) -> Result<Subscriptions, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_all_subscriptions(&conn)
}

#[tauri::command]
fn subscriptions_add_author(state: tauri::State<'_, Arc<AppState>>, author_name: String) -> Result<SubscribedAuthor, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    add_subscribed_author(&conn, &author_name)
}

#[tauri::command]
fn subscriptions_remove_author(state: tauri::State<'_, Arc<AppState>>, id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    remove_subscribed_author(&conn, id)
}

#[tauri::command]
fn subscriptions_add_category(state: tauri::State<'_, Arc<AppState>>, category: String) -> Result<SubscribedCategory, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    add_subscribed_category(&conn, &category)
}

#[tauri::command]
fn subscriptions_remove_category(state: tauri::State<'_, Arc<AppState>>, id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    remove_subscribed_category(&conn, id)
}

#[tauri::command]
fn subscriptions_add_keyword(state: tauri::State<'_, Arc<AppState>>, keyword: String) -> Result<SubscribedKeyword, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    add_subscribed_keyword(&conn, &keyword)
}

#[tauri::command]
fn subscriptions_remove_keyword(state: tauri::State<'_, Arc<AppState>>, id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    remove_subscribed_keyword(&conn, id)
}

// ==========================================
// History Tauri Commands
// ==========================================

#[tauri::command]
fn history_reading(state: tauri::State<'_, Arc<AppState>>, params: HistoryQueryParams) -> Result<HistoryListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_reading_history(&conn, &params)
}

#[tauri::command]
fn history_chat(state: tauri::State<'_, Arc<AppState>>, params: HistoryQueryParams) -> Result<Vec<ChatSession>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_chat_history(&conn, &params)
}

#[tauri::command]
fn history_log(state: tauri::State<'_, Arc<AppState>>, article_id: i64, action_type: String) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    log_action(&conn, article_id, &action_type)
}

// ==========================================
// Stats Tauri Commands
// ==========================================

#[tauri::command]
fn stats_get(state: tauri::State<'_, Arc<AppState>>, start_date: String, end_date: String) -> Result<StatsResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_stats(&conn, &start_date, &end_date)
}

#[tauri::command]
fn stats_today(state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    let (today_count, total_papers, favorite_count, chat_count) = get_today_stats(&conn)?;
    Ok(serde_json::json!({
        "todayCount": today_count,
        "totalPaperCount": total_papers,
        "favoriteCount": favorite_count,
        "chatCount": chat_count
    }))
}

#[tauri::command]
fn stats_trend(state: tauri::State<'_, Arc<AppState>>, days: i32) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    let trend = get_reading_trend(&conn, days)?;
    Ok(trend.into_iter().map(|(date, count)| {
        serde_json::json!({ "date": date, "count": count })
    }).collect())
}

// ==========================================
// Chat Tauri Commands
// ==========================================

#[tauri::command]
fn chat_create_session(state: tauri::State<'_, Arc<AppState>>, req: CreateSessionRequest) -> Result<ChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    create_session(&conn, &req)
}

#[tauri::command]
fn chat_get_session(state: tauri::State<'_, Arc<AppState>>, session_id: i64) -> Result<ChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_session_by_id(&conn, session_id)
}

#[tauri::command]
fn chat_get_messages(state: tauri::State<'_, Arc<AppState>>, session_id: i64) -> Result<Vec<ChatMessage>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_session_messages(&conn, session_id)
}

#[tauri::command]
fn chat_delete_session(state: tauri::State<'_, Arc<AppState>>, session_id: i64) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    delete_session(&conn, session_id)
}

#[tauri::command]
fn chat_get_sessions(state: tauri::State<'_, Arc<AppState>>, mode: Option<String>, limit: i32) -> Result<Vec<ChatSession>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_recent_sessions(&conn, mode.as_deref(), limit)
}

// ==========================================
// Daily Recommendations Tauri Commands
// ==========================================

#[tauri::command]
fn daily_list(state: tauri::State<'_, Arc<AppState>>, page: i32, page_size: i32, month: Option<String>) -> Result<DailyRecommendationListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_daily_recommendations(&conn, page, page_size, month.as_deref())
}

#[tauri::command]
fn daily_detail(state: tauri::State<'_, Arc<AppState>>, date: String) -> Result<DailyRecommendationDetail, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_daily_recommendation_by_date(&conn, &date)
}

#[tauri::command]
fn daily_recent(state: tauri::State<'_, Arc<AppState>>, limit: i32) -> Result<Vec<DailyRecommendationItem>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    get_recent_recommendations(&conn, limit)
}

// ==========================================
// Application entry point
// ==========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize data directory
    ensure_data_dir().expect("Failed to create data directory");
    ensure_pdfs_dir().expect("Failed to create PDFs directory");
    ensure_settings().expect("Failed to initialize settings");

    // Initialize database
    let db_pool = ensure_database().expect("Failed to initialize database");
    let state = Arc::new(AppState { db_pool });

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            save_settings,
            test_connection,
            // Layout
            get_layout_config,
            save_layout_config,
            // Papers
            papers_list,
            paper_detail,
            papers_sources,
            papers_domains,
            papers_subscribed,
            // Favorites
            favorites_contents,
            favorites_create_folder,
            favorites_rename_folder,
            favorites_delete_folder,
            favorites_move_folder,
            favorites_add,
            favorites_remove,
            favorites_move_paper,
            favorites_path,
            // Subscriptions
            subscriptions_get,
            subscriptions_add_author,
            subscriptions_remove_author,
            subscriptions_add_category,
            subscriptions_remove_category,
            subscriptions_add_keyword,
            subscriptions_remove_keyword,
            // History
            history_reading,
            history_chat,
            history_log,
            // Stats
            stats_get,
            stats_today,
            stats_trend,
            // Chat
            chat_create_session,
            chat_get_session,
            chat_get_messages,
            chat_delete_session,
            chat_get_sessions,
            // Daily
            daily_list,
            daily_detail,
            daily_recent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}