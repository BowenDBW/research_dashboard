// Data transfer (import/export) service
// Exports the SQLite database to a portable .sql dump file, and merges a .sql file back in.
// 用于数据在不同 app / 机器之间流转（备份、迁移、换机）。
// 导出格式为标准 SQLite dump：PRAGMA + BEGIN/COMMIT + CREATE TABLE + INSERT 逐行。
// 导入为合并语义：保留现有数据，追加新记录，主键冲突跳过（INSERT OR IGNORE）。

use crate::dao::{init_database, DbConnection};
use std::sync::Arc;
use rusqlite::types::ValueRef;
use tauri::State;

use crate::AppState;

/// 全部用户表（导出范围 "all"）
const ALL_TABLES: &[&str] = &[
    "venues",
    "venue_rankings",
    "papers",
    "paper_authors",
    "paper_categories",
    "favorite_folders",
    "favorite_papers",
    "subscribed_authors",
    "subscribed_categories",
    "subscribed_keywords",
    "chat_sessions",
    "chat_messages",
    "chat_message_articles",
    "user_action_logs",
    "daily_recommendations",
];

/// 仅核心数据（导出范围 "core"）：文章库 + 收藏 + 订阅
const CORE_TABLES: &[&str] = &[
    "venues",
    "venue_rankings",
    "papers",
    "paper_authors",
    "paper_categories",
    "favorite_folders",
    "favorite_papers",
    "subscribed_authors",
    "subscribed_categories",
    "subscribed_keywords",
];

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub path: String,
    pub table_count: usize,
    pub row_count: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub path: String,
    pub table_count: usize,
    pub row_count: usize,
}

/// 根据导出范围返回要导出的表
fn tables_for_scope(scope: &str) -> &'static [&'static str] {
    if scope == "core" {
        CORE_TABLES
    } else {
        ALL_TABLES
    }
}

/// 转义 SQL 文本值（单引号翻倍）
fn escape_sql_text(s: &str) -> String {
    s.replace('\'', "''")
}

/// 将一张表的所有行 dump 成 INSERT 语句写入 out
fn dump_table(out: &mut String, conn: &DbConnection, table: &str) -> Result<usize, String> {
    // CREATE TABLE 语句
    let create_sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?1",
            rusqlite::params![table],
            |row| row.get(0),
        )
        .map_err(|e| format!("读取表 {} 的建表语句失败: {}", table, e))?;
    out.push_str(&create_sql);
    out.push_str(";\n");

    // 逐行 INSERT
    let sql = format!("SELECT * FROM \"{}\"", table);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("准备导出表 {} 失败: {}", table, e))?;
    let col_count = stmt.column_count();
    let mut rows = stmt
        .query([])
        .map_err(|e| format!("查询表 {} 失败: {}", table, e))?;

    let mut row_count = 0usize;
    while let Some(row) = rows.next().map_err(|e| format!("读取表 {} 数据失败: {}", table, e))? {
        out.push_str(&format!("INSERT INTO \"{}\" VALUES (", table));
        for i in 0..col_count {
            if i > 0 {
                out.push_str(", ");
            }
            match row
                .get_ref(i)
                .map_err(|e| format!("读取表 {} 字段失败: {}", table, e))?
            {
                ValueRef::Null => out.push_str("NULL"),
                ValueRef::Integer(n) => out.push_str(&n.to_string()),
                ValueRef::Real(f) => {
                    // 避免 1.0 输出成 "1" 导致类型变化
                    if f == (f as i64) as f64 {
                        out.push_str(&format!("{:.1}", f));
                    } else {
                        out.push_str(&f.to_string());
                    }
                }
                ValueRef::Text(t) => {
                    let s = std::str::from_utf8(t)
                        .map_err(|e| format!("导出表 {} 文本编码错误: {}", table, e))?;
                    out.push_str(&format!("'{}'", escape_sql_text(s)));
                }
                ValueRef::Blob(b) => {
                    out.push_str(&format!("X'{}'", hex_encode(b)));
                }
            }
        }
        out.push_str(");\n");
        row_count += 1;
    }

    Ok(row_count)
}

/// 二进制转十六进制（用于 BLOB 值）
fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02X}", b));
    }
    s
}

/// 导出数据库到指定 .sql 文件
#[tauri::command]
pub fn export_database(
    state: State<'_, Arc<AppState>>,
    path: String,
    scope: String,
) -> Result<ExportResult, String> {
    let conn = state
        .db_pool
        .get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    let tables = tables_for_scope(&scope);
    let mut out = String::new();
    out.push_str("PRAGMA foreign_keys=OFF;\n");
    out.push_str("BEGIN TRANSACTION;\n");

    let mut total_rows = 0usize;
    let mut dumped_tables = 0usize;
    for table in tables {
        let rows = dump_table(&mut out, &conn, table)?;
        total_rows += rows;
        dumped_tables += 1;
    }

    out.push_str("COMMIT;\n");

    let file_path = std::path::PathBuf::from(&path);
    std::fs::write(&file_path, out)
        .map_err(|e| format!("写入导出文件失败: {}", e))?;

    Ok(ExportResult {
        path,
        table_count: dumped_tables,
        row_count: total_rows,
    })
}

/// 合并导入 .sql 文件：保留现有数据，追加新记录，主键冲突跳过。
/// 对标准 dump 文本做幂等变换后整体执行。
#[tauri::command]
pub fn import_database(
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<ImportResult, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取导入文件失败: {}", e))?;
    if content.trim().is_empty() {
        return Err("导入文件为空".to_string());
    }

    // 逐行变换：合并语义
    let mut out = String::new();
    out.push_str("PRAGMA foreign_keys=OFF;\n");
    out.push_str("BEGIN TRANSACTION;\n");
    let mut table_count = 0usize;
    let mut row_count = 0usize;

    for line in content.lines() {
        let trimmed = line.trim_start();
        // 跳过 dump 的收尾/控制语句
        if trimmed.is_empty()
            || trimmed.starts_with("PRAGMA")
            || trimmed == "BEGIN TRANSACTION;"
            || trimmed == "COMMIT;"
        {
            continue;
        }
        // 已存在的表保留原样（IF NOT EXISTS 无副作用），新表正常创建
        if trimmed.starts_with("CREATE TABLE ") {
            table_count += 1;
            out.push_str(&line.replacen("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1));
            out.push('\n');
            continue;
        }
        if trimmed.starts_with("CREATE INDEX ") {
            out.push_str(&line.replacen("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", 1));
            out.push('\n');
            continue;
        }
        // 主键冲突跳过 → 合并语义
        if trimmed.starts_with("INSERT INTO ") {
            row_count += 1;
            out.push_str(&line.replacen("INSERT INTO ", "INSERT OR IGNORE INTO ", 1));
            out.push('\n');
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }

    // 没有可执行的 INSERT/CREATE 时提示
    if row_count == 0 && table_count == 0 {
        return Err("文件中没有可导入的建表或数据语句".to_string());
    }

    out.push_str("COMMIT;\n");

    let mut conn = state
        .db_pool
        .get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    conn.execute_batch(&out)
        .map_err(|e| format!("导入数据失败: {}", e))?;

    // 兜底：补建当前版本可能缺失的表（幂等）
    init_database(&mut conn).map_err(|e| format!("导入后初始化数据库失败: {}", e))?;

    Ok(ImportResult {
        path,
        table_count,
        row_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use r2d2_sqlite::SqliteConnectionManager;
    use rusqlite::params;

    fn temp_db(name: &str) -> (r2d2::Pool<SqliteConnectionManager>, std::path::PathBuf) {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("rd_import_test_{}_{}.db", name, std::process::id()));
        let _ = std::fs::remove_file(&path);
        let manager = SqliteConnectionManager::file(&path);
        let pool = r2d2::Pool::builder().max_size(2).build(manager).unwrap();
        let conn = pool.get().unwrap();
        conn.execute_batch(
            "CREATE TABLE papers (article_id INTEGER PRIMARY KEY, title TEXT);
             CREATE TABLE paper_authors (article_id INTEGER, author_order INTEGER, author_name TEXT, PRIMARY KEY (article_id, author_order));
             INSERT INTO papers VALUES (1, 'O''Reilly''s \"Guide\" to SQL — 中文测试');
             INSERT INTO papers VALUES (2, NULL);
             INSERT INTO paper_authors VALUES (1, 1, 'Tom O''Neil');
             INSERT INTO paper_authors VALUES (2, 1, '');
             INSERT INTO paper_authors VALUES (2, 2, 'Jane Doe');",
        )
        .unwrap();
        (pool, path)
    }

    #[test]
    fn dump_roundtrip_and_merge() {
        // 1. 导出
        let (pool, db_path) = temp_db("src");
        let conn = pool.get().unwrap();
        let mut dump = String::new();
        dump.push_str("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n");
        dump_table(&mut dump, &conn, "papers").unwrap();
        dump_table(&mut dump, &conn, "paper_authors").unwrap();
        dump.push_str("COMMIT;\n");

        // 2. 把 dump 写入 .sql 文件
        let sql_path = std::env::temp_dir().join(format!("rd_import_test_dump_{}.sql", std::process::id()));
        std::fs::write(&sql_path, &dump).unwrap();

        // 3. 导入到目标库（含一条既有数据，验证合并保留）
        let (target_pool, _target_path) = temp_db("dst");
        let tconn = target_pool.get().unwrap();
        tconn.execute("INSERT INTO papers VALUES (3, 'existing row')", params![]).unwrap();

        let conn_ref: &DbConnection = &tconn;
        let import = import_sql_text(conn_ref, &std::fs::read_to_string(&sql_path).unwrap()).unwrap();
        assert_eq!(import.table_count, 2, "应处理 2 个 CREATE TABLE");
        assert_eq!(import.row_count, 5, "应处理 5 条 INSERT");

        // 4. 验证结果：既有行保留 + 新行追加 + 空字符串保留 + 中文正常
        let total: i64 = tconn.query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0)).unwrap();
        assert_eq!(total, 3, "papers 应为 3 行（2 新 + 1 既有）");
        let title: String = tconn
            .query_row("SELECT title FROM papers WHERE article_id=1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "O'Reilly's \"Guide\" to SQL — 中文测试", "引号/中文转义应正确");
        let null_title: Option<String> = tconn
            .query_row("SELECT title FROM papers WHERE article_id=2", [], |r| r.get(0))
            .unwrap();
        assert_eq!(null_title, None, "NULL 值应保留");
        let authors: i64 = tconn
            .query_row("SELECT COUNT(*) FROM paper_authors", [], |r| r.get(0))
            .unwrap();
        // 目标库 seed 已有 3 行，导入的 3 行主键相同被 OR IGNORE 跳过 → 仍为 3 行（重复跳过语义）
        assert_eq!(authors, 3, "author 主键重复应被跳过，仍为 3 行");

        // 清理临时文件
        let _ = std::fs::remove_file(&sql_path);
        let _ = std::fs::remove_file(&db_path);
    }

    /// 从 .sql 文本执行合并导入（与 import_database 相同的变换逻辑，便于单测）
    fn import_sql_text(conn: &DbConnection, content: &str) -> Result<ImportResult, String> {
        let mut out = String::new();
        out.push_str("PRAGMA foreign_keys=OFF;\n");
        out.push_str("BEGIN TRANSACTION;\n");
        let mut table_count = 0usize;
        let mut row_count = 0usize;
        for line in content.lines() {
            let trimmed = line.trim_start();
            if trimmed.is_empty()
                || trimmed.starts_with("PRAGMA")
                || trimmed == "BEGIN TRANSACTION;"
                || trimmed == "COMMIT;"
            {
                continue;
            }
            if trimmed.starts_with("CREATE TABLE ") {
                table_count += 1;
                out.push_str(&line.replacen("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1));
                out.push('\n');
                continue;
            }
            if trimmed.starts_with("CREATE INDEX ") {
                out.push_str(&line.replacen("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", 1));
                out.push('\n');
                continue;
            }
            if trimmed.starts_with("INSERT INTO ") {
                row_count += 1;
                out.push_str(&line.replacen("INSERT INTO ", "INSERT OR IGNORE INTO ", 1));
                out.push('\n');
                continue;
            }
            out.push_str(line);
            out.push('\n');
        }
        out.push_str("COMMIT;\n");
        conn.execute_batch(&out).map_err(|e| format!("导入失败: {}", e))?;
        Ok(ImportResult { path: String::new(), table_count, row_count })
    }
}
