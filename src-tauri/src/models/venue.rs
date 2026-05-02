// Venue models

use serde::{Deserialize, Serialize};

/// Venue (刊会) entity from database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Venue {
    pub venue_id: i64,
    pub name: String,
    pub abbreviation: Option<String>,
    pub issn: Option<String>,
    pub eissn: Option<String>,
    pub venue_type: Option<String>,
    pub publisher: Option<String>,
    pub url: Option<String>,
}

/// Venue ranking (分区) entity
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VenueRanking {
    pub id: i64,
    pub venue_id: i64,
    pub ranking_source: String,
    pub ranking_category: Option<String>,
    pub ranking_year: Option<i32>,
    pub category_detail: Option<String>,
}

/// Venue with rankings (not used)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VenueWithRankings {
    pub venue: Venue,
    pub rankings: Vec<VenueRanking>,
}

/// Venue search result for autocomplete
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VenueSearchResult {
    pub venue_id: i64,
    pub name: String,
    pub abbreviation: Option<String>,
    pub venue_type: Option<String>,
    pub issn: Option<String>,
    pub eissn: Option<String>,
    pub publisher: Option<String>,
    pub rankings: Vec<VenueRanking>,
}