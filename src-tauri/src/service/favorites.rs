// Favorites service - Business logic for favorites operations
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::favorites::*;
use crate::dao::papers::get_paper_by_id;
use crate::models::{FavoriteFolder, FavoritePaper, BreadcrumbItem, FrontendFavoriteFolder, FrontendFavoritePaper, FrontendBreadcrumbItem, FrontendFolderContents, FrontendArticle, FolderStats};

/// Convert database FavoriteFolder to frontend format
impl From<FavoriteFolder> for FrontendFavoriteFolder {
    fn from(folder: FavoriteFolder) -> Self {
        FrontendFavoriteFolder {
            id: folder.folder_id.to_string(),
            parent_id: folder.parent_id.map(|id| id.to_string()),
            name: folder.folder_name,
            created_at: folder.created_at.unwrap_or_default(),
        }
    }
}

/// Convert database FavoritePaper to frontend format
fn favorite_paper_to_frontend(fav: FavoritePaper) -> FrontendFavoritePaper {
    FrontendFavoritePaper {
        id: fav.article_id.to_string(),
        folder_id: fav.folder_id.map(|id| id.to_string()),
        name: fav.article.as_ref().map(|a| a.title.clone()).unwrap_or_default(),
        article: fav.article.map(|p| p.into()),
        created_at: fav.created_at.unwrap_or_default(),
    }
}

/// Convert database BreadcrumbItem to frontend format
impl From<BreadcrumbItem> for FrontendBreadcrumbItem {
    fn from(item: BreadcrumbItem) -> Self {
        FrontendBreadcrumbItem {
            id: item.id.map(|id| id.to_string()),
            name: item.name,
        }
    }
}

/// Get folder contents - returns frontend format
pub fn get_folder_contents_list(conn: &DbConnection, folder_id: Option<i64>) -> Result<FrontendFolderContents, String> {
    let contents = get_folder_contents(conn, folder_id)?;

    Ok(FrontendFolderContents {
        folders: contents.folders.into_iter().map(|f| f.into()).collect(),
        papers: contents.papers.into_iter().map(favorite_paper_to_frontend).collect(),
        path: contents.path.into_iter().map(|p| p.into()).collect(),
    })
}

/// Create folder - returns frontend format
pub fn create_new_folder(conn: &DbConnection, name: &str, parent_id: Option<i64>) -> Result<FrontendFavoriteFolder, String> {
    let folder = create_folder(conn, name, parent_id)?;
    Ok(folder.into())
}

/// Rename folder
pub fn rename_folder_by_id(conn: &DbConnection, folder_id: i64, new_name: &str) -> Result<(), String> {
    rename_folder(conn, folder_id, new_name)
}

/// Delete folder
pub fn delete_folder_by_id(conn: &DbConnection, folder_id: i64) -> Result<(), String> {
    delete_folder(conn, folder_id)
}

/// Move folder
pub fn move_folder_to(conn: &DbConnection, folder_id: i64, new_parent_id: Option<i64>) -> Result<(), String> {
    move_folder(conn, folder_id, new_parent_id)
}

/// Add favorite - returns frontend format
pub fn add_paper_favorite(conn: &DbConnection, article_id: i64, folder_id: Option<i64>) -> Result<FrontendFavoritePaper, String> {
    let fav = add_favorite(conn, article_id, folder_id)?;
    Ok(favorite_paper_to_frontend(fav))
}

/// Remove favorite
pub fn remove_paper_favorite(conn: &DbConnection, article_id: i64) -> Result<(), String> {
    remove_favorite(conn, article_id)
}

/// Move favorite paper
pub fn move_favorite_paper(conn: &DbConnection, article_id: i64, new_folder_id: Option<i64>) -> Result<(), String> {
    move_favorite(conn, article_id, new_folder_id)
}

/// Get folder path - returns frontend format
pub fn get_folder_path_list(conn: &DbConnection, folder_id: Option<i64>) -> Result<Vec<FrontendBreadcrumbItem>, String> {
    let path = get_folder_path(conn, folder_id)?;
    Ok(path.into_iter().map(|p| p.into()).collect())
}

/// Get folder statistics
pub fn get_folder_stats_service(conn: &DbConnection, folder_id: i64) -> Result<FolderStats, String> {
    get_folder_stats(conn, folder_id)
}