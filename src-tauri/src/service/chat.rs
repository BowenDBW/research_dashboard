// Chat service - Business logic for chat operations
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::chat::*;
use crate::models::{CreateSessionRequest, ChatSession, ChatMessage, FrontendChatSession, FrontendChatMessage};

/// Convert database ChatSession to frontend format
fn session_to_frontend(session: ChatSession) -> FrontendChatSession {
    FrontendChatSession {
        id: session.session_id.to_string(),
        title: session.title.unwrap_or_else(|| match session.mode.as_str() {
            "chat" => "新对话".to_string(),
            "paper_search" => "AI搜索推荐".to_string(),
            "chapter_summary" => "章节总结".to_string(),
            _ => "新对话".to_string(),
        }),
        mode: session.mode,
        created_at: session.created_at.unwrap_or_default(),
        updated_at: session.updated_at.unwrap_or_default(),
        article_id: session.article_id.map(|id| id.to_string()),
        message_count: session.message_count,
    }
}

/// Convert database ChatMessage to frontend format
fn message_to_frontend(msg: ChatMessage) -> FrontendChatMessage {
    FrontendChatMessage {
        id: msg.message_id.to_string(),
        session_id: msg.session_id.to_string(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at.unwrap_or_default(),
    }
}

/// Create session - returns frontend format
pub fn create_chat_session(conn: &DbConnection, req: &CreateSessionRequest) -> Result<FrontendChatSession, String> {
    let session = create_session(conn, req)?;
    Ok(session_to_frontend(session))
}

/// Get session - returns frontend format
pub fn get_chat_session(conn: &DbConnection, session_id: i64) -> Result<FrontendChatSession, String> {
    let session = get_session_by_id(conn, session_id)?;
    Ok(session_to_frontend(session))
}

/// Get session messages - returns frontend format
pub fn get_session_messages_list(conn: &DbConnection, session_id: i64) -> Result<Vec<FrontendChatMessage>, String> {
    let messages = get_session_messages(conn, session_id)?;
    Ok(messages.into_iter().map(message_to_frontend).collect())
}

/// Delete session
pub fn delete_chat_session(conn: &DbConnection, session_id: i64) -> Result<(), String> {
    delete_session(conn, session_id)
}

/// Get recent sessions - returns frontend format
pub fn get_recent_sessions_list(conn: &DbConnection, mode: Option<&str>, limit: i32) -> Result<Vec<FrontendChatSession>, String> {
    let sessions = get_recent_sessions(conn, mode, limit)?;
    Ok(sessions.into_iter().map(session_to_frontend).collect())
}