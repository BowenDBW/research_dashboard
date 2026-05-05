// Chat models

use serde::{Deserialize, Serialize};

/// Chat session entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub session_id: i64,
    pub title: Option<String>,
    pub mode: String,
    pub article_id: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub message_count: Option<i64>,
}

/// Chat message entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub message_id: i64,
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: Option<String>,
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub mode: String,
    pub article_id: Option<i64>,
    pub title: Option<String>,
}

/// Send message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub model_id: Option<String>,
}