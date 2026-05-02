// DAO module - Data Access Object
// Pure database CRUD operations, no business logic

pub mod papers;
pub mod venues;
pub mod manual_add;
pub mod chat;
pub mod history;
pub mod favorites;
pub mod stats;
pub mod subscriptions;
pub mod daily;

use crate::settings::get_db_path;
use r2d2;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

/// Database connection pool type
pub type DbPool = r2d2::Pool<SqliteConnectionManager>;

/// Database connection type from pool
pub type DbConnection = r2d2::PooledConnection<SqliteConnectionManager>;

/// Create a database connection pool
pub fn create_pool() -> Result<DbPool, String> {
    let db_path = get_db_path()?;
    let manager = SqliteConnectionManager::file(&db_path);

    let pool = r2d2::Pool::builder()
        .max_size(10)
        .build(manager)
        .map_err(|e| format!("创建数据库连接池失败: {}", e))?;

    Ok(pool)
}

/// Initialize database tables if they don't exist
pub fn init_database(conn: &mut Connection) -> Result<(), String> {
    // Enable foreign key support
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("启用外键支持失败: {}", e))?;

    // Create venues table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS venues (
            venue_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            abbreviation TEXT,
            issn TEXT,
            eissn TEXT,
            venue_type TEXT DEFAULT 'journal',
            publisher TEXT,
            url TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
        CREATE INDEX IF NOT EXISTS idx_venues_issn ON venues(issn);
        CREATE INDEX IF NOT EXISTS idx_venues_abbreviation ON venues(abbreviation);"
    ).map_err(|e| format!("创建 venues 表失败: {}", e))?;

    // Create venue_rankings table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS venue_rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            ranking_source TEXT NOT NULL,
            ranking_category TEXT,
            ranking_year INTEGER,
            category_detail TEXT,
            UNIQUE(venue_id, ranking_source, ranking_year),
            FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_rankings_venue ON venue_rankings(venue_id);"
    ).map_err(|e| format!("创建 venue_rankings 表失败: {}", e))?;

    // Create papers table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS papers (
            article_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            abstract TEXT,
            publication_date TEXT,
            preprint_number TEXT,
            venue_id INTEGER,
            publication_link TEXT,
            pdf_link TEXT,
            pdf_path TEXT,
            FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE SET NULL
        );"
    ).map_err(|e| format!("创建 papers 表失败: {}", e))?;

    // Create paper_authors table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS paper_authors (
            article_id INTEGER NOT NULL,
            author_name TEXT NOT NULL,
            author_order INTEGER NOT NULL,
            PRIMARY KEY (article_id, author_order),
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 paper_authors 表失败: {}", e))?;

    // Create paper_categories table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS paper_categories (
            article_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            PRIMARY KEY (article_id, category),
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 paper_categories 表失败: {}", e))?;

    // Create favorite_folders table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS favorite_folders (
            folder_id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER,
            folder_name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES favorite_folders(folder_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 favorite_folders 表失败: {}", e))?;

    // Create favorite_papers table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS favorite_papers (
            article_id INTEGER PRIMARY KEY,
            folder_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES favorite_folders(folder_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 favorite_papers 表失败: {}", e))?;

    // Create subscribed_authors table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS subscribed_authors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );"
    ).map_err(|e| format!("创建 subscribed_authors 表失败: {}", e))?;

    // Create subscribed_categories table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS subscribed_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );"
    ).map_err(|e| format!("创建 subscribed_categories 表失败: {}", e))?;

    // Create subscribed_keywords table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS subscribed_keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );"
    ).map_err(|e| format!("创建 subscribed_keywords 表失败: {}", e))?;

    // Create chat_sessions table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            mode TEXT DEFAULT 'chat',
            article_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 chat_sessions 表失败: {}", e))?;

    // Create chat_messages table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 chat_messages 表失败: {}", e))?;

    // Create user_action_logs table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS user_action_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 user_action_logs 表失败: {}", e))?;

    // Create daily_recommendations table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS daily_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            source TEXT DEFAULT 'google',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(article_id, source),
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 daily_recommendations 表失败: {}", e))?;

    Ok(())
}

/// Check if database exists and initialize if needed
pub fn ensure_database() -> Result<DbPool, String> {
    let db_path = get_db_path()?;
    let needs_init = !db_path.exists();

    let pool = create_pool()?;

    if needs_init {
        let mut conn = pool.get()
            .map_err(|e| format!("获取数据库连接失败: {}", e))?;
        init_database(&mut conn)?;
    }

    Ok(pool)
}