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
mod gmail;

// Imports
use dao::{DbPool, ensure_database};
use controller::*;
use crawler::{CrawlerHandle, crawler_start, crawler_status, crawler_stop, start_crawl_scheduler};
use settings::{get_settings, save_settings, test_connection, copy_pdf_to_storage, get_pdf_dir, ensure_settings, ensure_pdfs_dir,
    get_disk_usage, get_storage_stats, cleanup_chat_history, cleanup_reading_history, cleanup_articles_and_pdfs, change_pdf_storage_path,
    get_close_behavior, save_close_behavior, sync_autostart, CloseBehavior};
use layout::{get_layout_config, save_layout_config};
use service::data_transfer::{export_database, import_database};
use gmail::{
    GmailSyncHandle, gmail_authorize, gmail_auth_status, gmail_logout, gmail_sync,
    gmail_sync_status, gmail_sync_stop,
    start_gmail_scheduler,
};

// 托盘、窗口关闭事件与对话框
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult};

// Application state
pub struct AppState {
    pub db_pool: DbPool,
    pub crawler: CrawlerHandle,
    pub gmail: GmailSyncHandle,
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
    let gmail = GmailSyncHandle::new();

    // Clone for the schedulers (will be moved into their own threads)
    let scheduler_db_pool = db_pool.clone();
    let scheduler_crawler = crawler.clone();
    let gmail_scheduler_db_pool = db_pool.clone();
    let gmail_scheduler_handle = gmail.clone();

    let state = Arc::new(AppState { db_pool, crawler, gmail });

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_handle = app.handle().clone();
            // 创建系统托盘图标（始终显示，用于最小化到托盘后恢复窗口 / 退出应用）
            setup_tray(app)?;
            // 开机自启动状态同步（三平台生效）：保证 settings.json 的
            // autoLaunch 与系统实际自启动状态一致（防止用户手动改动或设置未生效）
            if let Ok(settings) = settings::ensure_settings() {
                let auto = settings["autoLaunch"].as_bool().unwrap_or(false);
                settings::sync_autostart(app.handle(), auto);
            }
            // Start the scheduled crawler background task
            start_crawl_scheduler(scheduler_db_pool, scheduler_crawler, app_handle.clone());
            // Start the Gmail scheduler background task
            start_gmail_scheduler(gmail_scheduler_db_pool, gmail_scheduler_handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // 拦截窗口关闭请求，根据 closeBehavior 决定退出 / 最小化到托盘 / 询问
            if let WindowEvent::CloseRequested { api, .. } = event {
                handle_close_request(window, api);
            }
        })
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
            // Data import/export
            export_database,
            import_database,
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
            chat_attach_pdf,
            chat_attach_arxiv,
            chat_clear_context,
            // Daily
            daily_list,
            daily_detail,
            daily_recent,
            // Crawler
            crawler_start,
            crawler_status,
            crawler_stop,
            // Gmail
            gmail_authorize,
            gmail_auth_status,
            gmail_logout,
            gmail_sync,
            gmail_sync_status,
            gmail_sync_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 创建系统托盘图标与菜单。
/// 托盘始终显示：窗口最小化到托盘后可点击托盘恢复；菜单提供"显示主窗口 / 退出"。
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray-show", "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut tray_builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Research Dashboard")
        .menu(&menu)
        .show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }
    let _tray = tray_builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => show_main_window(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 左键单击托盘图标：显示主窗口
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// 显示主窗口并聚焦
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// 处理窗口关闭请求（点 X）：
/// - closeBehavior = exit：显式退出（macOS 上关闭窗口不会退出进程，需显式 exit）
/// - closeBehavior = minimize：隐藏窗口，应用保活（可经托盘恢复）
/// - closeBehavior 未设置（null/缺失）：弹框询问，选择后记住到配置
fn handle_close_request(window: &tauri::Window, api: &tauri::CloseRequestApi) {
    let app = window.app_handle().clone();
    match get_close_behavior() {
        CloseBehavior::Exit => {
            api.prevent_close();
            app.exit(0);
        }
        CloseBehavior::Minimize => {
            api.prevent_close();
            let _ = window.hide();
        }
        CloseBehavior::Ask => {
            api.prevent_close();
            let win = window.clone();
            app.dialog()
                .message("关闭窗口时要退出应用，还是最小化到系统托盘继续后台运行？")
                .title("关闭行为")
                .kind(MessageDialogKind::Info)
                .buttons(MessageDialogButtons::YesNoCancelCustom(
                    "退出".into(),
                    "最小化到托盘".into(),
                    "取消".into(),
                ))
                .show_with_result(move |result| match result {
                    // 注意：YesNoCancelCustom 在三个平台返回的都是 Custom(按钮文本)，
                    // 这里按按钮文本区分，而非 Yes/No 变体。
                    MessageDialogResult::Custom(text) if text == "退出" => {
                        // 用户选择后记住该行为，下次点 X 直接执行不再询问
                        save_close_behavior("exit");
                        app.exit(0);
                    }
                    MessageDialogResult::Custom(text) if text == "最小化到托盘" => {
                        save_close_behavior("minimize");
                        // 通知前端刷新设置，避免前端 store 中的旧值在打开设置界面时覆盖磁盘上的新值
                        let _ = app.emit("settings-changed", ());
                        let _ = win.hide();
                    }
                    _ => {} // 取消：保持窗口打开
                });
        }
    }
}

fn main() {
    // CLI mode: `cargo run -- --crawl` runs crawler standalone (no GUI)
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "--crawl" {
        main_cli_crawl();
        return;
    }
    // CLI mode: `cargo run -- --gmail-prototype` validates Gmail Scholar Alert crawling
    if args.len() > 1 && args[1] == "--gmail-prototype" {
        main_gmail_prototype();
        return;
    }

    run()
}

/// Standalone prototype validation for Gmail Scholar Alert crawling.
/// 只爬 Google Scholar (scholaralerts-noreply@google.com) 近 90 天邮件，
/// 打印数量、样本与 DB 论文匹配情况，用于验证同步链路。
fn main_gmail_prototype() {
    use crate::gmail::client::{get_message, search_messages};
    use crate::gmail::parser::parse_scholar_email;

    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    rt.block_on(async {
        let settings = crate::settings::ensure_settings().expect("读取设置失败");
        let cid = settings["gmail"]["clientId"].as_str().unwrap_or("").to_string();
        let csec = settings["gmail"]["clientSecret"].as_str().unwrap_or("").to_string();
        if cid.is_empty() || csec.is_empty() {
            eprintln!("Gmail 未配置 clientId/clientSecret");
            return;
        }

        println!("==> 获取访问令牌...");
        let token = match crate::gmail::auth::get_access_token(&cid, &csec).await {
            Ok(t) => t,
            Err(e) => { eprintln!("获取令牌失败: {}", e); return; }
        };
        println!("==> 令牌获取成功");

        let three_months_ago = chrono::Utc::now() - chrono::TimeDelta::days(90);
        let date_str = three_months_ago.format("%Y/%m/%d").to_string();
        let search_query = format!("from:scholaralerts-noreply@google.com after:{}", date_str);
        println!("==> 搜索: {}", search_query);
        let search_result = match search_messages(&token, &search_query, 100).await {
            Ok(r) => r,
            Err(e) => { eprintln!("搜索失败: {}", e); return; }
        };
        let messages = search_result.messages.unwrap_or_default();
        println!("==> 搜索到 {} 封邮件 (resultSizeEstimate={:?})",
            messages.len(), search_result.result_size_estimate);

        let pool = crate::dao::ensure_database().expect("打开数据库失败");
        let conn = pool.get().expect("获取数据库连接失败");
        let mut total_articles = 0;
        let mut empty_scholar: Vec<String> = Vec::new();
        let mut subject_styles: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        for (i, msg) in messages.iter().enumerate() {
            match get_message(&token, &msg.id, "full").await {
                Ok(detail) => {
                    if let Some(payload) = &detail.payload {
                        match parse_scholar_email(&msg.id, payload, detail.snippet.as_deref().unwrap_or("")) {
                            Ok(parsed) => {
                                // 按"标题后半段"归类标题风格，便于对比
                                let subject = parsed.subject.clone();
                                let style = subject.split_whitespace().skip(1).collect::<Vec<_>>().join(" ");
                                *subject_styles.entry(style).or_insert(0) += 1;
                                total_articles += parsed.articles.len();
                                println!("[{}/{}] scholar={:?} | 文章={} | 标题={:?}",
                                    i + 1, messages.len(), parsed.scholar_name, parsed.articles.len(), subject);
                                if parsed.scholar_name.is_empty() {
                                    empty_scholar.push(subject);
                                }
                                // 抽查前几篇的 arxiv 匹配情况
                                if i < 3 {
                                    for a in &parsed.articles {
                                        let by_arxiv = a.arxiv_id.as_ref()
                                            .and_then(|aid| crate::dao::papers::find_paper_by_arxiv(&conn, aid).ok().flatten());
                                        let by_title = if by_arxiv.is_none() {
                                            crate::dao::papers::find_paper_by_title(&conn, &a.title).ok().flatten()
                                        } else { None };
                                        println!("      - \"{}\" arxiv={:?} -> DB: arxiv={:?} title={:?}",
                                            a.title, a.arxiv_id, by_arxiv, by_title);
                                    }
                                }
                            }
                            Err(e) => println!("[{}/{}] 解析失败: {}", i + 1, messages.len(), e),
                        }
                    }
                }
                Err(e) => println!("[{}/{}] 获取邮件失败: {}", i + 1, messages.len(), e),
            }
        }
        println!("\n==> 共提取 {} 篇文章 / {} 封邮件", total_articles, messages.len());
        println!("==> scholar 名解析为空的邮件数: {}", empty_scholar.len());
        if !empty_scholar.is_empty() {
            println!("    -- 解析失败的标题 --");
            for s in &empty_scholar {
                println!("    {:?}", s);
            }
        }
        println!("==> 标题风格分布:");
        let mut styles: Vec<_> = subject_styles.into_iter().collect();
        styles.sort_by(|a, b| b.1.cmp(&a.1));
        for (style, count) in styles {
            println!("    [{}]  {}", count, style);
        }
    });
}

/// Standalone CLI entry for the arxiv crawler (for testing / external scripts)
fn main_cli_crawl() {
    settings::ensure_data_dir().expect("Failed to create data directory");
    settings::ensure_settings().expect("Failed to initialize settings");

    let db_pool = dao::ensure_database().expect("Failed to initialize database");
    let engine = crawler::engine::CrawlerEngine::new();

    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    let result = rt.block_on(engine.run(&db_pool, |progress| {
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