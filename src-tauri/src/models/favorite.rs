// Favorite models

use serde::{Deserialize, Serialize};
use super::Paper;

/// Favorite folder entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteFolder {
    pub folder_id: i64,
    pub parent_id: Option<i64>,
    pub folder_name: String,
    pub created_at: Option<String>,
}

/// Favorite paper entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoritePaper {
    pub article_id: i64,
    pub folder_id: Option<i64>,
    pub created_at: Option<String>,
    pub article: Option<Paper>,
}

/// Folder contents response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderContents {
    pub folders: Vec<FavoriteFolder>,
    pub papers: Vec<FavoritePaper>,
    pub path: Vec<BreadcrumbItem>,
}

/// Breadcrumb item for navigation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbItem {
    pub id: Option<i64>,
    pub name: String,
}

/// Folder statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderStats {
    pub subfolder_count: i64,
    pub paper_count: i64,
}