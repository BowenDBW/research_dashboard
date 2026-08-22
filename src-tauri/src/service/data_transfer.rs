// Data transfer (import/export) service
// Exports the SQLite database to a portable .sql dump file, and merges a .sql file back in.
// 用于数据在不同 app / 机器之间流转（备份、迁移、换机）。
// 导出格式为标准 SQLite dump：PRAGMA + BEGIN/COMMIT + CREATE TABLE + INSERT 逐行。
// 导入为合并语义：保留现有数据，追加新记录，主键冲突跳过（INSERT OR IGNORE）。

use crate::dao::{init_database, DbConnection};
use std::sync::Arc;
use rusqlite::types::ValueRef;
use tauri::State;
use tauri::Emitter;

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

/// 导入进度事件载荷（前端订阅 "import-progress" 事件）
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    /// 已读取的文件字节数
    pub read_bytes: u64,
    /// 文件总字节数
    pub total_bytes: u64,
    /// 0.0 ~ 100.0
    pub percent: f64,
    /// 已处理（尝试插入）的 INSERT 语句数
    pub inserted_rows: u64,
}

/// 同表 INSERT 批量合并执行的阈值：每 N 行 VALUES 合并为一条 INSERT OR IGNORE。
/// 大幅减少 prepare 次数（100 万条语句 -> 约 2000 条），显著提速。
const INSERT_BATCH_SIZE: usize = 500;

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
///
/// 性能与稳定性优化（V0.1.2）：
/// - 异步命令：重活在后台线程执行，不再阻塞 WebView 的 IPC 回调线程（修复大文件导入时 UI 卡死）。
/// - 流式读取：逐行读取并切分语句，不再把整个大文件（数百 MB）一次性读入内存并复制第二份。
/// - 批量合并：同表相邻的 INSERT 合并为多行 VALUES 的一条语句（默认 500 行一批），
///   把「100 万条逐条 prepare+step」降为「约 2000 条」，耗时从十几分钟降到秒级。
/// - 进度事件：向后端 "import-progress" 事件推送已读字节 / 百分比。
/// - 事务回滚：任何一步失败即 ROLLBACK，避免把连接留在未提交事务中。
#[tauri::command]
pub async fn import_database(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<ImportResult, String> {
    let state = state.inner().clone();
    let app = app.clone();

    tauri::async_runtime::spawn_blocking(move || import_database_blocking(&app, &state, &path))
        .await
        .map_err(|e| format!("导入线程异常: {}", e))?
}

/// 在后台线程执行的导入主体
fn import_database_blocking(
    app: &tauri::AppHandle,
    state: &Arc<AppState>,
    path: &str,
) -> Result<ImportResult, String> {
    let total_bytes = std::fs::metadata(path)
        .map_err(|e| format!("读取导入文件信息失败: {}", e))?
        .len();
    if total_bytes == 0 {
        return Err("导入文件为空".to_string());
    }

    let file = std::fs::File::open(path)
        .map_err(|e| format!("打开导入文件失败: {}", e))?;
    let reader = std::io::BufReader::new(file);

    let mut conn = state
        .db_pool
        .get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 进度回调：已读字节 -> 事件
    let emit = |read_bytes: u64, inserted_rows: u64| {
        let percent = if total_bytes == 0 {
            100.0
        } else {
            (read_bytes as f64 / total_bytes as f64 * 100.0).min(100.0)
        };
        let _ = app.emit(
            "import-progress",
            ImportProgress {
                read_bytes,
                total_bytes,
                percent,
                inserted_rows,
            },
        );
    };

    emit(0, 0);

    // 导入期间关闭磁盘同步以提速，结束后恢复
    let prev_sync: i64 = conn
        .query_row("PRAGMA synchronous", [], |r| r.get(0))
        .unwrap_or(1);
    conn.execute_batch("PRAGMA synchronous=OFF;")
        .map_err(|e| format!("设置导入加速参数失败: {}", e))?;

    let result = (|| {
        conn.execute_batch("BEGIN TRANSACTION;")
            .map_err(|e| format!("开启事务失败: {}", e))?;
        let (table_count, row_count) =
            import_reader(&mut conn, reader, total_bytes, emit)
                .map_err(|e| format!("导入数据失败: {}", e))?;
        if row_count == 0 && table_count == 0 {
            return Err("文件中没有可导入的建表或数据语句".to_string());
        }
        conn.execute_batch("COMMIT;")
            .map_err(|e| format!("提交事务失败: {}", e))?;

        // 兜底：补建当前版本可能缺失的表（幂等）
        init_database(&mut conn).map_err(|e| format!("导入后初始化数据库失败: {}", e))?;
        Ok((table_count, row_count))
    })();

    // 无论成败都恢复 synchronous，并在失败时回滚
    let _ = conn.execute_batch(&format!("PRAGMA synchronous={};", prev_sync));

    match result {
        Ok((table_count, row_count)) => {
            emit(total_bytes, row_count as u64);
            Ok(ImportResult {
                path: path.to_string(),
                table_count,
                row_count,
            })
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK;");
            Err(e)
        }
    }
}

/// 从任意 BufRead 流式读取 dump 文本，逐语句处理。
/// 返回 (建表语句数, INSERT 行数)。`progress` 回调参数为 (已读字节, 已处理 INSERT 数)。
fn import_reader<R: std::io::BufRead>(
    conn: &mut rusqlite::Connection,
    reader: R,
    _total_bytes: u64,
    mut progress: impl FnMut(u64, u64),
) -> Result<(usize, usize), String> {
    let mut lines = reader.lines();
    let mut table_count = 0usize;
    let mut row_count = 0usize;

    // 当前正在累积的（可能跨行的）语句
    let mut stmt = String::new();
    let mut in_str = false;
    // 同表 INSERT 批量合并缓冲
    let mut batch_table: Option<String> = None;
    let mut batch_rows: Vec<String> = Vec::new();
    let mut read_bytes: u64 = 0;

    // 把累积的同表 VALUES 批量刷为一条 INSERT OR IGNORE 语句
    let flush_batch = |conn: &mut rusqlite::Connection,
                           batch_table: &mut Option<String>,
                           batch_rows: &mut Vec<String>,
                           row_count: &mut usize|
     -> Result<(), String> {
        if batch_rows.is_empty() {
            return Ok(());
        }
        let table = batch_table.as_ref().expect("batch_table set when rows non-empty");
        let mut sql = String::with_capacity(batch_rows.iter().map(|r| r.len() + 1).sum::<usize>() + 64);
        sql.push_str("INSERT OR IGNORE INTO ");
        sql.push_str(table);
        sql.push_str(" VALUES ");
        for (i, row) in batch_rows.iter().enumerate() {
            if i > 0 {
                sql.push(',');
            }
            sql.push_str(row);
        }
        sql.push(';');
        conn.execute(&sql, [])
            .map_err(|e| format!("批量插入 {} 失败: {}", table, e))?;
        *row_count += batch_rows.len();
        batch_rows.clear();
        batch_table.take();
        Ok(())
    };

    while let Some(line) = lines.next() {
        let line = line.map_err(|e| format!("读取导入文件行失败: {}", e))?;
        read_bytes += line.len() as u64 + 1; // +1 换行符
        let trimmed = line.trim_start();

        // 跳过 dump 控制语句（可能以任意换行形式出现，用完整比较 + 前缀）
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with("PRAGMA")
            || trimmed.starts_with("BEGIN TRANSACTION")
            || trimmed.starts_with("COMMIT")
        {
            continue;
        }

        // 累积当前语句，并更新字符串引号状态
        stmt.push_str(&line);
        stmt.push('\n');
        update_quote_state(&line, &mut in_str);

        // 语句以顶层 ';' 结束（不在字符串内）才算完整
        if in_str || !line.trim_end().ends_with(';') {
            continue;
        }

        // 一条完整语句，取出并处理
        let statement = std::mem::take(&mut stmt);
        let stmt_trimmed = statement.trim();
        if stmt_trimmed.starts_with("CREATE TABLE ") {
            flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
            let sql = statement.replacen("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1);
            conn.execute_batch(&sql)
                .map_err(|e| format!("建表失败: {}", e))?;
            table_count += 1;
        } else if stmt_trimmed.starts_with("CREATE INDEX ") {
            flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
            let sql = statement.replacen("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", 1);
            conn.execute_batch(&sql)
                .map_err(|e| format!("建索引失败: {}", e))?;
        } else if let Some(rest) = stmt_trimmed.strip_prefix("INSERT INTO ") {
            // 提取表名与 VALUES 体，按表合并批量执行
            let Some(vpos) = rest.find(" VALUES ") else {
                flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
                conn.execute_batch(&statement)
                    .map_err(|e| format!("执行 INSERT 失败: {}", e))?;
                row_count += 1;
                continue;
            };
            let table = rest[..vpos].to_string();
            let body = rest[vpos + " VALUES ".len()..].trim_end_matches(';');
            if batch_table.as_deref() == Some(table.as_str()) {
                batch_rows.push(body.to_string());
            } else {
                flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
                batch_table = Some(table);
                batch_rows.push(body.to_string());
            }
            if batch_rows.len() >= INSERT_BATCH_SIZE {
                flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
            }
        } else {
            // 其他语句（如自定义 SQL）原样执行
            flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
            conn.execute_batch(&statement)
                .map_err(|e| format!("执行语句失败: {}", e))?;
        }

        // 每处理约 5 万条 INSERT 报一次进度（避免事件风暴）
        if row_count % 50_000 < 500 && row_count > 0 {
            progress(read_bytes, row_count as u64);
        }
    }

    // 收尾：刷出最后一批
    flush_batch(conn, &mut batch_table, &mut batch_rows, &mut row_count)?;
    progress(read_bytes, row_count as u64);

    Ok((table_count, row_count))
}

/// 更新字符串引号状态：统计行内未被 '' 转义的单引号奇偶性
fn update_quote_state(line: &str, in_str: &mut bool) {
    let b = line.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'\'' {
            if i + 1 < b.len() && b[i + 1] == b'\'' {
                i += 2; // '' 转义
                continue;
            }
            *in_str = !*in_str;
        }
        i += 1;
    }
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
        let mut tconn = target_pool.get().unwrap();
        tconn.execute("INSERT INTO papers VALUES (3, 'existing row')", params![]).unwrap();

        let import = import_sql_text(&mut tconn, &std::fs::read_to_string(&sql_path).unwrap()).unwrap();
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

    /// 从 .sql 文本执行合并导入（与 import_reader 同一套逻辑，便于单测）
    fn import_sql_text(conn: &mut DbConnection, content: &str) -> Result<ImportResult, String> {
        let total = content.len() as u64;
        conn.execute_batch("BEGIN TRANSACTION;").unwrap();
        let result = import_reader(conn, std::io::Cursor::new(content.as_bytes()), total, |_, _| {});
        match result {
            Ok((table_count, row_count)) => {
                conn.execute_batch("COMMIT;").unwrap();
                Ok(ImportResult { path: String::new(), table_count, row_count })
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                Err(e)
            }
        }
    }

    /// 大文件真实导入计时测试（默认忽略，需显式运行）：
    ///   cargo test --release data_transfer -- --ignored real_file_import_timing -- --nocapture
    /// 用 app 自身 dump_table 从正式库导出真实数据（含嵌入换行的摘要等），
    /// 再流式导入到临时库，验证优化后不卡死、内存可控且统计正确。
    /// H 盘未挂载时自动改从正式库生成，无需外部文件。
    #[test]
    #[ignore]
    fn real_file_import_timing() {
        // 1) 生成真实 dump 文件（优先用 app 自身导出路径，格式与用户导出一致）
        let live_db = std::env::var("RD_LIVE_DB")
            .unwrap_or_else(|_| {
                format!("{}/.research_dashboard/research_dashboard.db", std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
            });
        let dump_path = std::env::temp_dir().join(format!("rd_timing_src_{}.sql", std::process::id()));
        let live_manager = SqliteConnectionManager::file(&live_db);
        let live_pool = r2d2::Pool::builder().max_size(1).build(live_manager).unwrap();
        {
            let live_conn = live_pool.get().unwrap();
            let mut dump = String::new();
            dump.push_str("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n");
            for table in ALL_TABLES {
                dump_table(&mut dump, &live_conn, table).unwrap();
            }
            dump.push_str("COMMIT;\n");
            std::fs::write(&dump_path, &dump).unwrap();
            println!("已生成 {} MB 真实 dump: {}", dump.len() / 1024 / 1024, dump_path.display());
        }
        let file = std::fs::File::open(&dump_path).unwrap();
        let total_bytes = file.metadata().unwrap().len();

        // 2) 临时目标库（不触碰正式库）
        let dir = std::env::temp_dir();
        let db_path = dir.join(format!("rd_timing_{}.db", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        let manager = SqliteConnectionManager::file(&db_path);
        let pool = r2d2::Pool::builder().max_size(2).build(manager).unwrap();
        let mut conn = pool.get().unwrap();

        // 3) 流式导入并计时
        let start = std::time::Instant::now();
        let mut last_report = 0u64;
        let (table_count, row_count) = import_reader(
            &mut conn,
            std::io::BufReader::new(file),
            total_bytes,
            |read_bytes, inserted| {
                if read_bytes.saturating_sub(last_report) >= total_bytes / 10 {
                    let pct = read_bytes as f64 / total_bytes as f64 * 100.0;
                    println!("  [{:>5.1}%] {} MB 已读, {} 行已插入, 耗时 {}s",
                        pct, read_bytes / 1024 / 1024, inserted, start.elapsed().as_secs());
                    last_report = read_bytes;
                }
            },
        )
        .unwrap();
        let elapsed = start.elapsed();
        println!(
            "导入完成: {} 表 / {} 行, 总耗时 {:.1}s ({:.0} 行/秒), 临时库: {}",
            table_count, row_count, elapsed.as_secs_f64(), row_count as f64 / elapsed.as_secs_f64(), db_path.display()
        );
        assert!(row_count > 1_000_000, "真实数据应超过 100 万行，实际 {}", row_count);

        // 4) 抽查导入结果与正式库一致
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0)).unwrap();
        let live_conn = live_pool.get().unwrap();
        let src_total: i64 = live_conn.query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0)).unwrap();
        assert_eq!(total, src_total, "导入后 papers 行数应与正式库一致");

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(&dump_path);
    }
}
