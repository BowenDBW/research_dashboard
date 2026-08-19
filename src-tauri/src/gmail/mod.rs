// Gmail Service Module
// Handles Gmail API authentication, email search, and Scholar Alert email parsing

pub mod auth;
pub mod client;
pub mod parser;

use std::sync::{Arc, Mutex};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::AppState;
use crate::models::*;

/// Gmail configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GmailConfig {
    pub email: String,
    pub client_id: String,
    pub client_secret: String,
    pub api_key: String,
    pub sync_interval_hours: i64,
    pub last_sync_time: Option<String>,
}

/// Parsed article from a Scholar Alert email
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedScholarArticle {
    pub title: String,
    pub url: String,
    pub authors_source: String,
    pub arxiv_id: Option<String>,
}

/// Result of parsing a Scholar Alert email
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedScholarEmail {
    pub gmail_message_id: String,
    pub scholar_name: String,
    pub recommended_at: String,
    pub sender_email: String,
    pub subject: String,
    pub raw_snippet: String,
    pub articles: Vec<ParsedScholarArticle>,
}

/// Gmail OAuth status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailAuthStatus {
    pub authorized: bool,
    pub email: String,
}

/// Gmail sync progress (internal shared state for the background task)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailSyncProgress {
    pub running: bool,
    pub total_emails: i32,
    pub processed: i32,
    pub total_articles: i32,
    pub errors: Vec<String>,
    pub message: String,
}

/// Public status info returned to frontend (mirrors CrawlerStatusResponse)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailSyncStatusResponse {
    pub running: bool,
    pub total_emails: i32,
    pub processed: i32,
    pub total_articles: i32,
    pub errors: Vec<String>,
    pub message: String,
}

/// Shared handle for the background Gmail sync task (mirrors CrawlerHandle)
#[derive(Clone)]
pub struct GmailSyncHandle {
    inner: Arc<Mutex<GmailSyncState>>,
}

struct GmailSyncState {
    progress: GmailSyncProgress,
    cancel_flag: bool,
}

impl GmailSyncHandle {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(GmailSyncState {
                progress: GmailSyncProgress {
                    running: false,
                    total_emails: 0,
                    processed: 0,
                    total_articles: 0,
                    errors: Vec::new(),
                    message: String::new(),
                },
                cancel_flag: false,
            })),
        }
    }

    /// Begin a fresh sync: reset progress, mark running, clear cancel flag.
    pub fn begin(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.progress = GmailSyncProgress {
                running: true,
                total_emails: 0,
                processed: 0,
                total_articles: 0,
                errors: Vec::new(),
                message: "正在同步...".to_string(),
            };
            inner.cancel_flag = false;
        }
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().map(|i| i.progress.running).unwrap_or(false)
    }

    pub fn is_cancelled(&self) -> bool {
        self.inner.lock().map(|i| i.cancel_flag).unwrap_or(false)
    }

    pub fn request_cancel(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.cancel_flag = true;
        }
    }

    /// Snapshot of current progress for the frontend.
    pub fn status(&self) -> GmailSyncStatusResponse {
        self.inner.lock().map(|inner| GmailSyncStatusResponse {
            running: inner.progress.running,
            total_emails: inner.progress.total_emails,
            processed: inner.progress.processed,
            total_articles: inner.progress.total_articles,
            errors: inner.progress.errors.clone(),
            message: inner.progress.message.clone(),
        }).unwrap_or(GmailSyncStatusResponse {
            running: false,
            total_emails: 0,
            processed: 0,
            total_articles: 0,
            errors: vec!["同步状态不可用".to_string()],
            message: String::new(),
        })
    }

    /// Update progress fields via a closure. No-op once cancelled.
    pub fn update<F: FnOnce(&mut GmailSyncProgress)>(&self, f: F) {
        if let Ok(mut inner) = self.inner.lock() {
            if inner.cancel_flag {
                return;
            }
            f(&mut inner.progress);
        }
    }

    /// Push a non-fatal error (sync keeps running).
    pub fn push_error(&self, err: String) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.progress.errors.push(err);
        }
    }

    /// Mark sync finished with a final message.
    pub fn finish(&self, message: String) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.progress.running = false;
            inner.progress.message = message;
        }
    }
}

impl Default for GmailSyncHandle {
    fn default() -> Self {
        Self::new()
    }
}

// ==========================================
// Core sync logic (shared by command + scheduler)
// ==========================================

/// Core Gmail sync logic. Updates `handle` live as it processes each email,
/// so the frontend can poll `gmail_sync_status` for real-time progress.
///
/// Single-email failures are collected into `handle` errors and skipped
/// (the whole sync no longer aborts on one bad email).
///
/// Returns `(total_emails, processed, total_articles)` on success.
async fn run_sync(
    db_pool: &crate::dao::DbPool,
    client_id: &str,
    client_secret: &str,
    handle: &GmailSyncHandle,
) -> Result<(i32, i32, i32), String> {
    let conn = db_pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    println!("[Gmail同步] 开始获取访问令牌...");
    let token = crate::gmail::auth::get_access_token(client_id, client_secret).await?;
    println!("[Gmail同步] 访问令牌获取成功");

    let query = "from:scholaralerts-noreply@google.com";
    // 增量窗口用 settings 里的 lastSyncTime（仅在同步成功结束后写入）。
    // 这样同步中断（如 panic/断网）不会把窗口前移，重跑会全量、幂等地补齐。
    let last_sync = crate::settings::ensure_settings().ok()
        .and_then(|s| s.get("gmail").and_then(|g| g.get("lastSyncTime")).and_then(|v| v.as_str()).map(|s| s.to_string()));
    let search_query = match last_sync {
        Some(last) => match chrono::DateTime::parse_from_rfc3339(&last) {
            Ok(dt) => {
                let date_part = (dt + chrono::Duration::hours(8)).format("%Y/%m/%d").to_string();
                println!("[Gmail同步] 上次同步时间: {}, 搜索 {} after:{}", last, query, date_part);
                format!("{} after:{}", query, date_part)
            }
            Err(_) => {
                println!("[Gmail同步] 上次同步时间格式异常: {}, 按 90 天全量搜索", last);
                let three_months_ago = chrono::Utc::now() - chrono::TimeDelta::days(90);
                let date_str = three_months_ago.format("%Y/%m/%d").to_string();
                format!("{} after:{}", query, date_str)
            }
        },
        None => {
            // First run: fetch the last 90 days (≈3 months) of Scholar Alerts
            let three_months_ago = chrono::Utc::now() - chrono::TimeDelta::days(90);
            let date_str = three_months_ago.format("%Y/%m/%d").to_string();
            println!("[Gmail同步] 首次同步, 搜索 {} after:{}", query, date_str);
            format!("{} after:{}", query, date_str)
        }
    };

    println!("[Gmail同步] 正在搜索邮件...");
    // 一次性拉取尽量多的邮件（Gmail API 上限 500），避免首次同步只处理一页
    // 就把增量窗口前移，导致更早的邮件永远不再被处理。
    let search_result = crate::gmail::client::search_messages(&token, &search_query, 500).await?;
    let messages = search_result.messages.unwrap_or_default();
    let total = messages.len() as i32;
    println!("[Gmail同步] 搜索到 {} 封 Scholar Alert 邮件", total);
    let mut processed = 0;
    let mut total_articles = 0;

    handle.update(|p| {
        p.total_emails = total;
        p.processed = 0;
        p.total_articles = 0;
        p.message = if total == 0 {
            "没有找到新的 Scholar Alert 邮件".to_string()
        } else {
            format!("开始处理 {} 封邮件", total)
        };
    });

    for (i, msg) in messages.iter().enumerate() {
        // Respect cancel request between emails
        if handle.is_cancelled() {
            println!("[Gmail同步] 收到取消请求, 停止处理 (已处理 {}/{} 封)", processed, total);
            break;
        }

        println!("[Gmail同步] 处理邮件 {}/{} (ID: {})", i + 1, total, &msg.id);

        // 文章去重由 daily_recommendations 的 UNIQUE(article_id, source) 保证（INSERT OR IGNORE），
        // 邮件级去重依赖增量搜索窗口（after:上次同步日期）。

        println!("[Gmail同步] 获取邮件 {} 详情...", &msg.id);
        let detail = match crate::gmail::client::get_message(&token, &msg.id, "full").await {
            Ok(d) => d,
            Err(e) => {
                println!("[Gmail同步] 获取邮件 {} 失败: {}", &msg.id, e);
                handle.push_error(format!("获取邮件 {} 失败: {}", &msg.id, e));
                processed += 1;
                handle.update(|p| {
                    p.processed = processed;
                    p.message = format!("已处理 {}/{} 封邮件, 提取 {} 篇论文", processed, total, total_articles);
                });
                continue;
            }
        };

        if let Some(ref payload) = detail.payload {
            println!("[Gmail同步] 解析邮件 {} ...", &msg.id);
            match crate::gmail::parser::parse_scholar_email(
                &msg.id, payload, detail.snippet.as_deref().unwrap_or("")
            ) {
                Ok(parsed) => {
                    println!("[Gmail同步] 邮件 {} 解析成功: scholar={}, 推荐 {} 篇论文",
                        &msg.id, &parsed.scholar_name, parsed.articles.len());
                    // 邮件发送日期（UTC+8），推荐分组按它展示；解析失败退回今天
                    let rec_date = crate::gmail::parser::email_send_date(&parsed.recommended_at)
                        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
                    for article in &parsed.articles {
                        // 1. 匹配已有论文（优先 arxiv_id，其次标题）
                        let matched = {
                            let by_arxiv = article.arxiv_id.as_ref()
                                .and_then(|aid| crate::dao::papers::find_paper_by_arxiv(&conn, aid).ok().flatten());
                            if by_arxiv.is_some() {
                                by_arxiv
                            } else {
                                match crate::dao::papers::find_paper_by_title(&conn, &article.title) {
                                    Ok(id_opt) => id_opt,
                                    Err(e) => {
                                        handle.push_error(format!("按标题查询论文失败: {}", e));
                                        None
                                    }
                                }
                            }
                        };

                        // 2. 论文不在主表则录入（只录可用信息，文章本体信息统一放 papers 表）
                        let article_id = match matched {
                            Some(id) => id,
                            None => match create_paper_from_alert(&conn, article) {
                                Ok(Some(id)) => id,
                                Ok(None) => {
                                    println!("[Gmail同步] 文章 \"{}\" 无足够信息, 跳过", article.title);
                                    continue;
                                }
                                Err(e) => {
                                    println!("[Gmail同步] 录入论文失败 \"{}\": {}", article.title, e);
                                    handle.push_error(format!("录入论文失败: {}", e));
                                    continue;
                                }
                            }
                        };

                        // 3. 写入谷歌推荐标记表（纯标记：article_id + source + 邮件日期，INSERT OR IGNORE 去重）
                        match crate::dao::daily::add_daily_recommendation(&conn, article_id, "google", &rec_date) {
                            Ok(_) => {
                                total_articles += 1;
                                println!("[Gmail同步] 已推荐 \"{}\" -> article {}", article.title, article_id);
                            }
                            Err(e) => {
                                println!("[Gmail同步] 写入推荐失败 \"{}\": {}", article.title, e);
                                handle.push_error(format!("写入推荐失败: {}", e));
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("[Gmail同步] 解析邮件 {} 失败: {}", &msg.id, e);
                    handle.push_error(format!("解析邮件 {} 失败: {}", &msg.id, e));
                }
            }
        } else {
            println!("[Gmail同步] 邮件 {} 无payload内容", &msg.id);
        }

        processed += 1;
        handle.update(|p| {
            p.processed = processed;
            p.total_articles = total_articles;
            p.message = format!("已处理 {}/{} 封邮件, 提取 {} 篇论文", processed, total, total_articles);
        });
    }

    println!("[Gmail同步] 处理完成: 共 {} 封邮件, 处理 {} 封, 提取 {} 篇论文", total, processed, total_articles);

    // Update last sync time in settings (counts for partial/cancelled runs too)
    let now = chrono::Utc::now().to_rfc3339();
    if let Ok(mut settings) = crate::settings::ensure_settings() {
        if let Some(obj) = settings.as_object_mut() {
            if let Some(gmail) = obj.get_mut("gmail") {
                if let Some(gmail_obj) = gmail.as_object_mut() {
                    gmail_obj.insert("lastSyncTime".to_string(), serde_json::Value::String(now));
                }
            }
        }
        let _ = crate::settings::save_settings(settings);
    }

    Ok((total, processed, total_articles))
}

/// 将 Scholar Alert 提取的文章录入论文主表（信息不全时只录标题/arxiv/链接）。
/// 返回新论文的 article_id；无足够信息返回 None。
/// 推荐表只做标记，文章本体信息统一存放在 papers 表。
fn create_paper_from_alert(
    conn: &crate::dao::DbConnection,
    article: &ParsedScholarArticle,
) -> Result<Option<i64>, String> {
    if article.title.trim().is_empty() {
        return Ok(None);
    }
    let paper = crate::models::Paper {
        article_id: 0,
        title: article.title.clone(),
        abstract_text: None,
        publication_date: None,
        preprint_number: article.arxiv_id.clone(),
        venue_id: None,
        venue_name: None,
        venue_abbreviation: None,
        venue_type: None,
        publication_link: Some(article.url.clone()),
        pdf_link: article.arxiv_id.as_ref().map(|_| article.url.clone()),
        pdf_path: None,
        rankings: None,
        authors: None,
        categories: None,
        is_favorited: None,
    };
    let id = crate::dao::papers::insert_paper(&conn, &paper)?;
    Ok(Some(id))
}

// ==========================================
// Tauri Commands
// ==========================================

/// Write the authorizedEmail field to settings.json (best-effort).
fn persist_authorized_email(email: &str) {
    if let Ok(mut settings) = crate::settings::ensure_settings() {
        if let Some(obj) = settings.as_object_mut() {
            if let Some(gmail) = obj.get_mut("gmail") {
                if let Some(gmail_obj) = gmail.as_object_mut() {
                    gmail_obj.insert("authorizedEmail".to_string(), serde_json::Value::String(email.to_string()));
                }
            }
        }
        let _ = crate::settings::save_settings(settings);
    }
}

/// Read the recorded authorizedEmail from settings.json ("" if missing).
fn read_authorized_email() -> String {
    crate::settings::ensure_settings()
        .ok()
        .and_then(|s| s.get("gmail").and_then(|g| g.get("authorizedEmail")).and_then(|v| v.as_str()).map(|s| s.to_string()))
        .unwrap_or_default()
}

/// Start Gmail OAuth authorization flow
#[tauri::command]
pub async fn gmail_authorize(client_id: String, client_secret: String) -> Result<GmailAuthStatus, String> {
    let token = crate::gmail::auth::authorize(&client_id, &client_secret).await?;

    let profile = crate::gmail::client::get_profile(&token).await?;
    let email = profile.email_address.unwrap_or_default();

    // Persist the authorized email so auth status doesn't need a live API call,
    // and so we can detect when the user changes the email field afterwards.
    persist_authorized_email(&email);

    Ok(GmailAuthStatus {
        authorized: true,
        email,
    })
}

/// Check Gmail OAuth authorization status.
/// Returns the email recorded at authorize time. If a token exists but no email is recorded
/// (e.g. upgraded from a build that didn't persist authorizedEmail, or a prior get_profile that
/// returned empty due to a serde field-name bug), the email is backfilled once via get_profile
/// so the user doesn't have to re-authorize.
#[tauri::command]
pub async fn gmail_auth_status() -> Result<GmailAuthStatus, String> {
    let has_token = crate::gmail::auth::has_token();
    let mut authorized_email = read_authorized_email();

    // Backfill: token present but email missing -> fetch it once (refreshing the token first if needed)
    if has_token && authorized_email.is_empty() {
        let settings = crate::settings::ensure_settings().ok();
        let cid = settings.as_ref()
            .and_then(|s| s.get("gmail").and_then(|g| g.get("clientId")).and_then(|v| v.as_str()))
            .unwrap_or("");
        let csec = settings.as_ref()
            .and_then(|s| s.get("gmail").and_then(|g| g.get("clientSecret")).and_then(|v| v.as_str()))
            .unwrap_or("");

        if !cid.is_empty() && !csec.is_empty() {
            if let Ok(token) = crate::gmail::auth::get_access_token(cid, csec).await {
                if let Ok(profile) = crate::gmail::client::get_profile(&token).await {
                    if let Some(e) = profile.email_address.filter(|e| !e.is_empty()) {
                        persist_authorized_email(&e);
                        authorized_email = e;
                    }
                }
            }
        }
    }

    let authorized = has_token && !authorized_email.is_empty();

    Ok(GmailAuthStatus {
        authorized,
        email: authorized_email,
    })
}

/// Gmail OAuth logout (delete token + clear recorded email)
#[tauri::command]
pub async fn gmail_logout() -> Result<(), String> {
    crate::gmail::auth::delete_token()?;
    persist_authorized_email("");
    Ok(())
}

/// Start Gmail sync in the background (returns immediately).
/// Mirrors `crawler_start`: the actual work runs in a spawned task and
/// progress is published to the shared `GmailSyncHandle`.
#[tauri::command]
pub async fn gmail_sync(
    state: State<'_, Arc<AppState>>,
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    println!("[Gmail] gmail_sync 命令被调用");
    let handle = &state.gmail;

    if handle.is_running() {
        return Err("Gmail 同步正在运行中".to_string());
    }
    if client_id.trim().is_empty() || client_secret.trim().is_empty() {
        return Err("请先填写 Gmail Client ID 和 Client Secret".to_string());
    }

    handle.begin();

    let handle_clone = handle.clone();
    let db_pool = state.db_pool.clone();

    tokio::spawn(async move {
        println!("[Gmail] 手动同步已启动, 正在后台执行 run_sync...");
        let result = run_sync(&db_pool, &client_id, &client_secret, &handle_clone).await;
        match result {
            Ok((total, processed, articles)) => {
                let error_count = handle_clone.status().errors.len();
                let msg = if handle_clone.is_cancelled() {
                    format!("同步已取消: 已处理 {}/{} 封邮件, 提取 {} 篇论文", processed, total, articles)
                } else if error_count > 0 {
                    format!("同步完成: 处理 {}/{} 封邮件, 提取 {} 篇论文 ({} 个错误)", processed, total, articles, error_count)
                } else {
                    format!("同步完成: 处理 {}/{} 封邮件, 提取 {} 篇论文", processed, total, articles)
                };
                println!("[Gmail] {}", msg);
                handle_clone.finish(msg);
            }
            Err(e) => {
                println!("[Gmail] 同步失败: {}", e);
                handle_clone.finish(format!("同步失败: {}", e));
            }
        }
    });

    Ok("同步已启动".to_string())
}

/// Get current Gmail sync status (polled by the frontend every 2s)
#[tauri::command]
pub async fn gmail_sync_status(
    state: State<'_, Arc<AppState>>,
) -> Result<GmailSyncStatusResponse, String> {
    Ok(state.gmail.status())
}

/// Stop the running Gmail sync (cooperative cancel between emails)
#[tauri::command]
pub async fn gmail_sync_stop(
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    if !state.gmail.is_running() {
        return Err("Gmail 同步未在运行".to_string());
    }
    state.gmail.request_cancel();
    Ok("正在停止 Gmail 同步...".to_string())
}

// ==========================================
// Background Scheduler
// ==========================================

/// Start the Gmail scheduler background task.
/// Reads syncIntervalHours from settings and runs sync at that interval.
/// The scheduler reuses `run_sync` and publishes progress to the shared handle,
/// so scheduled syncs are also visible in the UI.
pub fn start_gmail_scheduler(db_pool: crate::dao::DbPool, handle: GmailSyncHandle) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Gmail scheduler runtime");
        rt.block_on(async move {
            // Initial delay before first sync (let the app fully start)
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

            loop {
                // Read the current interval from settings
                let interval_hours = match crate::settings::ensure_settings() {
                    Ok(settings) => settings["gmail"]["syncIntervalHours"].as_i64().unwrap_or(24) as u64,
                    Err(_) => 24,
                };

                // Read last sync time
                let last_sync_time = match crate::settings::ensure_settings() {
                    Ok(settings) => settings["gmail"]["lastSyncTime"].as_str().map(|s| s.to_string()),
                    Err(_) => None,
                };

                let wait_secs = if let Some(ref last) = last_sync_time {
                    if let Ok(last_dt) = chrono::DateTime::parse_from_rfc3339(last).map(|d| d.with_timezone(&chrono::Utc)) {
                        let elapsed = (chrono::Utc::now() - last_dt).num_seconds().max(0) as u64;
                        let interval_secs = interval_hours * 3600;
                        if elapsed >= interval_secs {
                            println!("[Gmail调度器] 上次同步 {} ({} 秒前), 已超过间隔 {} 小时, 立即同步", last, elapsed, interval_hours);
                            0
                        } else {
                            let remaining = interval_secs - elapsed;
                            println!("[Gmail调度器] 上次同步 {} ({} 秒前), 距下次同步还需 {} 秒", last, elapsed, remaining);
                            remaining
                        }
                    } else {
                        println!("[Gmail调度器] 上次同步时间格式异常: {}, 等待完整间隔 {} 小时", last, interval_hours);
                        interval_hours * 3600
                    }
                } else {
                    println!("[Gmail调度器] 从未同步过, 立即开始同步");
                    0
                };

                if wait_secs > 0 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;
                }

                // Skip if a sync is already running (e.g. a manual sync is in progress)
                if handle.is_running() {
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                    continue;
                }

                // Read credentials from settings
                let (client_id, client_secret) = match crate::settings::ensure_settings() {
                    Ok(settings) => {
                        let gmail = match settings.get("gmail") {
                            Some(g) => g,
                            None => {
                                tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                                continue;
                            }
                        };
                        let cid = gmail.get("clientId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let csec = gmail.get("clientSecret").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        (cid, csec)
                    }
                    Err(_) => {
                        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                        continue;
                    }
                };

                // Not configured or not authorized yet - wait and retry
                if client_id.is_empty() || client_secret.is_empty() || !auth::has_token() {
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                    continue;
                }

                println!("[Gmail调度器] 开始自动同步...");
                handle.begin();
                let result = run_sync(&db_pool, &client_id, &client_secret, &handle).await;
                match result {
                    Ok((total, processed, articles)) => {
                        let msg = if handle.is_cancelled() {
                            format!("[Gmail调度器] 同步已取消: 处理 {}/{} 封, 提取 {} 篇", processed, total, articles)
                        } else {
                            format!("[Gmail调度器] 同步完成: 处理 {}/{} 封, 提取 {} 篇", processed, total, articles)
                        };
                        println!("{}", msg);
                        handle.finish(msg);
                    }
                    Err(e) => {
                        println!("[Gmail调度器] 同步失败: {}", e);
                        handle.finish(format!("同步失败: {}", e));
                    }
                }

                // Brief pause before next cycle check
                tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            }
        });
    });
}
