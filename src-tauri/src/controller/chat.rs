// Chat controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::chat::*;
use crate::models::{CreateSessionRequest, FrontendChatSession, FrontendChatMessage, SendMessageRequest, SendMessageResponse};
use crate::llm::{send_chat_message, generate_session_title, ChatMessage, MessageRole};
use crate::settings::ensure_settings;
use crate::dao::chat::update_session_title;
use tauri::{State, AppHandle, Emitter};

/// Create a new chat session
#[tauri::command]
pub async fn chat_create_session(
    state: State<'_, Arc<AppState>>,
    mode: String,
    article_id: Option<i64>,
    title: Option<String>,
) -> Result<FrontendChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let req = CreateSessionRequest {
        mode,
        article_id,
        title,
    };

    create_chat_session(&conn, &req)
}

/// Get session by ID
#[tauri::command]
pub async fn chat_get_session(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<FrontendChatSession, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_chat_session(&conn, session_id)
}

/// Get session messages
#[tauri::command]
pub async fn chat_get_messages(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<Vec<FrontendChatMessage>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    get_session_messages_list(&conn, session_id)
}

/// Delete a session
#[tauri::command]
pub async fn chat_delete_session(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    delete_chat_session(&conn, session_id)
}

/// Get recent sessions
#[tauri::command]
pub async fn chat_get_sessions(
    state: State<'_, Arc<AppState>>,
    mode: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<FrontendChatSession>, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let sessions = get_recent_sessions_list(&conn, mode.as_deref(), limit.unwrap_or(20))?;
    Ok(sessions)
}

/// Send a message and get AI response
/// If this is the first message in the session, generates a title in background
#[tauri::command]
pub async fn chat_send_message(
    app_handle: AppHandle,
    state: State<'_, Arc<AppState>>,
    session_id: i64,
    content: String,
    model_id: String,
) -> Result<SendMessageResponse, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // Get existing messages for context
    let existing_messages = get_session_messages_list(&conn, session_id)?;
    let is_first_message = existing_messages.is_empty();

    // Convert to LLM message format
    let mut llm_messages: Vec<ChatMessage> = existing_messages
        .iter()
        .map(|m| ChatMessage {
            role: match m.role.as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            },
            content: m.content.clone(),
        })
        .collect();

    // Add the new user message
    llm_messages.push(ChatMessage {
        role: MessageRole::User,
        content: content.clone(),
    });

    // Get settings for provider configuration
    let settings = ensure_settings()?;

    // Send to LLM
    let response = send_chat_message(&app_handle, llm_messages, model_id.clone(), settings.clone()).await?;

    // Save user message to database
    let user_req = SendMessageRequest {
        content: content.clone(),
        model_id: None,
    };
    add_message_to_session(&conn, session_id, &user_req)?;

    // Save assistant message to database
    let assistant_req = SendMessageRequest {
        content: response.clone(),
        model_id: Some(model_id.clone()),
    };
    let saved_message = add_message_to_session(&conn, session_id, &assistant_req)?;

    // If this is the first message, spawn background task to generate title
    if is_first_message {
        let app_handle = app_handle.clone();
        let db_pool = state.db_pool.clone();
        let content_for_title = content.clone();
        let model_id_for_title = model_id.clone();
        let settings_for_title = settings.clone();

        // Spawn a blocking task that runs in background
        tauri::async_runtime::spawn(async move {
            match generate_session_title(&app_handle, content_for_title, model_id_for_title, settings_for_title).await {
                Ok(title) => {
                    // Update session title in database
                    match db_pool.get() {
                        Ok(conn) => {
                            if let Err(e) = update_session_title(&conn, session_id, &title) {
                                eprintln!("Failed to update session title: {}", e);
                            } else {
                                println!("[INFO] Generated session title: {}", title);
                                // Emit event to frontend to update the session title
                                let _ = app_handle.emit("session-title-updated", serde_json::json!({
                                    "sessionId": session_id.to_string(),
                                    "title": title
                                }));
                            }
                        }
                        Err(e) => eprintln!("Failed to get db connection for title update: {}", e),
                    }
                }
                Err(e) => eprintln!("Failed to generate session title: {}", e),
            }
        });
    }

    Ok(SendMessageResponse {
        message: saved_message,
        updated_session_title: None, // Title will be generated in background
    })
}