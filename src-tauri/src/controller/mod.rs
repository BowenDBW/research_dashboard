// Controller module - Tauri command entry points
// Calls service layer and returns frontend-formatted data

pub mod papers;
pub mod favorites;
pub mod subscriptions;
pub mod history;
pub mod stats;
pub mod chat;
pub mod daily;

// Re-export all command functions for main.rs
pub use papers::{
    papers_list, paper_detail, papers_sources, papers_domains, papers_subscribed,
    papers_delete, papers_update_venue, papers_fetch_arxiv, papers_check_exists,
    papers_add_manual, papers_search_venue, papers_search_publisher, papers_import_arxiv_info,
    papers_update_publication_link, papers_create_venue_full,
};
pub use favorites::{
    favorites_contents, favorites_create_folder, favorites_rename_folder, favorites_delete_folder,
    favorites_move_folder, favorites_add, favorites_remove, favorites_move_paper, favorites_path,
};
pub use subscriptions::{
    subscriptions_get, subscriptions_add_author, subscriptions_remove_author,
    subscriptions_add_category, subscriptions_remove_category,
    subscriptions_add_keyword, subscriptions_remove_keyword,
};
pub use history::{history_reading, history_chat, history_log, history_delete_recent};
pub use stats::{stats_get, stats_today, stats_trend};
pub use chat::{
    chat_create_session, chat_get_session, chat_get_messages, chat_delete_session, chat_get_sessions,
};
pub use daily::{daily_list, daily_detail, daily_recent};