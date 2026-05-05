// Papers CRUD operations
// Handles all paper-related database operations

use crate::dao::{DbConnection};
use crate::models::*;
use crate::dao::venues::find_or_create_venue;
use crate::dao::venues::get_venue_rankings;
use rusqlite::{params, Row};

/// Get a paper from a database row (with venue info from JOIN)
pub fn paper_from_row(row: &Row) -> Result<Paper, rusqlite::Error> {
    Ok(Paper {
        article_id: row.get(0)?,
        title: row.get(1)?,
        abstract_text: row.get(2)?,
        publication_date: row.get(3)?,
        preprint_number: row.get(4)?,
        venue_id: row.get(5)?,
        venue_name: row.get(6)?,
        venue_abbreviation: row.get(7)?,
        venue_type: row.get(11)?,
        publication_link: row.get(8)?,
        pdf_link: row.get(9)?,
        pdf_path: row.get(10)?,
        rankings: None,
        authors: None,
        categories: None,
        is_favorited: None,
    })
}

/// Get paper list with filters and pagination
/// Complex search logic:
/// - subscribed_only: limit to subscribed categories AND (match subscribed keywords OR match subscribed authors)
/// - domains: further filter to specific domains (from subscribed categories)
/// - sources: filter by conference/journal
/// - query: user search (title/abstract/author)
/// - date range: time filter
pub fn get_papers(conn: &DbConnection, params: &PaperQueryParams) -> Result<PaperListResponse, String> {
    let offset = (params.page - 1) * params.page_size;

    // Build the WHERE clause based on filters
    let mut conditions: Vec<String> = vec![];
    let mut bind_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // 1. Subscription filter (most complex)
    // When subscribed_only is ON:
    // - Paper must be in subscribed categories (AND condition)
    // - AND (match subscribed keywords in title/abstract OR match subscribed authors)
    if params.subscribed_only {
        // Condition A: Paper must be in subscribed categories
        conditions.push(
            "EXISTS (SELECT 1 FROM paper_categories pc WHERE pc.article_id = p.article_id
                AND EXISTS (SELECT 1 FROM subscribed_categories sc WHERE sc.category = pc.category))".to_string()
        );

        // Condition B: (match subscribed keywords OR match subscribed authors)
        conditions.push(
            "(EXISTS (SELECT 1 FROM subscribed_keywords sk
                WHERE p.title LIKE '%' || sk.keyword || '%' OR p.abstract LIKE '%' || sk.keyword || '%')
            OR EXISTS (SELECT 1 FROM paper_authors pa WHERE pa.article_id = p.article_id
                AND EXISTS (SELECT 1 FROM subscribed_authors sa WHERE sa.author_name = pa.author_name)))".to_string()
        );
    }

    // 2. Domain filter (arxiv switch - filter to specific domains)
    // Works independently or in combination with subscribed_only
    if let Some(domains) = &params.domains {
        if !domains.is_empty() {
            let placeholders: Vec<String> = domains.iter().map(|_| "?".to_string()).collect();
            conditions.push(format!(
                "EXISTS (SELECT 1 FROM paper_categories pc WHERE pc.article_id = p.article_id AND pc.category IN ({}))",
                placeholders.join(",")
            ));
            for domain in domains {
                bind_params.push(Box::new(domain.clone()));
            }
        }
    }

    // 3. User search query (title, abstract, or author)
    if let Some(query) = &params.query {
        if !query.is_empty() {
            conditions.push(
                "(p.title LIKE ? OR p.abstract LIKE ? OR EXISTS (
                    SELECT 1 FROM paper_authors pa WHERE pa.article_id = p.article_id AND pa.author_name LIKE ?
                ))".to_string()
            );
            let search_pattern = format!("%{}%", query);
            bind_params.push(Box::new(search_pattern.clone()));
            bind_params.push(Box::new(search_pattern.clone()));
            bind_params.push(Box::new(search_pattern));
        }
    }

    // 4. Date range filter
    if let Some(start_date) = &params.start_date {
        conditions.push("p.publication_date >= ?".to_string());
        bind_params.push(Box::new(start_date.clone()));
    }
    if let Some(end_date) = &params.end_date {
        conditions.push("p.publication_date <= ?".to_string());
        bind_params.push(Box::new(end_date.clone()));
    }

    // 5. Source filter (venue name or abbreviation)
    if let Some(sources) = &params.sources {
        if !sources.is_empty() {
            let placeholders: Vec<String> = sources.iter().map(|_| "?".to_string()).collect();
            conditions.push(format!(
                "(v.name IN ({}) OR v.abbreviation IN ({}) OR p.venue_id IS NULL)",
                placeholders.join(","), placeholders.join(",")
            ));
            for source in sources {
                bind_params.push(Box::new(source.clone()));
                bind_params.push(Box::new(source.clone()));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM papers p LEFT JOIN venues v ON p.venue_id = v.venue_id {}", where_clause);
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), |row| row.get(0))
        .map_err(|e| format!("查询论文总数失败: {}", e))?;

    // Get papers with venue info via LEFT JOIN
    let sql = format!(
        "SELECT p.article_id, p.title, p.abstract, p.publication_date, p.preprint_number,
                p.venue_id, v.name, v.abbreviation, p.publication_link, p.pdf_link, p.pdf_path, v.venue_type
         FROM papers p
         LEFT JOIN venues v ON p.venue_id = v.venue_id
         {}
         ORDER BY p.publication_date DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    bind_params.push(Box::new(params.page_size));
    bind_params.push(Box::new(offset));

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let papers_iter = stmt.query_map(rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), paper_from_row)
        .map_err(|e| format!("查询论文列表失败: {}", e))?;

    let mut papers: Vec<Paper> = papers_iter
        .filter_map(|p| p.ok())
        .collect();

    // Fill in authors, categories, favorite status and rankings for each paper
    for paper in &mut papers {
        paper.authors = Some(get_paper_authors(conn, paper.article_id)?);
        paper.categories = Some(get_paper_categories(conn, paper.article_id)?);
        paper.is_favorited = Some(is_paper_favorited(conn, paper.article_id)?);
        // Get rankings if paper has a venue
        if let Some(venue_id) = paper.venue_id {
            if venue_id > 0 {
                paper.rankings = Some(get_venue_rankings(conn, venue_id)?);
            }
        }
    }

    Ok(PaperListResponse {
        articles: papers,
        total,
        page: params.page,
        page_size: params.page_size,
    })
}

/// Get paper authors
fn get_paper_authors(conn: &DbConnection, article_id: i64) -> Result<Vec<String>, String> {
    let sql = "SELECT author_name FROM paper_authors WHERE article_id = ? ORDER BY author_order";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询作者语句失败: {}", e))?;

    let authors: Vec<String> = stmt.query_map(params![article_id], |row| row.get(0))
        .map_err(|e| format!("查询作者失败: {}", e))?
        .filter_map(|a| a.ok())
        .collect();

    Ok(authors)
}

/// Get paper categories
fn get_paper_categories(conn: &DbConnection, article_id: i64) -> Result<Vec<String>, String> {
    let sql = "SELECT category FROM paper_categories WHERE article_id = ?";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询领域语句失败: {}", e))?;

    let categories: Vec<String> = stmt.query_map(params![article_id], |row| row.get(0))
        .map_err(|e| format!("查询领域失败: {}", e))?
        .filter_map(|c| c.ok())
        .collect();

    Ok(categories)
}

/// Check if paper is favorited
fn is_paper_favorited(conn: &DbConnection, article_id: i64) -> Result<bool, String> {
    let sql = "SELECT COUNT(*) FROM favorite_papers WHERE article_id = ?";
    let count: i64 = conn.query_row(sql, params![article_id], |row| row.get(0))
        .map_err(|e| format!("查询收藏状态失败: {}", e))?;

    Ok(count > 0)
}

/// Get a single paper by ID with full details
pub fn get_paper_by_id(conn: &DbConnection, article_id: i64) -> Result<Paper, String> {
    let sql = "SELECT p.article_id, p.title, p.abstract, p.publication_date, p.preprint_number,
                      p.venue_id, v.name, v.abbreviation, p.publication_link, p.pdf_link, p.pdf_path, v.venue_type
               FROM papers p
               LEFT JOIN venues v ON p.venue_id = v.venue_id
               WHERE p.article_id = ?";

    let paper = conn.query_row(sql, params![article_id], paper_from_row)
        .map_err(|e| format!("查询论文详情失败: {}", e))?;

    let mut paper = paper;
    paper.authors = Some(get_paper_authors(conn, article_id)?);
    paper.categories = Some(get_paper_categories(conn, article_id)?);
    paper.is_favorited = Some(is_paper_favorited(conn, article_id)?);
    // Get rankings if paper has a venue
    if let Some(venue_id) = paper.venue_id {
        if venue_id > 0 {
            paper.rankings = Some(get_venue_rankings(conn, venue_id)?);
        }
    }

    Ok(paper)
}

/// Get all available sources (venue names)
pub fn get_sources(conn: &DbConnection) -> Result<Vec<String>, String> {
    // 从venues表获取名称和简称
    let sql = "SELECT DISTINCT name FROM venues UNION SELECT DISTINCT abbreviation FROM venues WHERE abbreviation IS NOT NULL ORDER BY name";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询来源语句失败: {}", e))?;

    let sources: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| format!("查询来源失败: {}", e))?
        .filter_map(|s| s.ok())
        .collect();

    Ok(sources)
}

/// Get all available categories (domains)
pub fn get_categories(conn: &DbConnection) -> Result<Vec<String>, String> {
    let sql = "SELECT DISTINCT category FROM paper_categories ORDER BY category";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询领域语句失败: {}", e))?;

    let categories: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| format!("查询领域失败: {}", e))?
        .filter_map(|c| c.ok())
        .collect();

    Ok(categories)
}

/// Insert a new paper with venue support
pub fn insert_paper(conn: &DbConnection, paper: &Paper) -> Result<i64, String> {
    // 如果提供了venue_name但没有venue_id，先查找或创建venue
    let venue_id = if let Some(vid) = paper.venue_id {
        vid
    } else if let Some(vname) = &paper.venue_name {
        find_or_create_venue(conn, vname)?
    } else {
        0 // 没有venue信息时venue_id为0或NULL
    };

    let sql = "INSERT INTO papers (title, abstract, publication_date, preprint_number, venue_id, publication_link, pdf_link, pdf_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    conn.execute(sql, params![
        paper.title,
        paper.abstract_text,
        paper.publication_date,
        paper.preprint_number,
        if venue_id > 0 { Some(venue_id) } else { None },
        paper.publication_link,
        paper.pdf_link,
        paper.pdf_path
    ]).map_err(|e| format!("插入论文失败: {}", e))?;

    let article_id = conn.last_insert_rowid();

    // Insert authors
    if let Some(authors) = &paper.authors {
        for (i, author) in authors.iter().enumerate() {
            conn.execute(
                "INSERT INTO paper_authors (article_id, author_name, author_order) VALUES (?, ?, ?)",
                params![article_id, author, i as i32 + 1]
            ).map_err(|e| format!("插入作者失败: {}", e))?;
        }
    }

    // Insert categories
    if let Some(categories) = &paper.categories {
        for category in categories {
            conn.execute(
                "INSERT INTO paper_categories (article_id, category) VALUES (?, ?)",
                params![article_id, category]
            ).map_err(|e| format!("插入领域失败: {}", e))?;
        }
    }

    Ok(article_id)
}

/// Check if paper exists by preprint number
pub fn paper_exists_by_preprint(conn: &DbConnection, preprint_number: &str) -> Result<bool, String> {
    let sql = "SELECT COUNT(*) FROM papers WHERE preprint_number = ?";
    let count: i64 = conn.query_row(sql, params![preprint_number], |row| row.get(0))
        .map_err(|e| format!("查询论文是否存在失败: {}", e))?;

    Ok(count > 0)
}

/// Get subscribed papers (for subscribed_only filter)
pub fn get_subscribed_papers(conn: &DbConnection, page: i32, page_size: i32) -> Result<PaperListResponse, String> {
    let params = PaperQueryParams {
        page,
        page_size,
        query: None,
        start_date: None,
        end_date: None,
        sources: None,
        domains: None,
        subscribed_only: true,
    };

    get_papers(conn, &params)
}

/// Delete a paper by ID
pub fn delete_paper(conn: &DbConnection, article_id: i64) -> Result<(), String> {
    // First delete from favorite_papers (if exists)
    conn.execute("DELETE FROM favorite_papers WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除收藏记录失败: {}", e))?;

    // Delete from user_action_logs
    conn.execute("DELETE FROM user_action_logs WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除操作日志失败: {}", e))?;

    // Delete from daily_recommendations
    conn.execute("DELETE FROM daily_recommendations WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除推荐记录失败: {}", e))?;

    // Delete from chat_sessions (if article is linked)
    conn.execute("DELETE FROM chat_sessions WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除对话会话失败: {}", e))?;

    // Delete authors (cascade)
    conn.execute("DELETE FROM paper_authors WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除作者失败: {}", e))?;

    // Delete categories (cascade)
    conn.execute("DELETE FROM paper_categories WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除领域失败: {}", e))?;

    // Finally delete the paper
    conn.execute("DELETE FROM papers WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除论文失败: {}", e))?;

    Ok(())
}

/// Update paper's venue information
pub fn update_paper_venue(conn: &DbConnection, article_id: i64, venue_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "UPDATE papers SET venue_id = ? WHERE article_id = ?",
        params![venue_id, article_id]
    ).map_err(|e| format!("更新论文venue失败: {}", e))?;

    Ok(())
}