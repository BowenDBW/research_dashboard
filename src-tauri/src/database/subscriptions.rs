// Subscriptions CRUD operations
// Handles subscribed authors, categories, and keywords

use crate::database::{DbConnection, models::*};
use rusqlite::{params, Row};

/// Get a subscribed author from a database row
fn subscribed_author_from_row(row: &Row) -> Result<SubscribedAuthor, rusqlite::Error> {
    Ok(SubscribedAuthor {
        id: row.get(0)?,
        author_name: row.get(1)?,
        created_at: row.get(2)?,
    })
}

/// Get a subscribed category from a database row
fn subscribed_category_from_row(row: &Row) -> Result<SubscribedCategory, rusqlite::Error> {
    Ok(SubscribedCategory {
        id: row.get(0)?,
        category: row.get(1)?,
        created_at: row.get(2)?,
    })
}

/// Get a subscribed keyword from a database row
fn subscribed_keyword_from_row(row: &Row) -> Result<SubscribedKeyword, rusqlite::Error> {
    Ok(SubscribedKeyword {
        id: row.get(0)?,
        keyword: row.get(1)?,
        created_at: row.get(2)?,
    })
}

/// Get all subscriptions
pub fn get_all_subscriptions(conn: &DbConnection) -> Result<Subscriptions, String> {
    // Get authors
    let authors: Vec<SubscribedAuthor> = conn
        .prepare("SELECT id, author_name, created_at FROM subscribed_authors ORDER BY created_at DESC")
        .map_err(|e| format!("准备查询语句失败: {}", e))?
        .query_map([], subscribed_author_from_row)
        .map_err(|e| format!("查询订阅作者失败: {}", e))?
        .filter_map(|a| a.ok())
        .collect();

    // Get categories
    let categories: Vec<SubscribedCategory> = conn
        .prepare("SELECT id, category, created_at FROM subscribed_categories ORDER BY created_at DESC")
        .map_err(|e| format!("准备查询语句失败: {}", e))?
        .query_map([], subscribed_category_from_row)
        .map_err(|e| format!("查询订阅领域失败: {}", e))?
        .filter_map(|c| c.ok())
        .collect();

    // Get keywords
    let keywords: Vec<SubscribedKeyword> = conn
        .prepare("SELECT id, keyword, created_at FROM subscribed_keywords ORDER BY created_at DESC")
        .map_err(|e| format!("准备查询语句失败: {}", e))?
        .query_map([], subscribed_keyword_from_row)
        .map_err(|e| format!("查询订阅关键词失败: {}", e))?
        .filter_map(|k| k.ok())
        .collect();

    Ok(Subscriptions {
        authors,
        categories,
        keywords,
    })
}

/// Add a subscribed author
pub fn add_subscribed_author(conn: &DbConnection, author_name: &str) -> Result<SubscribedAuthor, String> {
    conn.execute(
        "INSERT INTO subscribed_authors (author_name) VALUES (?)",
        params![author_name]
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            format!("作者 '{}' 已订阅", author_name)
        } else {
            format!("添加订阅作者失败: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, author_name, created_at FROM subscribed_authors WHERE id = ?",
        params![id],
        subscribed_author_from_row
    ).map_err(|e| format!("查询添加的作者失败: {}", e))
}

/// Remove a subscribed author
pub fn remove_subscribed_author(conn: &DbConnection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM subscribed_authors WHERE id = ?",
        params![id]
    ).map_err(|e| format!("删除订阅作者失败: {}", e))?;

    Ok(())
}

/// Add a subscribed category
pub fn add_subscribed_category(conn: &DbConnection, category: &str) -> Result<SubscribedCategory, String> {
    conn.execute(
        "INSERT INTO subscribed_categories (category) VALUES (?)",
        params![category]
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            format!("领域 '{}' 已订阅", category)
        } else {
            format!("添加订阅领域失败: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, category, created_at FROM subscribed_categories WHERE id = ?",
        params![id],
        subscribed_category_from_row
    ).map_err(|e| format!("查询添加的领域失败: {}", e))
}

/// Remove a subscribed category
pub fn remove_subscribed_category(conn: &DbConnection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM subscribed_categories WHERE id = ?",
        params![id]
    ).map_err(|e| format!("删除订阅领域失败: {}", e))?;

    Ok(())
}

/// Add a subscribed keyword
pub fn add_subscribed_keyword(conn: &DbConnection, keyword: &str) -> Result<SubscribedKeyword, String> {
    // Store keyword in lowercase for case-insensitive matching
    let keyword_lower = keyword.to_lowercase();

    conn.execute(
        "INSERT INTO subscribed_keywords (keyword) VALUES (?)",
        params![keyword_lower]
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            format!("关键词 '{}' 已订阅", keyword)
        } else {
            format!("添加订阅关键词失败: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, keyword, created_at FROM subscribed_keywords WHERE id = ?",
        params![id],
        subscribed_keyword_from_row
    ).map_err(|e| format!("查询添加的关键词失败: {}", e))
}

/// Remove a subscribed keyword
pub fn remove_subscribed_keyword(conn: &DbConnection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM subscribed_keywords WHERE id = ?",
        params![id]
    ).map_err(|e| format!("删除订阅关键词失败: {}", e))?;

    Ok(())
}