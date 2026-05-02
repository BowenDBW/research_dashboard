// History models

use serde::{Deserialize, Serialize};
use super::Paper;

/// User action log entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActionLog {
    pub log_id: i64,
    pub article_id: i64,
    pub action_type: String,
    pub created_at: Option<String>,
    pub article: Option<Paper>,
}

/// History query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryQueryParams {
    pub page: i32,
    pub page_size: i32,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub actions: Option<Vec<String>>,
    pub modes: Option<Vec<String>>,
}

/// History list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryListResponse {
    pub records: Vec<UserActionLog>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}