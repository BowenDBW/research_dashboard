// Chat controller - Tauri command entry points
// Calls service layer, returns frontend-formatted data

use std::sync::Arc;
use crate::AppState;
use crate::service::chat::*;
use crate::models::{CreateSessionRequest, FrontendChatSession, FrontendChatMessage, SendMessageRequest, SendMessageResponse, AttachPdfResult, FrontendArticle};
use crate::llm::{send_chat_message, generate_session_title, ChatMessage, MessageRole};
use crate::settings::ensure_settings;
use crate::dao::chat::{update_session_title, update_session_context, clear_session_context, get_session_by_id, get_session_context, add_message_article};
use crate::dao::papers::get_paper_by_id;
use crate::service::paper_search;
use crate::dao::DbConnection;
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

/// 解析 PDF 文件文本（较重，放到阻塞线程执行）
async fn parse_pdf_text(file_path: &str) -> Result<String, String> {
    let p = file_path.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        pdf_extract::extract_text(&p).map_err(|e| format!("PDF 解析失败: {}", e))
    }).await.map_err(|e| format!("PDF 解析任务异常: {}", e))?
}

/// 截断过长的文本、存入会话上下文并构造返回结果
fn store_context_and_build_result(
    conn: &DbConnection,
    session_id: i64,
    text: String,
) -> Result<AttachPdfResult, String> {
    // 论文正文可能非常大，避免撑爆数据库和 prompt
    const MAX_CONTEXT_CHARS: usize = 200_000;
    let stored: String = if text.chars().count() > MAX_CONTEXT_CHARS {
        text.chars().take(MAX_CONTEXT_CHARS).collect()
    } else {
        text
    };

    update_session_context(conn, session_id, &stored)?;

    let preview: String = stored.chars().take(200).collect();
    Ok(AttachPdfResult {
        char_count: stored.chars().count() as i64,
        preview,
    })
}

/// 上传并解析文章 PDF，把文本存入会话作为对话上下文。
/// 返回解析出的字符数和前 200 字预览。
#[tauri::command]
pub async fn chat_attach_pdf(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
    file_path: String,
) -> Result<AttachPdfResult, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let path = std::path::PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let text = parse_pdf_text(&file_path).await?;
    store_context_and_build_result(&conn, session_id, text)
}

/// 从库内文章用 arXiv 链接下载 PDF 解析为对话上下文。
/// 解析完成后删除临时 PDF，不占用本地磁盘空间。
#[tauri::command]
pub async fn chat_attach_arxiv(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
    article_id: i64,
) -> Result<AttachPdfResult, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let paper = get_paper_by_id(&conn, article_id)?;
    let arxiv_id = paper.preprint_number.clone()
        .filter(|s| !s.is_empty())
        .ok_or("该文章没有 arXiv 编号，无法下载 PDF")?;

    // 1. 下载 PDF
    let url = format!("https://arxiv.org/pdf/{}", arxiv_id);
    println!("[对话] 下载 arXiv PDF: {}", url);
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| format!("下载 PDF 失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("下载 PDF 失败: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("读取 PDF 失败: {}", e))?;

    // 2. 写到临时文件
    let tmp_name = format!("chat_attach_{}.pdf", arxiv_id.replace(['/', '.'], "_"));
    let tmp_path = std::env::temp_dir().join(tmp_name);
    std::fs::write(&tmp_path, &bytes).map_err(|e| format!("写入临时 PDF 失败: {}", e))?;

    // 3. 解析
    let text = parse_pdf_text(&tmp_path.to_string_lossy()).await?;

    // 4. 用完即删，不占用本地磁盘空间
    let _ = std::fs::remove_file(&tmp_path);

    store_context_and_build_result(&conn, session_id, text)
}

/// 从库内文章自动导入正文作为对话上下文（ASK AI 入口）。
/// 优先使用文章本地 PDF（pdf_path），其次下载 arXiv PDF；两者都没有则报错。
/// 幂等：会话已附加过上下文时直接返回已有内容，避免重复下载/解析。
#[tauri::command]
pub async fn chat_attach_article(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
    article_id: i64,
) -> Result<AttachPdfResult, String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 幂等：已附加过则直接返回，不重复解析
    if let Some(ctx) = get_session_context(&conn, session_id)? {
        if !ctx.trim().is_empty() {
            return Ok(AttachPdfResult {
                char_count: ctx.chars().count() as i64,
                preview: ctx.chars().take(200).collect(),
            });
        }
    }

    let paper = get_paper_by_id(&conn, article_id)?;

    // 1. 优先本地 PDF
    if let Some(pdf_path) = paper.pdf_path.as_deref().filter(|p| !p.is_empty()) {
        let path = std::path::PathBuf::from(pdf_path);
        if path.exists() {
            let text = parse_pdf_text(&path.to_string_lossy()).await?;
            return store_context_and_build_result(&conn, session_id, text);
        }
    }

    // 2. 其次 arXiv 下载
    let arxiv_id = paper.preprint_number.clone()
        .filter(|s| !s.is_empty())
        .ok_or("该文章没有本地 PDF 也没有 arXiv 编号，无法导入正文")?;

    let url = format!("https://arxiv.org/pdf/{}", arxiv_id);
    println!("[对话] 下载 arXiv PDF: {}", url);
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| format!("下载 PDF 失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("下载 PDF 失败: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("读取 PDF 失败: {}", e))?;

    let tmp_name = format!("chat_attach_{}.pdf", arxiv_id.replace(['/', '.'], "_"));
    let tmp_path = std::env::temp_dir().join(tmp_name);
    std::fs::write(&tmp_path, &bytes).map_err(|e| format!("写入临时 PDF 失败: {}", e))?;

    let text = parse_pdf_text(&tmp_path.to_string_lossy()).await?;
    let _ = std::fs::remove_file(&tmp_path);

    store_context_and_build_result(&conn, session_id, text)
}

/// 移除会话附加的文章 PDF 上下文
#[tauri::command]
pub async fn chat_clear_context(
    state: State<'_, Arc<AppState>>,
    session_id: i64,
) -> Result<(), String> {
    let conn = state.db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    clear_session_context(&conn, session_id)
}

/// Send a message and get AI response
/// 根据会话 mode 分发：
///   - "paper_search"：LLM 提取关键词 + BM25 检索，返回可点击的文章列表
///   - 其他（chat）：普通对话；若会话附加了文章 PDF（context_text），文本放到对话开头作为上下文
/// 首条消息时在后台生成会话标题
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

    let session = get_session_by_id(&conn, session_id)?;
    let existing_messages = get_session_messages_list(&conn, session_id)?;
    let is_first_message = existing_messages.is_empty();

    // 保存用户消息（两种模式都要）
    add_message_to_session(&conn, session_id, &SendMessageRequest {
        content: content.clone(),
        model_id: None,
    })?;

    let settings = ensure_settings()?;

    let final_message: FrontendChatMessage;
    let mut result_articles: Vec<FrontendArticle> = Vec::new();

    if session.mode == "paper_search" {
        // ========== 检索模式：LLM 关键词提取 + BM25 ==========
        println!("[对话] 检索模式: {}", content);
        let keywords = paper_search::extract_keywords(&app_handle, &content, &model_id, settings.clone()).await?;
        let hits = paper_search::bm25_search(&conn, &keywords, 10)?;

        let summary = if hits.is_empty() {
            format!("没有找到与「{}」相关的文章，可以换个说法再试。", content)
        } else {
            format!("为你找到 {} 篇相关文章（按相关度和时效排序）：", hits.len())
        };
        let assistant_msg = add_message_to_session(&conn, session_id, &SendMessageRequest {
            content: summary,
            model_id: Some(model_id.clone()),
        })?;

        // 关联检索到的文章到该消息（通过 id 关联 papers，不冗余存储）
        let msg_db_id: i64 = assistant_msg.id.parse().unwrap_or(0);
        for hit in &hits {
            let _ = add_message_article(&conn, msg_db_id, hit.article_id);
        }

        result_articles = hits.into_iter().map(|h| h.paper.into()).collect();
        final_message = assistant_msg;
    } else {
        // ========== 普通对话：可选文章 PDF 上下文 ==========
        let mut llm_messages: Vec<ChatMessage> = Vec::new();

        // 若会话附加了文章 PDF，解析文本放到对话开头作为上下文
        if let Some(ctx) = session.context_text.as_deref() {
            if !ctx.trim().is_empty() {
                let ctx_capped: String = ctx.chars().take(50_000).collect();
                llm_messages.push(ChatMessage {
                    role: MessageRole::System,
                    content: format!(
                        "以下是用户上传的一篇文章的文本内容，请结合它回答用户的问题。\n\n文章文本：\n{}",
                        ctx_capped
                    ),
                });
            }
        }

        // 历史消息
        for m in &existing_messages {
            llm_messages.push(ChatMessage {
                role: match m.role.as_str() {
                    "assistant" => MessageRole::Assistant,
                    _ => MessageRole::User,
                },
                content: m.content.clone(),
            });
        }
        // 当前用户消息
        llm_messages.push(ChatMessage {
            role: MessageRole::User,
            content: content.clone(),
        });

        println!(
            "[对话] 普通对话 (PDF上下文 {} 字符)",
            session.context_text.as_deref().map(|s| s.chars().count()).unwrap_or(0)
        );
        let response = send_chat_message(&app_handle, llm_messages, model_id.clone(), settings.clone()).await?;

        final_message = add_message_to_session(&conn, session_id, &SendMessageRequest {
            content: response,
            model_id: Some(model_id.clone()),
        })?;
    }

    // 首条消息：后台生成会话标题
    if is_first_message {
        let app_handle = app_handle.clone();
        let db_pool = state.db_pool.clone();
        let content_for_title = content.clone();
        let model_id_for_title = model_id.clone();
        let settings_for_title = settings.clone();

        tauri::async_runtime::spawn(async move {
            match generate_session_title(&app_handle, content_for_title, model_id_for_title, settings_for_title).await {
                Ok(title) => {
                    match db_pool.get() {
                        Ok(conn) => {
                            if let Err(e) = update_session_title(&conn, session_id, &title) {
                                eprintln!("Failed to update session title: {}", e);
                            } else {
                                println!("[INFO] Generated session title: {}", title);
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
        message: final_message,
        updated_session_title: None, // Title will be generated in background
        articles: result_articles,
    })
}