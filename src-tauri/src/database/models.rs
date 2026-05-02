// Data models for Research Dashboard
// Defines Rust structs corresponding to database tables

use serde::{Deserialize, Serialize};

// ==========================================
// Paper models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub article_id: i64,
    pub title: String,
    #[serde(rename = "abstract")]
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub preprint_number: Option<String>,
    pub publication_venue: Option<String>,
    pub publication_link: Option<String>,
    pub pdf_link: Option<String>,
    pub pdf_path: Option<String>,
    // Joined fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub categories: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_favorited: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperAuthor {
    pub article_id: i64,
    pub author_name: String,
    pub author_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperCategory {
    pub article_id: i64,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaperQueryParams {
    pub page: i32,
    pub page_size: i32,
    pub query: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub sources: Option<Vec<String>>,
    pub domains: Option<Vec<String>>,
    pub subscribed_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperListResponse {
    pub articles: Vec<Paper>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

// ==========================================
// Favorite models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteFolder {
    pub folder_id: i64,
    pub parent_id: Option<i64>,
    pub folder_name: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoritePaper {
    pub article_id: i64,
    pub folder_id: Option<i64>,
    pub created_at: Option<String>,
    // Joined fields
    pub article: Option<Paper>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderContents {
    pub folders: Vec<FavoriteFolder>,
    pub papers: Vec<FavoritePaper>,
    pub path: Vec<BreadcrumbItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbItem {
    pub id: Option<i64>,
    pub name: String,
}

// ==========================================
// Subscription models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedAuthor {
    pub id: i64,
    pub author_name: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedCategory {
    pub id: i64,
    pub category: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedKeyword {
    pub id: i64,
    pub keyword: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscriptions {
    pub authors: Vec<SubscribedAuthor>,
    pub categories: Vec<SubscribedCategory>,
    pub keywords: Vec<SubscribedKeyword>,
}

// ==========================================
// History models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActionLog {
    pub log_id: i64,
    pub article_id: i64,
    pub action_type: String,
    pub created_at: Option<String>,
    // Joined fields
    pub article: Option<Paper>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryQueryParams {
    pub page: i32,
    pub page_size: i32,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub actions: Option<Vec<String>>,
    pub modes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryListResponse {
    pub records: Vec<UserActionLog>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

// ==========================================
// Stats models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingStats {
    pub today_count: i64,
    pub week_count: i64,
    pub month_count: i64,
    pub total_favorites: i64,
    pub total_chats: i64,
    pub avg_daily_count: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyDistribution {
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyHourData {
    pub day: String,
    pub day_index: i32,
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyHourData {
    pub date: String,
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainDistribution {
    pub domain: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordData {
    pub text: String,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapData {
    pub date: String,
    pub count: i64,
    pub level: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsResponse {
    pub reading_stats: ReadingStats,
    pub hourly_distribution: Vec<HourlyDistribution>,
    pub weekly_hour_data: Vec<WeeklyHourData>,
    pub daily_hour_data: Vec<DailyHourData>,
    pub domain_distribution: Vec<DomainDistribution>,
    pub keywords: Vec<KeywordData>,
    pub heatmap_data: Vec<HeatmapData>,
}

// ==========================================
// Chat models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub session_id: i64,
    pub title: Option<String>,
    pub mode: String,
    pub article_id: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub message_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub message_id: i64,
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub mode: String,
    pub article_id: Option<i64>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub model_id: String,
}

// ==========================================
// Daily Recommendation models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendation {
    pub id: i64,
    pub article_id: i64,
    pub source: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationItem {
    pub id: i64,
    pub date: String,
    pub article_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationDetail {
    pub id: i64,
    pub date: String,
    pub article_count: i64,
    pub articles: Vec<Paper>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationListResponse {
    pub items: Vec<DailyRecommendationItem>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

// ==========================================
// Layout models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub panel_order: Vec<String>,
    pub hidden_panels: Vec<String>,
    pub expanded_panels: Vec<String>,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            panel_order: vec![
                "arxiv".to_string(),
                "daily".to_string(),
                "favorites".to_string(),
                "history".to_string(),
                "stats".to_string(),
                "subscription".to_string(),
            ],
            hidden_panels: vec![],
            expanded_panels: vec!["arxiv".to_string()],
        }
    }
}

// ==========================================
// Settings models
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudProvider {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub api_key: String,
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalProvider {
    pub id: String,
    pub name: String,
    pub provider_type: String, // "server" or "mlx"
    pub endpoint: String,
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub model_name: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub crawler_categories: Vec<String>,
    pub crawl_interval_hours: i32,
    pub last_crawl_time: Option<String>,
    pub pdf_storage_path: String,
    pub auto_launch: bool,
    pub cloud_providers: Vec<CloudProvider>,
    pub local_providers: Vec<LocalProvider>,
    pub selected_model_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            crawler_categories: vec![],
            crawl_interval_hours: 4,
            last_crawl_time: None,
            pdf_storage_path: String::new(),
            auto_launch: false,
            cloud_providers: vec![],
            local_providers: vec![],
            selected_model_id: None,
        }
    }
}