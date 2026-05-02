// Paper models

use serde::{Deserialize, Serialize};
use super::VenueRanking;

/// Paper entity from database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub article_id: i64,
    pub title: String,
    #[serde(rename = "abstract")]
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub preprint_number: Option<String>,
    pub venue_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_abbreviation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub venue_type: Option<String>,
    pub publication_link: Option<String>,
    pub pdf_link: Option<String>,
    pub pdf_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rankings: Option<Vec<VenueRanking>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub categories: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_favorited: Option<bool>,
}

/// Paper author entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperAuthor {
    pub article_id: i64,
    pub author_name: String,
    pub author_order: i32,
}

/// Paper category entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperCategory {
    pub article_id: i64,
    pub category: String,
}

/// Paper query parameters
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

/// Paper list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperListResponse {
    pub articles: Vec<Paper>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

/// Arxiv fetch result (from arxiv API)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArxivFetchResult {
    pub title: String,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub categories: Vec<String>,
    pub publication_date: Option<String>,
    pub preprint_number: String,
    pub publication_link: Option<String>,
    pub pdf_link: Option<String>,
}

/// Manual add request (from frontend)
#[derive(Debug, Clone, Deserialize)]
pub struct ManualAddRequest {
    pub arxiv_number: Option<String>,
    pub title: Option<String>,
    pub authors: Option<Vec<String>>,
    pub publication_date: Option<String>,
    pub abstract_text: Option<String>,
    pub venue_name: Option<String>,
    pub venue_abbreviation: Option<String>,
    pub venue_type: Option<String>,
    pub venue_issn: Option<String>,
    pub venue_publisher: Option<String>,
    pub venue_id: Option<i64>,
    pub publication_link: Option<String>,
    pub pdf_link: Option<String>,
    pub pdf_file: Option<String>,
    pub categories: Option<Vec<String>>,
}

/// Manual add result (to frontend)
#[derive(Debug, Clone, Serialize)]
pub struct ManualAddResult {
    pub success: bool,
    pub article_id: Option<i64>,
    pub message: String,
    pub duplicate: bool,
}