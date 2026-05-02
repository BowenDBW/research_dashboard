// Papers service - Business logic for paper operations
// Converts database entities to frontend-friendly format

use crate::dao::{DbConnection};
use crate::dao::papers::*;
use crate::models::{PaperQueryParams, FrontendPaperListResponse, FrontendArticle};

/// Get papers list with filters - returns frontend format
pub fn get_papers_list(conn: &DbConnection, params: &PaperQueryParams) -> Result<FrontendPaperListResponse, String> {
    let response = get_papers(conn, params)?;

    Ok(FrontendPaperListResponse {
        articles: response.articles.into_iter().map(|p| p.into()).collect(),
        total: response.total,
        page: response.page,
        page_size: response.page_size,
    })
}

/// Get paper detail - returns frontend format
pub fn get_paper_detail(conn: &DbConnection, article_id: i64) -> Result<FrontendArticle, String> {
    let paper = get_paper_by_id(conn, article_id)?;
    Ok(paper.into())
}

/// Get all sources
pub fn get_all_sources(conn: &DbConnection) -> Result<Vec<String>, String> {
    get_sources(conn)
}

/// Get all categories
pub fn get_all_categories(conn: &DbConnection) -> Result<Vec<String>, String> {
    get_categories(conn)
}

/// Get subscribed papers - returns frontend format
pub fn get_subscribed_papers_list(conn: &DbConnection, page: i32, page_size: i32) -> Result<FrontendPaperListResponse, String> {
    let response = get_subscribed_papers(conn, page, page_size)?;

    Ok(FrontendPaperListResponse {
        articles: response.articles.into_iter().map(|p| p.into()).collect(),
        total: response.total,
        page: response.page,
        page_size: response.page_size,
    })
}

/// Delete paper
pub fn delete_paper_by_id(conn: &DbConnection, article_id: i64) -> Result<(), String> {
    delete_paper(conn, article_id)
}

/// Update paper venue
pub fn update_paper_venue_by_id(conn: &DbConnection, article_id: i64, venue_id: Option<i64>) -> Result<(), String> {
    update_paper_venue(conn, article_id, venue_id)
}