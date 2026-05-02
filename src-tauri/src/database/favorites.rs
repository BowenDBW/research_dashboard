// Favorites CRUD operations
// Handles favorite folders and papers management

use crate::database::{DbConnection, models::*};
use crate::database::papers::get_paper_by_id;
use rusqlite::{params, Row};

/// Get a favorite folder from a database row
fn folder_from_row(row: &Row) -> Result<FavoriteFolder, rusqlite::Error> {
    Ok(FavoriteFolder {
        folder_id: row.get(0)?,
        parent_id: row.get(1)?,
        folder_name: row.get(2)?,
        created_at: row.get(3)?,
    })
}

/// Get a favorite paper from a database row
fn favorite_paper_from_row(row: &Row) -> Result<FavoritePaper, rusqlite::Error> {
    Ok(FavoritePaper {
        article_id: row.get(0)?,
        folder_id: row.get(1)?,
        created_at: row.get(2)?,
        article: None,
    })
}

/// Get folder contents (subfolders and papers)
pub fn get_folder_contents(conn: &DbConnection, folder_id: Option<i64>) -> Result<FolderContents, String> {
    // Get subfolders
    let folder_sql = if folder_id.is_some() {
        "SELECT folder_id, parent_id, folder_name, created_at FROM favorite_folders WHERE parent_id = ? ORDER BY folder_name"
    } else {
        "SELECT folder_id, parent_id, folder_name, created_at FROM favorite_folders WHERE parent_id IS NULL ORDER BY folder_name"
    };

    let mut stmt = conn.prepare(folder_sql)
        .map_err(|e| format!("准备查询文件夹语句失败: {}", e))?;

    let folders: Vec<FavoriteFolder> = if let Some(id) = folder_id {
        stmt.query_map(params![id], folder_from_row)
            .map_err(|e| format!("查询文件夹失败: {}", e))?
            .filter_map(|f| f.ok())
            .collect()
    } else {
        stmt.query_map([], folder_from_row)
            .map_err(|e| format!("查询文件夹失败: {}", e))?
            .filter_map(|f| f.ok())
            .collect()
    };

    // Get favorite papers in this folder
    let papers_sql = if folder_id.is_some() {
        "SELECT fp.article_id, fp.folder_id, fp.created_at
         FROM favorite_papers fp
         WHERE fp.folder_id = ?
         ORDER BY fp.created_at DESC"
    } else {
        "SELECT fp.article_id, fp.folder_id, fp.created_at
         FROM favorite_papers fp
         WHERE fp.folder_id IS NULL
         ORDER BY fp.created_at DESC"
    };

    let mut papers_stmt = conn.prepare(papers_sql)
        .map_err(|e| format!("准备查询收藏语句失败: {}", e))?;

    let fav_papers: Vec<FavoritePaper> = if let Some(id) = folder_id {
        papers_stmt.query_map(params![id], favorite_paper_from_row)
            .map_err(|e| format!("查询收藏失败: {}", e))?
            .filter_map(|f| f.ok())
            .collect()
    } else {
        papers_stmt.query_map([], favorite_paper_from_row)
            .map_err(|e| format!("查询收藏失败: {}", e))?
            .filter_map(|f| f.ok())
            .collect()
    };

    // Fill in article details for each favorite paper
    let mut papers_with_details: Vec<FavoritePaper> = vec![];
    for fav in fav_papers {
        let article = get_paper_by_id(conn, fav.article_id).ok();
        papers_with_details.push(FavoritePaper {
            article_id: fav.article_id,
            folder_id: fav.folder_id,
            created_at: fav.created_at,
            article,
        });
    }

    // Get breadcrumb path
    let path = get_folder_path(conn, folder_id)?;

    Ok(FolderContents {
        folders,
        papers: papers_with_details,
        path,
    })
}

/// Get folder path (breadcrumb)
pub fn get_folder_path(conn: &DbConnection, folder_id: Option<i64>) -> Result<Vec<BreadcrumbItem>, String> {
    let mut path: Vec<BreadcrumbItem> = vec![BreadcrumbItem {
        id: None,
        name: "根目录".to_string(),
    }];

    if folder_id.is_none() {
        return Ok(path);
    }

    // Recursive query to get path from root to this folder
    let sql = "
        WITH RECURSIVE folder_path AS (
            SELECT folder_id, folder_name, parent_id
            FROM favorite_folders
            WHERE folder_id = ?
            UNION ALL
            SELECT f.folder_id, f.folder_name, f.parent_id
            FROM favorite_folders f
            JOIN folder_path fp ON f.folder_id = fp.parent_id
        )
        SELECT folder_id, folder_name FROM folder_path ORDER BY folder_id
    ";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询路径语句失败: {}", e))?;

    let folder_id_val = folder_id.unwrap();
    let path_items: Vec<(i64, String)> = stmt.query_map(params![folder_id_val], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).map_err(|e| format!("查询路径失败: {}", e))?
    .filter_map(|p| p.ok())
    .collect();

    for (id, name) in path_items {
        path.push(BreadcrumbItem {
            id: Some(id),
            name,
        });
    }

    Ok(path)
}

/// Create a new folder
pub fn create_folder(conn: &DbConnection, name: &str, parent_id: Option<i64>) -> Result<FavoriteFolder, String> {
    let sql = "INSERT INTO favorite_folders (parent_id, folder_name) VALUES (?, ?)";

    conn.execute(sql, params![parent_id, name])
        .map_err(|e| format!("创建文件夹失败: {}", e))?;

    let folder_id = conn.last_insert_rowid();

    // Retrieve the created folder
    let sql = "SELECT folder_id, parent_id, folder_name, created_at FROM favorite_folders WHERE folder_id = ?";
    conn.query_row(sql, params![folder_id], folder_from_row)
        .map_err(|e| format!("查询创建的文件夹失败: {}", e))
}

/// Rename a folder
pub fn rename_folder(conn: &DbConnection, folder_id: i64, new_name: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE favorite_folders SET folder_name = ? WHERE folder_id = ?",
        params![new_name, folder_id]
    ).map_err(|e| format!("重命名文件夹失败: {}", e))?;

    Ok(())
}

/// Delete a folder (cascade deletes subfolders and papers)
pub fn delete_folder(conn: &DbConnection, folder_id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM favorite_folders WHERE folder_id = ?",
        params![folder_id]
    ).map_err(|e| format!("删除文件夹失败: {}", e))?;

    Ok(())
}

/// Move a folder to a new parent
pub fn move_folder(conn: &DbConnection, folder_id: i64, new_parent_id: Option<i64>) -> Result<(), String> {
    // Check for circular reference (folder cannot be moved into itself or its descendants)
    if let Some(new_parent) = new_parent_id {
        if new_parent == folder_id {
            return Err("不能将文件夹移动到自身".to_string());
        }

        // Check if new_parent is a descendant of folder_id
        let sql = "
            WITH RECURSIVE descendants AS (
                SELECT folder_id FROM favorite_folders WHERE folder_id = ?
                UNION ALL
                SELECT f.folder_id FROM favorite_folders f
                JOIN descendants d ON f.parent_id = d.folder_id
            )
            SELECT COUNT(*) FROM descendants WHERE folder_id = ?
        ";
        let count: i64 = conn.query_row(sql, params![folder_id, new_parent], |row| row.get(0))
            .map_err(|e| format!("检查循环引用失败: {}", e))?;

        if count > 0 {
            return Err("不能将文件夹移动到其子文件夹中".to_string());
        }
    }

    conn.execute(
        "UPDATE favorite_folders SET parent_id = ? WHERE folder_id = ?",
        params![new_parent_id, folder_id]
    ).map_err(|e| format!("移动文件夹失败: {}", e))?;

    Ok(())
}

/// Add a paper to favorites
pub fn add_favorite(conn: &DbConnection, article_id: i64, folder_id: Option<i64>) -> Result<FavoritePaper, String> {
    // Check if already favorited
    let count_sql = "SELECT COUNT(*) FROM favorite_papers WHERE article_id = ?";
    let count: i64 = conn.query_row(count_sql, params![article_id], |row| row.get(0))
        .map_err(|e| format!("检查收藏状态失败: {}", e))?;

    if count > 0 {
        // Update existing favorite's folder
        conn.execute(
            "UPDATE favorite_papers SET folder_id = ? WHERE article_id = ?",
            params![folder_id, article_id]
        ).map_err(|e| format!("更新收藏位置失败: {}", e))?;
    } else {
        conn.execute(
            "INSERT INTO favorite_papers (article_id, folder_id) VALUES (?, ?)",
            params![article_id, folder_id]
        ).map_err(|e| format!("添加收藏失败: {}", e))?;
    }

    // Retrieve the favorite
    let sql = "SELECT article_id, folder_id, created_at FROM favorite_papers WHERE article_id = ?";
    conn.query_row(sql, params![article_id], favorite_paper_from_row)
        .map_err(|e| format!("查询收藏失败: {}", e))
}

/// Remove a paper from favorites
pub fn remove_favorite(conn: &DbConnection, article_id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM favorite_papers WHERE article_id = ?",
        params![article_id]
    ).map_err(|e| format!("取消收藏失败: {}", e))?;

    Ok(())
}

/// Move a favorite paper to another folder
pub fn move_favorite(conn: &DbConnection, article_id: i64, new_folder_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "UPDATE favorite_papers SET folder_id = ? WHERE article_id = ?",
        params![new_folder_id, article_id]
    ).map_err(|e| format!("移动收藏失败: {}", e))?;

    Ok(())
}