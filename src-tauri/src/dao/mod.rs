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
            context_text TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("创建 chat_sessions 表失败: {}", e))?;

    // 迁移：旧库的 chat_sessions 没有 context_text 列（存上传文章 PDF 解析后的文本，作为对话上下文）
    let has_context_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('chat_sessions') WHERE name = 'context_text'",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    if has_context_col == 0 {
        conn.execute("ALTER TABLE chat_sessions ADD COLUMN context_text TEXT", [])
            .map_err(|e| format!("为 chat_sessions 增加 context_text 列失败: {}", e))?;
    }

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

    // Create chat_message_articles table - 检索结果：一条消息关联多篇文章（只存 article_id，通过 JOIN papers 取详情）
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS chat_message_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            article_id INTEGER NOT NULL,
            FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
            FOREIGN KEY (article_id) REFERENCES papers(article_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cma_message ON chat_message_articles(message_id);
        CREATE INDEX IF NOT EXISTS idx_cma_article ON chat_message_articles(article_id);"
    ).map_err(|e| format!("创建 chat_message_articles 表失败: {}", e))?;

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

    // 旧版 papers 表 schema 迁移（幂等，新库直接跳过）
    migrate_legacy_papers_schema(conn)?;

    Ok(())
}

/// 迁移旧版 `papers` 表 schema。
///
/// v0.1.0 时代的 papers 表用 `publication_venue TEXT` 一列存刊会（值为 venue_id 数字字符串
/// 或刊会名称），而当前版本改为 `venue_id INTEGER` 外键关联 venues 表。当导入或升级的库仍是
/// 旧结构时（`papers` 缺 `venue_id` 列），所有依赖 `p.venue_id` 的查询都会报
/// "no such column" —— 表现为文章列表为空、推荐/收藏/历史无法加载、爬虫写入失败。
///
/// 迁移步骤：新增 venue_id 外键列 → 把旧列数值/名称迁移过去 → 删除旧列。
/// 幂等：已迁移或本就正确的库直接返回。
fn migrate_legacy_papers_schema(conn: &mut Connection) -> Result<(), String> {
    // 读取 papers 现有列名
    let mut stmt = conn
        .prepare("PRAGMA table_info(papers)")
        .map_err(|e| format!("读取 papers 表结构失败: {}", e))?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get(1))
        .map_err(|e| format!("读取 papers 表结构失败: {}", e))?
        .filter_map(|c| c.ok())
        .collect();

    // 新 schema 已有 venue_id，无需迁移
    if columns.iter().any(|c| c == "venue_id") {
        return Ok(());
    }
    // 既无 venue_id 也无 publication_venue：异常结构，跳过避免误操作
    if !columns.iter().any(|c| c == "publication_venue") {
        return Ok(());
    }

    // 1. 新增 venue_id 外键列（默认 NULL，允许未关联的论文）
    conn.execute_batch(
        "ALTER TABLE papers ADD COLUMN venue_id INTEGER REFERENCES venues(venue_id) ON DELETE SET NULL;",
    )
    .map_err(|e| format!("为 papers 增加 venue_id 列失败: {}", e))?;

    // 2a. 旧列值为纯数字 → 直接作为 venue_id（老库此处存的其实是 venue_id）
    conn.execute_batch(
        "UPDATE papers SET venue_id = CAST(publication_venue AS INTEGER)
         WHERE publication_venue IS NOT NULL AND publication_venue != ''
           AND publication_venue GLOB '[0-9]*';",
    )
    .map_err(|e| format!("迁移 venue_id（数字）失败: {}", e))?;

    // 2b. 旧列值为刊会名称 → 按名称/简称（忽略大小写与空格）匹配 venues
    conn.execute_batch(
        "UPDATE papers SET venue_id = (
             SELECT v.venue_id FROM venues v
             WHERE LOWER(REPLACE(v.name, ' ', '')) = LOWER(REPLACE(papers.publication_venue, ' ', ''))
                OR LOWER(REPLACE(v.abbreviation, ' ', '')) = LOWER(REPLACE(papers.publication_venue, ' ', ''))
             LIMIT 1
         )
         WHERE papers.venue_id IS NULL
           AND papers.publication_venue IS NOT NULL
           AND papers.publication_venue != ''
           AND papers.publication_venue NOT GLOB '[0-9]*';",
    )
    .map_err(|e| format!("迁移 venue_id（名称匹配）失败: {}", e))?;

    // 3. 删除旧列
    conn.execute_batch("ALTER TABLE papers DROP COLUMN publication_venue;")
        .map_err(|e| format!("删除旧 publication_venue 列失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 模拟旧版 schema 库，验证迁移后 venue_id 正确且旧列被删除。
    #[test]
    fn migrate_legacy_papers_schema_test() {
        let mut conn = Connection::open_in_memory().unwrap();
        // 旧版结构：papers 用 publication_venue 文本列（数值=venue_id；字符串=刊会名）
        conn.execute_batch(
            "CREATE TABLE venues (venue_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, abbreviation TEXT);
             INSERT INTO venues (name, abbreviation) VALUES ('IEEE Transactions on Services Computing', 'TSC');
             CREATE TABLE papers (
                 article_id INTEGER PRIMARY KEY AUTOINCREMENT,
                 title TEXT NOT NULL,
                 abstract TEXT,
                 publication_date TEXT,
                 preprint_number TEXT,
                 publication_venue TEXT,
                 publication_link TEXT,
                 pdf_link TEXT,
                 pdf_path TEXT
             );
             INSERT INTO papers (title, publication_venue) VALUES ('old numeric', '1');
             INSERT INTO papers (title, publication_venue) VALUES ('old name', 'IEEE Transactions on Services Computing');
             INSERT INTO papers (title, publication_venue) VALUES ('empty', '');",
        )
        .unwrap();

        migrate_legacy_papers_schema(&mut conn).unwrap();

        // venue_id 应已迁移：数字直转 + 名称匹配
        let rows: Vec<(String, Option<i64>)> = {
            let mut stmt = conn.prepare("SELECT title, venue_id FROM papers ORDER BY article_id").unwrap();
            let it = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<i64>>(1)?))).unwrap();
            it.filter_map(|x| x.ok()).collect()
        };
        assert_eq!(rows[0].1, Some(1), "数字字符串应直接转为 venue_id");
        assert_eq!(rows[1].1, Some(1), "刊会名称应匹配 venues 得到 venue_id");
        assert_eq!(rows[2].1, None, "空值保持 NULL");

        // 旧列应被删除
        let cols: Vec<String> = {
            let mut stmt = conn.prepare("PRAGMA table_info(papers)").unwrap();
            let c = stmt.query_map([], |r| r.get(1)).unwrap().filter_map(|c| c.ok()).collect();
            c
        };
        assert!(!cols.contains(&"publication_venue".to_string()), "旧列应被删除");
        assert!(cols.contains(&"venue_id".to_string()), "应包含 venue_id");

        // 幂等：再次运行不应报错
        migrate_legacy_papers_schema(&mut conn).unwrap();
    }

    /// 对真实库执行迁移并验证（默认忽略，需显式运行）：
    ///   RD_LIVE_DB=路径 cargo test --release dao::tests -- --ignored migrate_real_db
    #[test]
    #[ignore]
    fn migrate_real_db() {
        let live = std::env::var("RD_LIVE_DB")
            .unwrap_or_else(|_| format!("{}/.research_dashboard/research_dashboard.db",
                std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into())));
        let mut conn = Connection::open(&live).expect("打开真实库失败");
        init_database(&mut conn).expect("init_database 迁移失败");

        let has_venue_id: bool = {
            let mut stmt = conn.prepare("PRAGMA table_info(papers)").unwrap();
            let cols: Vec<String> = stmt.query_map([], |r| r.get(1)).unwrap()
                .filter_map(|c| c.ok()).collect();
            drop(stmt);
            cols.iter().any(|c| c == "venue_id")
        };
        assert!(has_venue_id, "迁移后 papers 应包含 venue_id 列");

        let total: i64 = conn.query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0)).unwrap();
        println!("迁移完成：papers 共 {} 行，venue_id 非空 {}", total,
            conn.query_row("SELECT COUNT(venue_id) FROM papers", [], |r| r.get::<_, i64>(0)).unwrap());
        assert!(total > 100_000, "数据量应保持不变，实际 {}", total);
    }
}

/// Check if database exists and initialize if needed
pub fn ensure_database() -> Result<DbPool, String> {
    let pool = create_pool()?;

    // 所有建表语句都是 CREATE ... IF NOT EXISTS，幂等且安全。
    // 必须每次启动都执行，否则新版本新增的表在已存在的旧数据库上永远不会被创建
    // （旧实现只在库文件首次创建时 init 一次）。
    let mut conn = pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;
    init_database(&mut conn)?;

    Ok(pool)
}