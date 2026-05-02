// Papers CRUD operations
// Handles all paper-related database operations

use crate::database::{DbConnection, models::*};
use rusqlite::{params, Row};

/// Get a paper from a database row
pub fn paper_from_row(row: &Row) -> Result<Paper, rusqlite::Error> {
    Ok(Paper {
        article_id: row.get(0)?,
        title: row.get(1)?,
        abstract_text: row.get(2)?,
        publication_date: row.get(3)?,
        preprint_number: row.get(4)?,
        publication_venue: row.get(5)?,
        publication_link: row.get(6)?,
        pdf_link: row.get(7)?,
        pdf_path: row.get(8)?,
        authors: None,
        categories: None,
        is_favorited: None,
    })
}

/// Get paper list with filters and pagination
pub fn get_papers(conn: &DbConnection, params: &PaperQueryParams) -> Result<PaperListResponse, String> {
    let offset = (params.page - 1) * params.page_size;

    // Build the WHERE clause based on filters
    let mut conditions: Vec<String> = vec![];
    let mut bind_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Search query filter (title or author)
    if let Some(query) = &params.query {
        if !query.is_empty() {
            conditions.push(
                "(p.title LIKE ? OR EXISTS (
                    SELECT 1 FROM paper_authors pa WHERE pa.article_id = p.article_id AND pa.author_name LIKE ?
                ))".to_string()
            );
            let search_pattern = format!("%{}%", query);
            bind_params.push(Box::new(search_pattern.clone()));
            bind_params.push(Box::new(search_pattern));
        }
    }

    // Date range filter
    if let Some(start_date) = &params.start_date {
        conditions.push("p.publication_date >= ?".to_string());
        bind_params.push(Box::new(start_date.clone()));
    }
    if let Some(end_date) = &params.end_date {
        conditions.push("p.publication_date <= ?".to_string());
        bind_params.push(Box::new(end_date.clone()));
    }

    // Source filter
    if let Some(sources) = &params.sources {
        if !sources.is_empty() {
            let placeholders: Vec<String> = sources.iter().map(|_| "?".to_string()).collect();
            conditions.push(format!("p.publication_venue IN ({})", placeholders.join(",")));
            for source in sources {
                bind_params.push(Box::new(source.clone()));
            }
        }
    }

    // Domain filter
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

    // Subscription filter
    if params.subscribed_only {
        conditions.push(
            "(EXISTS (SELECT 1 FROM paper_authors pa WHERE pa.article_id = p.article_id
                AND EXISTS (SELECT 1 FROM subscribed_authors sa WHERE sa.author_name = pa.author_name))
            OR EXISTS (SELECT 1 FROM paper_categories pc WHERE pc.article_id = p.article_id
                AND EXISTS (SELECT 1 FROM subscribed_categories sc WHERE sc.category = pc.category))
            OR EXISTS (SELECT 1 FROM subscribed_keywords sk
                WHERE p.title LIKE '%' || sk.keyword || '%' OR p.abstract LIKE '%' || sk.keyword || '%'))".to_string()
        );
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM papers p {}", where_clause);
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(bind_params.iter().map(|p| p.as_ref())), |row| row.get(0))
        .map_err(|e| format!("查询论文总数失败: {}", e))?;

    // Get papers with authors and categories
    let sql = format!(
        "SELECT p.article_id, p.title, p.abstract, p.publication_date, p.preprint_number,
                p.publication_venue, p.publication_link, p.pdf_link, p.pdf_path
         FROM papers p
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

    // Fill in authors, categories, and favorite status for each paper
    for paper in &mut papers {
        paper.authors = Some(get_paper_authors(conn, paper.article_id)?);
        paper.categories = Some(get_paper_categories(conn, paper.article_id)?);
        paper.is_favorited = Some(is_paper_favorited(conn, paper.article_id)?);
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
    let sql = "SELECT article_id, title, abstract, publication_date, preprint_number,
                      publication_venue, publication_link, pdf_link, pdf_path
               FROM papers WHERE article_id = ?";

    let paper = conn.query_row(sql, params![article_id], paper_from_row)
        .map_err(|e| format!("查询论文详情失败: {}", e))?;

    let mut paper = paper;
    paper.authors = Some(get_paper_authors(conn, article_id)?);
    paper.categories = Some(get_paper_categories(conn, article_id)?);
    paper.is_favorited = Some(is_paper_favorited(conn, article_id)?);

    Ok(paper)
}

/// Get all available sources (publication venues)
pub fn get_sources(conn: &DbConnection) -> Result<Vec<String>, String> {
    let sql = "SELECT DISTINCT publication_venue FROM papers WHERE publication_venue IS NOT NULL ORDER BY publication_venue";
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

/// Insert a new paper
pub fn insert_paper(conn: &DbConnection, paper: &Paper) -> Result<i64, String> {
    let sql = "INSERT INTO papers (title, abstract, publication_date, preprint_number, publication_venue, publication_link, pdf_link, pdf_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    conn.execute(sql, params![
        paper.title,
        paper.abstract_text,
        paper.publication_date,
        paper.preprint_number,
        paper.publication_venue,
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