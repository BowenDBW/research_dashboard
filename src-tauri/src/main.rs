// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

// Module declarations - MVC architecture
mod models;
mod dao;
mod service;
mod controller;
mod llm;
mod settings;
mod layout;
mod crawler;

// Imports
use dao::{DbPool, ensure_database};
use controller::*;
use crawler::{CrawlerHandle, crawler_start, crawler_status, crawler_stop, start_crawl_scheduler};
use settings::{get_settings, save_settings, test_connection, copy_pdf_to_storage, get_pdf_dir, ensure_settings, ensure_pdfs_dir,
    get_disk_usage, get_storage_stats, cleanup_chat_history, cleanup_reading_history, cleanup_articles_and_pdfs, change_pdf_storage_path};
use layout::{get_layout_config, save_layout_config};

// Application state
pub struct AppState {
    pub db_pool: DbPool,
    pub crawler: CrawlerHandle,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn run() {
    // Initialize storage
    settings::ensure_data_dir().expect("Failed to create data directory");
    ensure_pdfs_dir().expect("Failed to create PDFs directory");
    ensure_settings().expect("Failed to initialize settings");

    // Initialize database
    let db_pool = ensure_database().expect("Failed to initialize database");
    let crawler = CrawlerHandle::new();

    // Clone for the scheduler (will be moved into its own thread)
    let scheduler_db_pool = db_pool.clone();
    let scheduler_crawler = crawler.clone();

    let state = Arc::new(AppState { db_pool, crawler });

    // Start the scheduled crawler background task (in its own thread with its own Tokio runtime)
    start_crawl_scheduler(scheduler_db_pool, scheduler_crawler);

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            save_settings,
            test_connection,
            copy_pdf_to_storage,
            get_pdf_dir,
            // Layout
            get_layout_config,
            save_layout_config,
            // Papers
            papers_list,
            paper_detail,
            papers_sources,
            papers_domains,
            papers_subscribed,
            papers_fetch_arxiv,
            papers_check_exists,
            papers_delete,
            papers_update_venue,
            papers_import_arxiv_info,
            papers_update_publication_link,
            papers_create_venue_full,
            papers_add_manual,
            papers_search_venue,
            papers_search_publisher,
            // Favorites
            favorites_contents,
            favorites_create_folder,
            favorites_rename_folder,
            favorites_delete_folder,
            favorites_move_folder,
            favorites_add,
            favorites_remove,
            favorites_move_paper,
            favorites_path,
            // Subscriptions
            subscriptions_get,
            subscriptions_add_author,
            subscriptions_remove_author,
            subscriptions_add_category,
            subscriptions_remove_category,
            subscriptions_add_keyword,
            subscriptions_remove_keyword,
            // Storage stats & cleanup
            get_disk_usage,
            get_storage_stats,
            cleanup_chat_history,
            cleanup_reading_history,
            cleanup_articles_and_pdfs,
            change_pdf_storage_path,
            // History
            history_reading,
            history_chat,
            history_log,
            history_delete_recent,
            // Stats
            stats_get,
            stats_today,
            stats_trend,
            // Chat
            chat_create_session,
            chat_get_session,
            chat_get_messages,
            chat_delete_session,
            chat_get_sessions,
            chat_send_message,
            // Daily
            daily_list,
            daily_detail,
            daily_recent,
            // Crawler
            crawler_start,
            crawler_status,
            crawler_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    // CLI mode: `cargo run -- --crawl` runs crawler standalone (no GUI)
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "--crawl" {
        main_cli_crawl();
        return;
    }

    run()
}

/// Standalone CLI entry for the arxiv crawler (for testing / external scripts)
fn main_cli_crawl() {
    settings::ensure_data_dir().expect("Failed to create data directory");
    settings::ensure_settings().expect("Failed to initialize settings");

    let db_pool = dao::ensure_database().expect("Failed to initialize database");
    let engine = crawler::engine::CrawlerEngine::new();

    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    let result = rt.block_on(engine.run(&db_pool, |progress| {
        // 每爬完一页输出一行进度
        let page_info = if progress.pages_fetched > 0 {
            format!("第 {} 页", progress.pages_fetched)
        } else {
            String::new()
        };
        println!("[{}/{}] {} {} — 累计 {} 篇, 新增 {} 篇",
            progress.subject_index, progress.total_subjects,
            progress.current_subject, page_info,
            progress.articles_found, progress.articles_saved);
    }));

    println!();
    match result {
        Ok(res) => {
            println!("爬取完成: 新增 {} 篇", res.articles_saved);
            if !res.errors.is_empty() {
                for e in &res.errors {
                    eprintln!("[ERROR] {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("爬取失败: {}", e);
            std::process::exit(1);
        }
    }
}
