// Manual Add CRUD operations
// Handles manually adding papers and fetching from arxiv

use crate::dao::{DbConnection};
use crate::models::{Paper, ArxivFetchResult, ManualAddRequest, ManualAddResult, Venue};
use crate::dao::papers::{insert_paper, paper_exists_by_preprint};
use crate::dao::venues::{find_or_create_venue, create_venue_full};
use rusqlite::params;

/// Convert arxiv fetch result to Paper struct
/// This function can be reused by the crawler
pub fn arxiv_result_to_paper(result: &ArxivFetchResult, venue_id: Option<i64>) -> Paper {
    Paper {
        article_id: 0,
        title: result.title.clone(),
        abstract_text: result.abstract_text.clone(),
        publication_date: result.publication_date.clone(),
        preprint_number: Some(result.preprint_number.clone()),
        venue_id,
        venue_name: None,
        venue_abbreviation: None,
        venue_type: None,
        publication_link: result.publication_link.clone(),
        pdf_link: result.pdf_link.clone(),
        pdf_path: None,
        authors: Some(result.authors.clone()),
        categories: Some(result.categories.clone()),
        is_favorited: None,
        rankings: None,
    }
}

/// Insert paper from arxiv result (used by manual add and crawler)
/// Note: arxiv articles have no venue info, venue_id should be NULL
pub fn insert_paper_from_arxiv(conn: &DbConnection, result: &ArxivFetchResult) -> Result<i64, String> {
    // Check for duplicates
    if paper_exists_by_preprint(conn, &result.preprint_number)? {
        return Err(format!("文章已存在: arxiv编号 {}", result.preprint_number));
    }

    // arxiv文章没有venue信息，venue_id为None
    let paper = arxiv_result_to_paper(result, None);
    insert_paper(conn, &paper)
}

/// Normalize title for comparison (remove spaces, lowercase)
fn normalize_title(title: &str) -> String {
    title.to_lowercase().replace(" ", "").replace("\t", "").replace("\n", "")
}

/// Check if a paper with similar title already exists (case/space insensitive)
/// Returns the article_id if found, None otherwise
pub fn find_duplicate_by_title(conn: &DbConnection, title: &str) -> Result<Option<i64>, String> {
    let normalized = normalize_title(title);
    // Get all titles and compare normalized versions
    let sql = "SELECT article_id, title FROM papers";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok::<(i64, String), rusqlite::Error>((row.get(0)?, row.get(1)?))
    }).map_err(|e| format!("查询标题失败: {}", e))?;

    for row in rows {
        let (article_id, db_title) = row.map_err(|e| format!("读取行失败: {}", e))?;
        if normalize_title(&db_title) == normalized {
            return Ok(Some(article_id));
        }
    }
    Ok(None)
}

/// Check if a paper exists (by title or preprint_number)
/// Returns the article_id if found
pub fn find_existing_paper(conn: &DbConnection, title: &str, preprint_number: Option<&str>) -> Result<Option<i64>, String> {
    // Check by preprint_number first (if provided)
    if let Some(preprint) = preprint_number {
        if !preprint.is_empty() {
            let sql = "SELECT article_id FROM papers WHERE preprint_number = ?";
            let result = conn.query_row(sql, params![preprint], |row| row.get::<_, i64>(0));
            match result {
                Ok(id) => return Ok(Some(id)),
                Err(rusqlite::Error::QueryReturnedNoRows) => {},
                Err(e) => return Err(format!("查询arxiv编号失败: {}", e)),
            }
        }
    }

    // Check by title (case/space insensitive)
    find_duplicate_by_title(conn, title)
}

/// Fetch article info from arxiv by preprint number
pub async fn fetch_from_arxiv(preprint_number: &str) -> Result<ArxivFetchResult, String> {
    let url = format!("https://arxiv.org/abs/{}", preprint_number);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("请求arxiv失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("arxiv返回错误状态: {}", response.status()));
    }

    let html = response.text()
        .await
        .map_err(|e| format!("读取arxiv响应失败: {}", e))?;

    // Parse HTML to extract article info
    parse_arxiv_html(&html, preprint_number)
}

/// Parse arxiv HTML page to extract article info
fn parse_arxiv_html(html: &str, preprint_number: &str) -> Result<ArxivFetchResult, String> {
    // Build URL first
    let url = format!("https://arxiv.org/abs/{}", preprint_number);

    // Simple HTML parsing without external parser
    // Extract title
    let title_raw = extract_between_tags(html, "<h1 class=\"title mathjax\">", "</h1>")
        .ok_or("无法提取标题")?;

    // Clean title: remove HTML tags like <span class="descriptor">...</span>
    let title = clean_html_tags(&title_raw)
        .replace("Title:", "")
        .trim()
        .to_string();

    // Extract authors
    let authors_section = extract_between_tags(html, "<div class=\"authors\">", "</div>")
        .ok_or("无法提取作者区域")?;

    let authors: Vec<String> = extract_all_links(&authors_section)
        .into_iter()
        .map(|s| s.trim().to_string())
        .collect();

    // Extract abstract
    let abstract_text = extract_between_tags(html, "<blockquote class=\"abstract mathjax\">", "</blockquote>")
        .map(|s| clean_html_tags(&s))
        .map(|s| s.replace("Abstract:", "").replace("abstract:", "").trim().to_string())
        .ok_or("无法提取摘要")?;

    // Extract categories/subjects from meta tags
    let categories = extract_categories(html);

    // Extract submission date
    let submit_date = extract_submission_date(html)?;

    // Build PDF link
    let pdf_link = format!("https://arxiv.org/pdf/{}", preprint_number);

    Ok(ArxivFetchResult {
        title,
        authors,
        abstract_text: Some(abstract_text),
        categories,
        publication_date: Some(submit_date),
        preprint_number: preprint_number.to_string(),
        publication_link: Some(url),
        pdf_link: Some(pdf_link),
    })
}

/// Clean HTML tags from text (remove tags like <span>, <div>, etc.)
fn clean_html_tags(text: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;

    for c in text.chars() {
        if c == '<' {
            inside_tag = true;
        } else if c == '>' {
            inside_tag = false;
        } else if !inside_tag {
            result.push(c);
        }
    }

    result
}

/// Helper to extract content between two tags
fn extract_between_tags(html: &str, start_tag: &str, end_tag: &str) -> Option<String> {
    let start_idx = html.find(start_tag)?;
    let remaining = &html[start_idx + start_tag.len()..];
    let end_idx = remaining.find(end_tag)?;
    Some(remaining[..end_idx].to_string())
}

/// Extract all link texts from HTML section
fn extract_all_links(html: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut pos = 0;

    while pos < html.len() {
        if let Some(a_start) = html[pos..].find("<a") {
            let a_section = &html[pos + a_start..];
            if let Some(a_end) = a_section.find("</a>") {
                // Find the > that closes the opening <a tag
                if let Some(tag_close) = a_section.find(">") {
                    if tag_close < a_end {
                        let text = &a_section[tag_close + 1..a_end];
                        results.push(text.to_string());
                    }
                }
                pos += a_start + a_end + 4;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    results
}

/// Extract arxiv categories from HTML
fn extract_categories(html: &str) -> Vec<String> {
    let mut categories = Vec::new();

    // Look for the subjects line in the metatable
    // Format: <td class="tablecell subjects"><span class="primary-subject">Name (code)</span>; Name2 (code2)</td>
    if let Some(subjects_section) = extract_between_tags(html, "Subjects:", "</td>") {
        // Clean HTML tags
        let cleaned = clean_html_tags(&subjects_section);

        // Split by semicolon (multiple categories are separated by ;)
        for part in cleaned.split(';') {
            let trimmed = part.trim();
            // Extract code from parentheses, e.g., "Computation and Language (cs.CL)" -> "cs.CL"
            if let Some(start) = trimmed.rfind('(') {
                if let Some(end) = trimmed.find(')') {
                    if end > start {
                        let code = &trimmed[start + 1..end];
                        let code = code.trim();
                        if !code.is_empty() {
                            categories.push(code.to_string());
                        }
                    }
                }
            }
        }
    }

    // Fallback: try to find from Cite as line which shows primary category
    if categories.is_empty() {
        // Look for pattern like "arXiv:2401.00001 [q-fin.PM]"
        if let Some(cite_section) = extract_between_tags(html, "Cite as:", "</tr>") {
            // Find [category] pattern
            let chars: Vec<char> = cite_section.chars().collect();
            let mut i = 0;
            while i < chars.len() {
                if chars[i] == '[' {
                    let start = i + 1;
                    let mut end = start;
                    while end < chars.len() && chars[end] != ']' {
                        end += 1;
                    }
                    if end < chars.len() {
                        let code: String = chars[start..end].iter().collect();
                        let code = code.trim();
                        if !code.is_empty() && code.contains('.') || code.starts_with("cs.") || code.starts_with("math.") {
                            categories.push(code.to_string());
                        }
                    }
                    i = end;
                }
                i += 1;
            }
        }
    }

    categories
}

/// Extract submission date from arxiv page
fn extract_submission_date(html: &str) -> Result<String, String> {
    // Look for submission history div
    let date_section = extract_between_tags(html, "<div class=\"submission-history\">", "</div>")
        .ok_or("无法找到提交日期区域")?;

    // Find date pattern like "Mon, 1 Jan 2024 12:00:00 UTC"
    // Use regex-like matching
    let date_pattern = find_date_pattern(&date_section)?;

    // Convert to YYYY-MM-DD format
    convert_date_format(&date_pattern)
}

fn find_date_pattern(text: &str) -> Result<String, String> {
    // Look for pattern like "[v1] Mon, 1 Jan 2024 12:00:00 UTC"
    for line in text.lines() {
        if line.contains("UTC") {
            // Find the date part
            if let Some(start) = line.find(", ") {
                let remaining = &line[start + 2..];
                if let Some(end) = remaining.find(" GMT") {
                    return Ok(remaining[..end].to_string());
                }
                if let Some(end) = remaining.find(" UTC") {
                    return Ok(remaining[..end].to_string());
                }
            }
        }
    }
    Err("无法解析日期格式".to_string())
}

fn convert_date_format(date_str: &str) -> Result<String, String> {
    // Parse dates like "1 Jan 2024" to "2024-01-01"
    let parts: Vec<&str> = date_str.split_whitespace().collect();
    if parts.len() < 3 {
        return Err("日期格式不完整".to_string());
    }

    let day = parts[0].parse::<u32>()
        .map_err(|_| "无法解析日期数字".to_string())?;

    let month_map = [
        ("Jan", 1), ("Feb", 2), ("Mar", 3), ("Apr", 4),
        ("May", 5), ("Jun", 6), ("Jul", 7), ("Aug", 8),
        ("Sep", 9), ("Oct", 10), ("Nov", 11), ("Dec", 12),
    ];

    let month_name = parts[1];
    let month = month_map.iter()
        .find(|(name, _)| *name == month_name)
        .map(|(_, m)| *m)
        .ok_or("无法识别月份".to_string())?;

    let year = parts[2].parse::<u32>()
        .map_err(|_| "无法解析年份".to_string())?;

    Ok(format!("{:04}-{:02}-{:02}", year, month, day))
}

/// Copy PDF file to storage path and return the new path
fn copy_pdf_file(source_path: &str, article_id: i64) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let source = PathBuf::from(source_path);

    // Check source exists
    if !source.exists() {
        return Err("源PDF文件不存在".to_string());
    }

    // Get PDF storage path from settings or use default
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let data_dir = home_dir.join(".research_dashboard");
    let default_pdfs_dir = data_dir.join("pdfs");

    // Try to read settings for custom path
    let settings_path = data_dir.join("settings.json");
    let storage_path = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析设置JSON失败: {}", e))?;

        let custom_path = json["pdfStoragePath"].as_str();
        if let Some(path) = custom_path {
            if !path.is_empty() {
                let pdf_path = PathBuf::from(path);
                if !pdf_path.exists() {
                    fs::create_dir_all(&pdf_path)
                        .map_err(|e| format!("创建PDF存储目录失败: {}", e))?;
                }
                pdf_path
            } else {
                default_pdfs_dir
            }
        } else {
            default_pdfs_dir
        }
    } else {
        default_pdfs_dir
    };

    // Ensure storage directory exists
    if !storage_path.exists() {
        fs::create_dir_all(&storage_path)
            .map_err(|e| format!("创建PDF目录失败: {}", e))?;
    }

    // Generate new filename: article_id_original_name.pdf
    let original_name = source.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf");

    let new_filename = format!("{}_{}", article_id, original_name);
    let dest_path = storage_path.join(&new_filename);

    // Copy file
    fs::copy(&source, &dest_path)
        .map_err(|e| format!("复制PDF文件失败: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// Add paper manually (with duplicate check)
pub fn add_paper_manually(conn: &DbConnection, request: &ManualAddRequest, arxiv_data: Option<&ArxivFetchResult>) -> Result<ManualAddResult, String> {
    // Determine title and preprint_number
    let (title, preprint_number) = if let Some(arxiv) = arxiv_data {
        (arxiv.title.clone(), Some(arxiv.preprint_number.clone()))
    } else {
        let t = request.title.clone().ok_or("标题必填")?;
        let p = request.arxiv_number.clone();
        (t, p)
    };

    // Check for duplicates
    if let Some(_existing_id) = find_existing_paper(conn, &title, preprint_number.as_deref())? {
        return Ok(ManualAddResult {
            success: false,
            article_id: None,
            message: "文章已存在（标题或arxiv编号重复）".to_string(),
            duplicate: true,
        });
    }

    // Build paper data
    let authors = if let Some(arxiv) = arxiv_data {
        arxiv.authors.clone()
    } else {
        request.authors.clone().unwrap_or_default()
    };

    let abstract_text = arxiv_data.and_then(|a| a.abstract_text.clone())
        .or(request.abstract_text.clone());

    let publication_date = arxiv_data.and_then(|a| a.publication_date.clone())
        .or(request.publication_date.clone());

    let publication_link = arxiv_data.and_then(|a| a.publication_link.clone())
        .or(request.publication_link.clone());

    let pdf_link = arxiv_data.and_then(|a| a.pdf_link.clone())
        .or(request.pdf_link.clone());

    // PDF file path will be handled after article is inserted (need article_id)
    let pdf_file_source = request.pdf_file.clone();

    let categories = if let Some(arxiv) = arxiv_data {
        arxiv.categories.clone()
    } else {
        request.categories.clone().unwrap_or_default()
    };

    // Handle venue
    let venue_id = if let Some(vid) = request.venue_id {
        Some(vid)
    } else if let Some(vname) = &request.venue_name {
        if !vname.is_empty() {
            // If we have additional venue info, create with full details
            if request.venue_abbreviation.is_some() || request.venue_issn.is_some() || request.venue_publisher.is_some() || request.venue_type.is_some() {
                let venue = create_venue_full(
                    conn,
                    vname,
                    request.venue_abbreviation.as_deref(),
                    request.venue_type.as_deref(),
                    request.venue_issn.as_deref(),
                    request.venue_publisher.as_deref(),
                )?;
                Some(venue.venue_id)
            } else {
                Some(find_or_create_venue(conn, vname)?)
            }
        } else {
            None
        }
    } else {
        // 没有venue信息就是没有，不要自动创建arXiv venue
        None
    };

    // Create paper object (pdf_path initially empty if file needs to be copied)
    let pdf_path = if pdf_file_source.is_some() {
        None // Will be set after copy
    } else {
        None
    };

    let paper = Paper {
        article_id: 0,
        title: title.to_string(),
        abstract_text,
        publication_date,
        preprint_number,
        venue_id,
        venue_name: request.venue_name.clone(),
        venue_abbreviation: None,
        venue_type: None,
        publication_link,
        pdf_link,
        pdf_path,
        authors: Some(authors),
        categories: Some(categories),
        is_favorited: None,
        rankings: None,
    };

    // Insert paper
    let article_id = insert_paper(conn, &paper)?;

    // Handle PDF file copy if source provided
    let final_pdf_path = if let Some(source) = pdf_file_source {
        if !source.is_empty() {
            // Copy PDF to storage and get new path
            let copied_path = copy_pdf_file(&source, article_id)?;

            // Update paper's pdf_path in database
            let update_sql = "UPDATE papers SET pdf_path = ? WHERE article_id = ?";
            conn.execute(update_sql, params![copied_path.clone(), article_id])
                .map_err(|e| format!("更新PDF路径失败: {}", e))?;

            Some(copied_path)
        } else {
            None
        }
    } else {
        None
    };

    Ok(ManualAddResult {
        success: true,
        article_id: Some(article_id),
        message: if final_pdf_path.is_some() {
            "文章添加成功，PDF已保存到本地".to_string()
        } else {
            "文章添加成功".to_string()
        },
        duplicate: false,
    })
}

/// Import arXiv info to overwrite article basic info
/// If article has local PDF file, delete it and use arXiv PDF link instead
pub fn import_arxiv_info(conn: &DbConnection, article_id: i64, arxiv_data: &ArxivFetchResult) -> Result<(), String> {
    use std::fs;

    // Get current article info
    let current_pdf_path: Option<String> = {
        let sql = "SELECT pdf_path FROM papers WHERE article_id = ?";
        conn.query_row(sql, params![article_id], |row| row.get::<_, Option<String>>(0))
            .map_err(|e| format!("查询文章失败: {}", e))?
    };

    // Delete local PDF file if exists
    if let Some(pdf_path) = current_pdf_path {
        if !pdf_path.is_empty() {
            let path = std::path::PathBuf::from(&pdf_path);
            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|e| format!("删除本地PDF文件失败: {}", e))?;
            }
        }
    }

    // Update article basic info (excluding authors and categories which are in separate tables)
    let update_sql = "
        UPDATE papers SET
            title = ?,
            abstract = ?,
            publication_date = ?,
            preprint_number = ?,
            publication_link = ?,
            pdf_link = ?,
            pdf_path = NULL
        WHERE article_id = ?
    ";

    conn.execute(update_sql, params![
        arxiv_data.title,
        arxiv_data.abstract_text,
        arxiv_data.publication_date,
        arxiv_data.preprint_number,
        arxiv_data.publication_link,
        arxiv_data.pdf_link,
        article_id
    ]).map_err(|e| format!("更新文章信息失败: {}", e))?;

    // Delete old authors and insert new ones
    conn.execute("DELETE FROM paper_authors WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除旧作者失败: {}", e))?;

    for (i, author) in arxiv_data.authors.iter().enumerate() {
        conn.execute(
            "INSERT INTO paper_authors (article_id, author_name, author_order) VALUES (?, ?, ?)",
            params![article_id, author, i as i32]
        ).map_err(|e| format!("插入作者失败: {}", e))?;
    }

    // Delete old categories and insert new ones
    conn.execute("DELETE FROM paper_categories WHERE article_id = ?", params![article_id])
        .map_err(|e| format!("删除旧分类失败: {}", e))?;

    for category in arxiv_data.categories.iter() {
        conn.execute(
            "INSERT INTO paper_categories (article_id, category) VALUES (?, ?)",
            params![article_id, category]
        ).map_err(|e| format!("插入分类失败: {}", e))?;
    }

    Ok(())
}

/// Update publication link for an article
pub fn update_publication_link(conn: &DbConnection, article_id: i64, publication_link: Option<&str>) -> Result<(), String> {
    let sql = "UPDATE papers SET publication_link = ? WHERE article_id = ?";
    conn.execute(sql, params![publication_link, article_id])
        .map_err(|e| format!("更新发表信息页网址失败: {}", e))?;
    Ok(())
}