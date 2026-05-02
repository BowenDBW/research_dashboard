// Chat Sessions CRUD operations
// Handles all chat-related database operations

use crate::database::{DbConnection, models::*};
use rusqlite::{params, Row};

/// Get a chat session from a database row
fn session_from_row(row: &Row) -> Result<ChatSession, rusqlite::Error> {
    Ok(ChatSession {
        session_id: row.get(0)?,
        title: row.get(1)?,
        mode: row.get(2)?,
        article_id: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        message_count: None,
    })
}

/// Get a chat message from a database row
fn message_from_row(row: &Row) -> Result<ChatMessage, rusqlite::Error> {
    Ok(ChatMessage {
        message_id: row.get(0)?,
        session_id: row.get(1)?,
        role: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
    })
}

/// Create a new chat session
pub fn create_session(conn: &DbConnection, req: &CreateSessionRequest) -> Result<ChatSession, String> {
    let sql = "INSERT INTO chat_sessions (title, mode, article_id) VALUES (?, ?, ?)";

    let title = req.title.clone().unwrap_or_else(|| {
        match req.mode.as_str() {
            "chat" => "新对话".to_string(),
            "paper_search" => "AI搜索推荐".to_string(),
            "chapter_summary" => "章节总结".to_string(),
            _ => "新对话".to_string(),
        }
    });

    conn.execute(sql, params![title, req.mode, req.article_id])
        .map_err(|e| format!("创建会话失败: {}", e))?;

    let session_id = conn.last_insert_rowid();

    // Retrieve the created session
    get_session_by_id(conn, session_id)
}

/// Get a session by ID
pub fn get_session_by_id(conn: &DbConnection, session_id: i64) -> Result<ChatSession, String> {
    let sql = "SELECT session_id, title, mode, article_id, created_at, updated_at
               FROM chat_sessions WHERE session_id = ?";

    conn.query_row(sql, params![session_id], session_from_row)
        .map_err(|e| format!("查询会话失败: {}", e))
}

/// Get all messages for a session
pub fn get_session_messages(conn: &DbConnection, session_id: i64) -> Result<Vec<ChatMessage>, String> {
    let sql = "SELECT message_id, session_id, role, content, created_at
               FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询消息语句失败: {}", e))?;

    let messages: Vec<ChatMessage> = stmt.query_map(params![session_id], message_from_row)
        .map_err(|e| format!("查询消息失败: {}", e))?
        .filter_map(|m| m.ok())
        .collect();

    Ok(messages)
}

/// Add a message to a session
pub fn add_message(conn: &DbConnection, session_id: i64, role: &str, content: &str) -> Result<ChatMessage, String> {
    let sql = "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)";

    conn.execute(sql, params![session_id, role, content])
        .map_err(|e| format!("插入消息失败: {}", e))?;

    let message_id = conn.last_insert_rowid();

    // Update session's updated_at timestamp
    conn.execute(
        "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
        params![session_id]
    ).map_err(|e| format!("更新会话时间失败: {}", e))?;

    // Retrieve the created message
    let sql = "SELECT message_id, session_id, role, content, created_at FROM chat_messages WHERE message_id = ?";
    conn.query_row(sql, params![message_id], message_from_row)
        .map_err(|e| format!("查询创建的消息失败: {}", e))
}

/// Delete a session and all its messages
pub fn delete_session(conn: &DbConnection, session_id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM chat_sessions WHERE session_id = ?", params![session_id])
        .map_err(|e| format!("删除会话失败: {}", e))?;

    Ok(())
}

/// Get recent sessions list
pub fn get_recent_sessions(conn: &DbConnection, mode: Option<&str>, limit: i32) -> Result<Vec<ChatSession>, String> {
    let sql = if mode.is_some() {
        "SELECT s.session_id, s.title, s.mode, s.article_id, s.created_at, s.updated_at,
                COUNT(m.message_id) as message_count
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON s.session_id = m.session_id
         WHERE s.mode = ?
         GROUP BY s.session_id
         ORDER BY s.updated_at DESC
         LIMIT ?"
    } else {
        "SELECT s.session_id, s.title, s.mode, s.article_id, s.created_at, s.updated_at,
                COUNT(m.message_id) as message_count
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON s.session_id = m.session_id
         GROUP BY s.session_id
         ORDER BY s.updated_at DESC
         LIMIT ?"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询会话列表语句失败: {}", e))?;

    let sessions: Vec<ChatSession> = if let Some(m) = mode {
        stmt.query_map(params![m, limit], |row| {
            Ok(ChatSession {
                session_id: row.get(0)?,
                title: row.get(1)?,
                mode: row.get(2)?,
                article_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                message_count: Some(row.get(6)?),
            })
        }).map_err(|e| format!("查询会话列表失败: {}", e))?
        .filter_map(|s| s.ok())
        .collect()
    } else {
        stmt.query_map(params![limit], |row| {
            Ok(ChatSession {
                session_id: row.get(0)?,
                title: row.get(1)?,
                mode: row.get(2)?,
                article_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                message_count: Some(row.get(6)?),
            })
        }).map_err(|e| format!("查询会话列表失败: {}", e))?
        .filter_map(|s| s.ok())
        .collect()
    };

    Ok(sessions)
}

/// Update session title
pub fn update_session_title(conn: &DbConnection, session_id: i64, title: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
        params![title, session_id]
    ).map_err(|e| format!("更新会话标题失败: {}", e))?;

    Ok(())
}