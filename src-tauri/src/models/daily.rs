// Daily recommendation models

use serde::{Deserialize, Serialize};
use super::Paper;

/// Daily recommendation entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendation {
    pub id: i64,
    pub article_id: i64,
    pub source: String,
    pub created_at: Option<String>,
}

/// Daily recommendation list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationItem {
    pub id: i64,
    pub date: String,
    pub article_count: i64,
}

/// Daily recommendation detail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationDetail {
    pub id: i64,
    pub date: String,
    pub article_count: i64,
    pub articles: Vec<Paper>,
    pub created_at: Option<String>,
}

/// Daily recommendation list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationListResponse {
    pub items: Vec<DailyRecommendationItem>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}