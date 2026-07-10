// Arxiv Crawler Module
// Provides background arXiv crawling via Tauri commands
// Ported from Python arxiv_crawler_light

pub mod engine;

use std::sync::{Arc, Mutex};
use tauri::State;

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
        match result {
            Ok(res) => {
                println!("爬取完成: 新增 {} 篇, 分类: {:?}",
                    res.articles_saved, res.subjects_processed);
                if !res.errors.is_empty() {
                    inner.progress.errors = res.errors;
                }
                // Don't set last error as a success message, keep progress clean
            }
            Err(e) => {
                inner.progress.errors.push(e);
            }
        }
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
pub fn start_crawl_scheduler(db_pool: crate::dao::DbPool, crawler: CrawlerHandle) {
    // Spawn a dedicated OS thread with its own Tokio runtime
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create scheduler runtime");
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

                // Calculate how long to wait before next crawl
                let wait_secs = if let Some(last) = last_crawl {
                    // Try to parse the last crawl time and calculate remaining time
                    // The format is "YYYY-MM-DD" or ISO format
                    if let Ok(last_dt) = chrono::NaiveDate::parse_from_str(&last, "%Y-%m-%d") {
                        let last_datetime = last_dt.and_hms_opt(0, 0, 0).unwrap();
                        let now = chrono::Utc::now().naive_utc();
                        let elapsed = (now - last_datetime).num_seconds().max(0) as u64;
                        let interval_secs = interval_hours * 3600;
                        if elapsed >= interval_secs {
                            0 // Crawl now
                        } else {
                            interval_secs - elapsed // Wait for remaining time
                        }
                    } else {
                        interval_hours * 3600 // Fallback to full interval
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
                    match result {
                        Ok(res) => {
                            println!("[调度器] 定时爬取完成: 新增 {} 篇, 分类: {:?}",
                                res.articles_saved, res.subjects_processed);
                            if !res.errors.is_empty() {
                                inner.progress.errors = res.errors;
                            }
                        }
                        Err(e) => {
                            inner.progress.errors.push(e);
                        }
                    }
                } else {
                    // Crawler is running, wait for it to finish before next cycle
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                }
            }
        });
    });
}