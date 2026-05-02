// Papers controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::papers::*;
use crate::service::venues::*;
use crate::service::manual_add::*;
use crate::models::{PaperQueryParams, ManualAddRequest, ArxivFetchResult, ManualAddResult, Venue, VenueSearchResult, FrontendPaperListResponse, FrontendArticle};
use tauri::State;

/// Get papers list with filters
#[tauri::command]
pub async fn papers_list(
    state: State<'_, Arc<AppState>>,
    page: i32,
    page_size: i32,
    query: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    sources: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    subscribed_only: Option<bool>,
) -> Result<FrontendPaperListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let params = PaperQueryParams {
        page,
        page_size,
        query,
        start_date,
        end_date,
        sources,
        domains,
        subscribed_only: subscribed_only.unwrap_or(false),
    };

    get_papers_list(&conn, &params)
}

/// Get paper detail by ID
#[tauri::command]
pub async fn paper_detail(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
) -> Result<FrontendArticle, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_paper_detail(&conn, article_id)
}

/// Get all sources (venue names)
#[tauri::command]
pub async fn papers_sources(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_all_sources(&conn)
}

/// Get all categories (domains)
#[tauri::command]
pub async fn papers_domains(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_all_categories(&conn)
}

/// Get subscribed papers
#[tauri::command]
pub async fn papers_subscribed(
    state: State<'_, Arc<AppState>>,
    page: i32,
    page_size: i32,
) -> Result<FrontendPaperListResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_subscribed_papers_list(&conn, page, page_size)
}

/// Delete a paper
#[tauri::command]
pub async fn papers_delete(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    delete_paper_by_id(&conn, article_id)
}

/// Update paper's venue
#[tauri::command]
pub async fn papers_update_venue(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    venue_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    update_paper_venue_by_id(&conn, article_id, venue_id)
}

/// Fetch paper info from arxiv
#[tauri::command]
pub async fn papers_fetch_arxiv(
    preprint_number: String,
) -> Result<ArxivFetchResult, String> {
    fetch_arxiv_info(&preprint_number).await
}

/// Check if paper exists
#[tauri::command]
pub async fn papers_check_exists(
    state: State<'_, Arc<AppState>>,
    title: String,
    preprint_number: Option<String>,
) -> Result<Option<i64>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    check_paper_exists(&conn, &title, preprint_number.as_deref())
}

/// Add paper manually
#[tauri::command]
pub async fn papers_add_manual(
    state: State<'_, Arc<AppState>>,
    request: ManualAddRequest,
    arxiv_data: Option<ArxivFetchResult>,
) -> Result<ManualAddResult, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    add_paper(&conn, &request, arxiv_data.as_ref())
}

/// Search venues
#[tauri::command]
pub async fn papers_search_venue(
    state: State<'_, Arc<AppState>>,
    name: String,
    limit: Option<i32>,
) -> Result<Vec<VenueSearchResult>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    search_venues(&conn, &name, limit.unwrap_or(10))
}

/// Search publishers
#[tauri::command]
pub async fn papers_search_publisher(
    state: State<'_, Arc<AppState>>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<String>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    search_publishers_list(&conn, &query, limit.unwrap_or(10))
}

/// Import arxiv info for existing paper
#[tauri::command]
pub async fn papers_import_arxiv_info(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    arxiv_data: ArxivFetchResult,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    import_arxiv(&conn, article_id, &arxiv_data)
}

/// Update publication link
#[tauri::command]
pub async fn papers_update_publication_link(
    state: State<'_, Arc<AppState>>,
    article_id: i64,
    publication_link: Option<String>,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    update_paper_publication_link(&conn, article_id, publication_link.as_deref())
}

/// Create venue with full info
#[tauri::command]
pub async fn papers_create_venue_full(
    state: State<'_, Arc<AppState>>,
    name: String,
    abbreviation: Option<String>,
    venue_type: Option<String>,
    issn: Option<String>,
    publisher: Option<String>,
) -> Result<Venue, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    create_venue(&conn, &name, abbreviation.as_deref(), venue_type.as_deref(), issn.as_deref(), publisher.as_deref())
}