// Manual add service - Business logic for manual paper operations

use crate::dao::{DbConnection};
use crate::dao::manual_add::*;
use crate::models::{ArxivFetchResult, ManualAddRequest, ManualAddResult};

/// Fetch from arxiv
pub async fn fetch_arxiv_info(preprint_number: &str) -> Result<ArxivFetchResult, String> {
    fetch_from_arxiv(preprint_number).await
}

/// Check paper exists
pub fn check_paper_exists(conn: &DbConnection, title: &str, preprint_number: Option<&str>) -> Result<Option<i64>, String> {
    find_existing_paper(conn, title, preprint_number)
}

/// Add paper manually
pub fn add_paper(conn: &DbConnection, request: &ManualAddRequest, arxiv_data: Option<&ArxivFetchResult>) -> Result<ManualAddResult, String> {
    add_paper_manually(conn, request, arxiv_data)
}

/// Import arxiv info
pub fn import_arxiv(conn: &DbConnection, article_id: i64, arxiv_data: &ArxivFetchResult) -> Result<(), String> {
    import_arxiv_info(conn, article_id, arxiv_data)
}

/// Update publication link
pub fn update_paper_publication_link(conn: &DbConnection, article_id: i64, publication_link: Option<&str>) -> Result<(), String> {
    update_publication_link(conn, article_id, publication_link)
}