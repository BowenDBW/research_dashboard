// Arxiv Crawler Module
// Provides background arXiv crawling via Tauri commands
// Ported from Python arxiv_crawler_light

pub mod engine;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use crate::AppState;
use engine::{CrawlProgress, CrawlerEngine};

/// Crawler state for background task management
#[derive(Clone)]
pub struct CrawlerHandle {
    inner: Arc<Mutex<CrawlerState>>,
}

impl CrawlerHandle {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(CrawlerState {
                progress: CrawlProgress {
                    current_subject: String::new(),
                    subject_index: 0,
                    total_subjects: 0,
                    pages_fetched: 0,
                    articles_found: 0,
                    articles_saved: 0,
                    errors: Vec::new(),
                    is_running: false,
                },
                cancel_flag: false,
            })),
        }
    }
}

struct CrawlerState {
    progress: CrawlProgress,
    cancel_flag: bool,
}

/// Public status info returned to frontend
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlerStatusResponse {
    pub running: bool,
    pub current_subject: String,
    pub subject_index: usize,
    pub total_subjects: usize,
    pub pages_fetched: usize,
    pub articles_found: usize,
    pub articles_saved: usize,
    pub errors: Vec<String>,
}

/// Start the arxiv crawler in background
/// Categories are read from the subscribed_categories table
#[tauri::command]
pub async fn crawler_start(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let handle = &state.crawler;
    {
        let mut inner = handle.inner.lock().map_err(|e| format!("锁获取失败: {}", e))?;
        if inner.progress.is_running {
            return Err("爬虫正在运行中".to_string());
        }
        inner.progress = CrawlProgress {
            current_subject: String::new(),
            subject_index: 0,
            total_subjects: 0,
            pages_fetched: 0,
            articles_found: 0,
            articles_saved: 0,
            errors: Vec::new(),
            is_running: true,
        };
        inner.cancel_flag = false;
    }

    let handle_clone = handle.clone();
    let db_pool = state.db_pool.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let engine = CrawlerEngine::new();
        let result = engine.run(&db_pool, |progress| {
            let mut inner = handle_clone.inner.lock().unwrap();
            // Check cancel flag
            if inner.cancel_flag {
                inner.progress.is_running = false;
                return;
            }
            inner.progress = progress;
        }).await;

        let mut inner = handle_clone.inner.lock().unwrap();
        inner.progress.is_running = false;
        let bubble_msg;
        match result {
            Ok(res) => {
                println!("爬取完成: 新增 {} 篇, 分类: {:?}",
                    res.articles_saved, res.subjects_processed);
                let err_count = res.errors.len();
                if err_count > 0 {
                    inner.progress.errors = res.errors;
                }
                let err_tail = if err_count > 0 {
                    format!("，{} 个学科失败", err_count)
                } else {
                    String::new()
                };
                bubble_msg = format!("新增 {} 篇，处理 {} 个学科{}", res.articles_saved, res.subjects_processed.len(), err_tail);
            }
            Err(e) => {
                bubble_msg = format!("失败：{}", e);
                inner.progress.errors.push(e);
            }
        }
        // 通知前端刷新 lastCrawlTime 等设置
        let _ = app_clone.emit("crawler-finished", ());
        // 弹 app 顶层气泡
        crate::plugin::emit_app_bubble(&app_clone, "arXiv 爬取完成", &bubble_msg, Some("/articles"));
    });

    Ok("爬虫已启动".to_string())
}

/// Get current crawler status
#[tauri::command]
pub async fn crawler_status(
    state: State<'_, Arc<AppState>>,
) -> Result<CrawlerStatusResponse, String> {
    let inner = state.crawler.inner.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    Ok(CrawlerStatusResponse {
        running: inner.progress.is_running,
        current_subject: inner.progress.current_subject.clone(),
        subject_index: inner.progress.subject_index,
        total_subjects: inner.progress.total_subjects,
        pages_fetched: inner.progress.pages_fetched,
        articles_found: inner.progress.articles_found,
        articles_saved: inner.progress.articles_saved,
        errors: inner.progress.errors.clone(),
    })
}

/// Stop the running crawler
#[tauri::command]
pub async fn crawler_stop(
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let mut inner = state.crawler.inner.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    if !inner.progress.is_running {
        return Err("爬虫未在运行".to_string());
    }
    inner.cancel_flag = true;
    Ok("正在停止爬虫...".to_string())
}

impl Default for CrawlerHandle {
    fn default() -> Self {
        Self::new()
    }
}

/// Start the scheduled crawler background task
/// Reads crawlIntervalHours from settings and runs the crawler at that interval
/// When lastCrawlTime is null, crawls immediately after a short delay
pub fn start_crawl_scheduler(db_pool: crate::dao::DbPool, crawler: CrawlerHandle, app: AppHandle) {
    // Spawn a dedicated OS thread with its own Tokio runtime
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create scheduler runtime");
        let app_clone = app.clone();
        rt.block_on(async move {
            // Initial delay before first crawl (let the app fully start)
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

            loop {
                // Read the current interval from settings
                let interval_hours = match crate::settings::ensure_settings() {
                    Ok(settings) => settings["crawlIntervalHours"].as_i64().unwrap_or(4) as u64,
                    Err(_) => 4,
                };

                // Read last crawl time
                let last_crawl = engine::get_last_crawl_date();

                // 计算距离下次爬取还要等多久（秒）。
                // lastCrawlTime 兼容三种格式：完整时间戳 / ISO / 旧版日期，
                // 统一用 engine::parse_last_crawl_time 转成 UTC 时刻计算。
                let wait_secs = if let Some(last) = last_crawl {
                    match engine::parse_last_crawl_time(&last) {
                        Some(last_utc) => {
                            let elapsed = (chrono::Utc::now() - last_utc).num_seconds().max(0) as u64;
                            let interval_secs = interval_hours * 3600;
                            println!("[调度器] 上次爬取: {} (UTC+8), 已过 {} 秒, 间隔: {} 小时", last, elapsed, interval_hours);
                            if elapsed >= interval_secs {
                                println!("[调度器] 已超过间隔, 立即开始爬取");
                                0 // Crawl now
                            } else {
                                let remaining = interval_secs - elapsed;
                                println!("[调度器] 距离下次爬取还有 {} 秒", remaining);
                                remaining // Wait for remaining time
                            }
                        }
                        None => {
                            // 格式无法解析：fail-open，立即爬取一次，成功后会写回正确格式自愈
                            println!("[调度器] 上次爬取时间无法解析 ({}), 立即爬取以修复", last);
                            0
                        }
                    }
                } else {
                    // No last crawl time — crawl immediately
                    println!("[调度器] 首次运行，立即开始爬取");
                    0
                };

                if wait_secs > 0 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;
                }

                // Check if crawler is already running
                let should_run = {
                    let inner = crawler.inner.lock().unwrap();
                    !inner.progress.is_running
                };

                if should_run {
                    println!("[调度器] 开始自动爬取...");
                    let engine = engine::CrawlerEngine::new();
                    let handle_clone = crawler.clone();
                    let pool = db_pool.clone();

                    // Reset progress
                    {
                        let mut inner = crawler.inner.lock().unwrap();
                        inner.progress = engine::CrawlProgress {
                            current_subject: String::new(),
                            subject_index: 0,
                            total_subjects: 0,
                            pages_fetched: 0,
                            articles_found: 0,
                            articles_saved: 0,
                            errors: Vec::new(),
                            is_running: true,
                        };
                        inner.cancel_flag = false;
                    }

                    println!("[调度器] 正在爬取...");
                    let result = engine.run(&pool, |progress| {
                        let mut inner = handle_clone.inner.lock().unwrap();
                        if inner.cancel_flag {
                            inner.progress.is_running = false;
                            return;
                        }
                        inner.progress = progress;
                    }).await;

                    let mut inner = crawler.inner.lock().unwrap();
                    inner.progress.is_running = false;
                    let bubble_msg;
                    match result {
                        Ok(res) => {
                            println!("[调度器] 定时爬取完成: 新增 {} 篇, 分类: {:?}",
                                res.articles_saved, res.subjects_processed);
                            let err_count = res.errors.len();
                            if err_count > 0 {
                                inner.progress.errors = res.errors;
                            }
                            let err_tail = if err_count > 0 {
                                format!("，{} 个学科失败", err_count)
                            } else {
                                String::new()
                            };
                            bubble_msg = format!("新增 {} 篇，处理 {} 个学科{}", res.articles_saved, res.subjects_processed.len(), err_tail);
                        }
                        Err(e) => {
                            println!("[调度器] 爬取失败: {}", e);
                            bubble_msg = format!("失败：{}", e);
                            inner.progress.errors.push(e);
                        }
                    }
                    // 通知前端刷新 lastCrawlTime 等设置
                    let _ = app_clone.emit("crawler-finished", ());
                    // 弹 app 顶层气泡
                    crate::plugin::emit_app_bubble(&app_clone, "arXiv 爬取完成", &bubble_msg, Some("/articles"));
                    // Always sleep after a crawl attempt so the loop doesn't tight-loop on failure.
                    // The next iteration will re-read `lastCrawlTime` from settings (which was
                    // updated by the engine on success) and compute the correct wait duration.
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                } else {
                    // Crawler is running, wait for it to finish before next cycle
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                }
            }
        });
    });
}