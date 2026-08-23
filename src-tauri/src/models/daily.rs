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

/// 一天内的一封来源邮件（Scholar Alert）及其推荐的文章。
/// 前端用它把邮件标题作为小标题放在这一批文章上方。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationGroup {
    /// 邮件标题（如 "2 new related researches to John"）；旧数据无邮件信息时为 ""。
    pub email_subject: String,
    pub articles: Vec<Paper>,
}

/// Daily recommendation detail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecommendationDetail {
    pub id: i64,
    pub date: String,
    pub article_count: i64,
    pub groups: Vec<DailyRecommendationGroup>,
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