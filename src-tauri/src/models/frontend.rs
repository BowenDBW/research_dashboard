// Frontend response models
// These types use camelCase for JSON serialization to match frontend expectations
// Serde's rename_all = "camelCase" automatically converts snake_case to camelCase

use serde::{Deserialize, Serialize};

use super::{VenueRanking, Paper};

// ========== Paper Frontend Types ==========

/// Paper list response for frontend (camelCase JSON)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendPaperListResponse {
    pub articles: Vec<FrontendArticle>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

/// Article for frontend display (camelCase JSON)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendArticle {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub source: String,
    pub source_type: String,
    pub publish_date: String,
    #[serde(rename = "abstract")]
    pub abstract_text: String,
    pub url: String,
    pub pdf_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preprint_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_abbreviation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rankings: Option<Vec<VenueRanking>>,
    pub domains: Vec<String>,
    pub is_favorited: bool,
}

/// Convert database Paper to frontend FrontendArticle
impl From<Paper> for FrontendArticle {
    fn from(paper: Paper) -> Self {
        // 有venue信息显示venue，没有venue但有preprintNumber显示arXiv，否则留空
        let venue_display = paper.venue_abbreviation.clone()
            .or(paper.venue_name.clone())
            .or_else(|| paper.preprint_number.clone().map(|_| "arXiv".to_string()))
            .unwrap_or_default();

        FrontendArticle {
            id: paper.article_id.to_string(),
            title: paper.title,
            authors: paper.authors.unwrap_or_default(),
            source: venue_display,
            source_type: paper.venue_type.clone().unwrap_or_default(),
            publish_date: paper.publication_date.unwrap_or_default(),
            abstract_text: paper.abstract_text.unwrap_or_default(),
            url: paper.publication_link.unwrap_or_default(),
            pdf_url: paper.pdf_link.unwrap_or_default(),
            pdf_path: paper.pdf_path,
            preprint_number: paper.preprint_number,
            venue_id: paper.venue_id,
            venue_name: paper.venue_name,
            venue_abbreviation: paper.venue_abbreviation,
            venue_type: paper.venue_type,
            rankings: paper.rankings,
            domains: paper.categories.unwrap_or_default(),
            is_favorited: paper.is_favorited.unwrap_or(false),
        }
    }
}

// ========== Stats Frontend Types ==========

/// Stats response for frontend (camelCase JSON)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendStatsResponse {
    pub reading_stats: FrontendReadingStats,
    pub hourly_distribution: Vec<FrontendHourlyDistribution>,
    pub weekly_hour_data: Vec<FrontendWeeklyHourData>,
    pub daily_hour_data: Vec<FrontendDailyHourData>,
    pub domain_distribution: Vec<FrontendDomainDistribution>,
    pub keywords: Vec<FrontendKeywordData>,
    pub heatmap_data: Vec<FrontendHeatmapData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendReadingStats {
    // View counts (view_abstract action)
    pub today_count: i64,        // Today's view count
    pub week_count: i64,         // Last 7 days view count
    pub days_30_count: i64,      // Last 30 days view count
    pub month_count: i64,        // This month's view count (calendar month)
    // Read counts (download action)
    pub today_read_count: i64,   // Today's read count
    pub week_read_count: i64,    // Last 7 days read count
    pub days_30_read_count: i64, // Last 30 days read count
    pub month_read_count: i64,   // This month's read count (calendar month)
    // Favorites
    pub week_favorites: i64,     // Last 7 days favorites
    pub days_30_favorites: i64,  // Last 30 days favorites
    pub total_favorites: i64,    // Total favorites
    // Chats
    pub week_chats: i64,         // Last 7 days chats
    pub days_30_chats: i64,      // Last 30 days chats
    pub total_chats: i64,        // Total chats
    // Average
    pub avg_daily_count: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendHourlyDistribution {
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendWeeklyHourData {
    pub day: String,
    pub day_index: i32,
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDailyHourData {
    pub date: String,
    pub hour: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDomainDistribution {
    pub domain: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendKeywordData {
    pub text: String,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendHeatmapData {
    pub date: String,
    pub count: i64,
    pub level: i32,
}

// ========== Today Stats Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendTodayStats {
    pub today_count: i64,
    pub total_paper_count: i64,
    pub favorite_count: i64,
    pub chat_count: i64,
}

// ========== Chat Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendChatSession {
    pub id: String,
    pub title: String,
    pub mode: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub article_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

// ========== Subscription Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendSubscriptions {
    pub authors: Vec<FrontendSubscribedAuthor>,
    pub categories: Vec<FrontendSubscribedCategory>,
    pub keywords: Vec<FrontendSubscribedKeyword>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendSubscribedAuthor {
    pub id: String,
    pub author_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendSubscribedCategory {
    pub id: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendSubscribedKeyword {
    pub id: String,
    pub keyword: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

// ========== Favorite Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendFavoriteFolder {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendFavoritePaper {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub article: Option<FrontendArticle>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendFolderContents {
    pub folders: Vec<FrontendFavoriteFolder>,
    pub papers: Vec<FrontendFavoritePaper>,
    pub path: Vec<FrontendBreadcrumbItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendBreadcrumbItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
}

// ========== History Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendHistoryListResponse {
    pub records: Vec<FrontendHistoryRecord>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendHistoryRecord {
    pub id: String,
    pub article_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub article: Option<FrontendArticle>,
    pub action: String,
    pub timestamp: String,
}

// ========== Daily Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDailyListResponse {
    pub items: Vec<FrontendDailyRecommendationItem>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDailyRecommendationItem {
    pub id: String,
    pub date: String,
    pub article_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDailyRecommendationDetail {
    pub id: String,
    pub date: String,
    pub article_count: i64,
    pub articles: Vec<FrontendArticle>,
    pub created_at: String,
}

// ========== Trend Frontend Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendTrendItem {
    pub date: String,
    pub count: i64,
}