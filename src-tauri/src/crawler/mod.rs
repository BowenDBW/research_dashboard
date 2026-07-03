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