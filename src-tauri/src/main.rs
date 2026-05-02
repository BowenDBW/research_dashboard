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

// Imports
use dao::{DbPool, ensure_database};
use controller::*;
use settings::{get_settings, save_settings, test_connection, copy_pdf_to_storage, get_pdf_dir, ensure_settings, ensure_pdfs_dir};
use layout::{get_layout_config, save_layout_config};

// Application state
pub struct AppState {
    pub db_pool: DbPool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn run() {
    // Initialize storage
    settings::ensure_data_dir().expect("Failed to create data directory");
    ensure_pdfs_dir().expect("Failed to create PDFs directory");
    ensure_settings().expect("Failed to initialize settings");

    // Initialize database
    let db_pool = ensure_database().expect("Failed to initialize database");
    let state = Arc::new(AppState { db_pool });

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            // Daily
            daily_list,
            daily_detail,
            daily_recent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}