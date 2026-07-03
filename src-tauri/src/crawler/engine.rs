// Arxiv crawler engine
// Core crawling logic: fetches arXiv listing pages, parses article details, stores to DB
// Ported from Python version at arxiv_crawler_light

use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};

use crate::dao::{DbConnection, DbPool};
use crate::dao::papers::{insert_paper, paper_exists_by_preprint};
use crate::dao::subscriptions::get_all_subscriptions;
use crate::models::Paper;
use crate::settings::{ensure_settings, save_settings};
use rusqlite::params;

/// Result of a single crawl run
#[derive(Debug, Clone)]
pub struct CrawlResult {
    pub articles_saved: usize,
    pub subjects_processed: Vec<String>,
    pub errors: Vec<String>,
}

/// Progress information during a crawl
#[derive(Debug, Clone)]
pub struct CrawlProgress {
    pub current_subject: String,
    pub subject_index: usize,
    pub total_subjects: usize,
    pub pages_fetched: usize,
    pub articles_found: usize,
    pub articles_saved: usize,
    pub errors: Vec<String>,
    pub is_running: bool,
}

/// The arxiv crawler engine
/// Ported from Python version - maintains the same crawling strategy:
/// 1. Get subscribed categories from DB
/// 2. For each category, fetch https://arxiv.org/list/{subject}/recent with pagination
/// 3. Stop when 3 consecutive old articles found (older than last_run_date - 2 days)
/// 4. For each new article, fetch detail page and extract metadata
/// 5. Save to DB using existing papers DAO
pub struct CrawlerEngine {
    client: Client,
    user_agent: &'static str,
}

impl CrawlerEngine {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        }
    }

    /// Run a full crawl for all subscribed categories
    /// Reports progress via the provided callback function
    /// 每爬取一篇立即录入数据库，支持断网恢复
    pub async fn run<F: Fn(CrawlProgress)>(
        &self,
        pool: &DbPool,
        progress_callback: F,
    ) -> Result<CrawlResult, String> {
        // Get subscribed categories from the project's DB
        let conn = pool.get().map_err(|e| format!("获取数据库连接失败: {}", e))?;
        let subscriptions = get_all_subscriptions(&conn)
            .map_err(|e| format!("获取订阅分类失败: {}", e))?;
        drop(conn);

        let topics: Vec<String> = subscriptions.categories.iter()
            .map(|c| c.category.clone())
            .collect();

        if topics.is_empty() {
            return Err("没有已订阅的分类，请在订阅管理中添加 arXiv 分类".to_string());
        }

        // Get last run date from settings
        let last_run_date = get_last_crawl_date();
        let utc_plus_8 = Utc::now() + Duration::hours(8);

        // Check if already ran today (UTC+8)
        if let Some(last_run) = &last_run_date {
            let today = utc_plus_8.format("%Y-%m-%d").to_string();
            if *last_run == today {
                return Err(format!("今天已经在 {} 运行过了，跳过", today));
            }
        }

        // 阈值计算：last_run - 2天，但不超过 today - 30天
        let max_threshold = (utc_plus_8 - Duration::days(30)).date_naive();
        let last_run_date_minus_two = last_run_date.as_ref()
            .and_then(|s| NaiveDateTime::parse_from_str(&format!("{} 00:00:00", s), "%Y-%m-%d %H:%M:%S").ok())
            .map(|d| d.date() - Duration::days(2))
            .map(|d| if d < max_threshold { max_threshold } else { d })
            .or(Some(max_threshold));

        let mut errors: Vec<String> = Vec::new();
        let mut subjects_processed: Vec<String> = Vec::new();
        let total_topics = topics.len();
        let mut total_saved = 0usize;
        let mut total_found = 0usize;

        for (topic_index, topic) in topics.iter().enumerate() {
            progress_callback(CrawlProgress {
                current_subject: topic.clone(),
                subject_index: topic_index + 1,
                total_subjects: total_topics,
                pages_fetched: 0,
                articles_found: total_found,
                articles_saved: total_saved,
                errors: errors.clone(),
                is_running: true,
            });

            match self.process_topic(topic, last_run_date_minus_two, pool, &progress_callback, topic_index + 1, total_topics, &mut total_saved, &mut total_found).await {
                Ok(()) => subjects_processed.push(topic.clone()),
                Err(e) => errors.push(format!("处理分类 {} 失败: {}", topic, e)),
            }
        }

        // Update last run date
        let today_str = utc_plus_8.format("%Y-%m-%d").to_string();
        update_last_crawl_date(&today_str)?;

        Ok(CrawlResult {
            articles_saved: total_saved,
            subjects_processed,
            errors,
        })
    }

    /// Process a single topic: fetch listing pages and parse articles
    /// 每爬取一篇立即录入数据库
    async fn process_topic(
        &self,
        subject: &str,
        last_run_date_minus_two: Option<chrono::NaiveDate>,
        pool: &DbPool,
        progress_callback: &impl Fn(CrawlProgress),
        subject_index: usize,
        total_subjects: usize,
        total_saved: &mut usize,
        total_found: &mut usize,
    ) -> Result<(), String> {
        let base_url = format!("https://arxiv.org/list/{}/recent", subject);
        let mut page: i32 = 0;
        let mut consecutive_old = 0;
        let mut consecutive_empty_pages = 0;   // 连续无新增页码计数

        loop {
            let url = format!("{}?skip={}&show=50", base_url, page * 50);
            let page_num = page + 1;
            let saved_before_page = *total_saved;   // 记下进页前的新增数

            let response = self.client.get(&url)
                .header("User-Agent", self.user_agent)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?;

            let status = response.status();
            if !status.is_success() {
                return Err(format!("HTTP {}", status));
            }

            let html = response.text().await
                .map_err(|e| format!("读取响应失败: {}", e))?;

            let article_links = parse_list_page(&html)?;

            for link in &article_links {
                let full_url = format!("https://arxiv.org{}", link);
                match self.fetch_article_page(&full_url, subject).await {
                    Ok(Some(article)) => {
                        let article_date = article.submit_date.naive_utc().date();
                        let is_old = if let Some(threshold) = last_run_date_minus_two {
                            article_date < threshold
                        } else {
                            false
                        };

                        if is_old {
                            consecutive_old += 1;
                            if consecutive_old >= 3 {
                                println!("在 {} 中发现连续 3 篇旧文章，停止", subject);
                                return Ok(());
                            }
                        } else {
                            consecutive_old = 0;
                            *total_found += 1;

                            // 立即录入数据库
                            match save_article(pool, &article, subject) {
                                Ok(true) => *total_saved += 1,
                                Ok(false) => { /* 已存在，仅补充分类 */ }
                                Err(e) => {
                                    println!("保存文章失败 ({}): {}", article.preprint_number, e);
                                }
                            }
                        }
                    }
                    Ok(None) => { /* failed to parse, skip */ }
                    Err(e) => {
                        println!("获取文章详情失败: {} - {}", full_url, e);
                    }
                }
            }

            // 判断连续无新增页：本页没有任何新文章入库
            let new_this_page = *total_saved - saved_before_page;
            if new_this_page == 0 {
                consecutive_empty_pages += 1;
                if consecutive_empty_pages >= 3 {
                    println!("在 {} 中连续 3 页无新增文章，停止", subject);
                    return Ok(());
                }
            } else {
                consecutive_empty_pages = 0;
            }

            // 每爬完一页报告进度
            progress_callback(CrawlProgress {
                current_subject: subject.to_string(),
                subject_index,
                total_subjects,
                pages_fetched: page_num as usize,
                articles_found: *total_found,
                articles_saved: *total_saved,
                errors: Vec::new(),
                is_running: true,
            });
            page += 1;
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }

        Ok(())
    }

    /// Fetch and parse a single article detail page
    async fn fetch_article_page(
        &self,
        url: &str,
        subject: &str,
    ) -> Result<Option<CrawledArticle>, String> {
        let response = self.client.get(url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let html = response.text().await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        parse_article_page(&html, url, subject)
    }
}

// ==========================================
// Standalone save function (每爬一篇立即写入)
// ==========================================

/// 将单篇文章写入数据库。返回 true=新增, false=已存在(仅补充分类)
fn save_article(pool: &DbPool, article: &CrawledArticle, subject: &str) -> Result<bool, String> {
    let conn = pool.get().map_err(|e| format!("获取数据库连接失败: {}", e))?;

    // 检查是否已存在
    if paper_exists_by_preprint(&conn, &article.preprint_number)? {
        // 已存在：补充分类（可能同一个 preprint 出现在多个分类中）
        if let Ok(Some(existing_id)) = get_article_id_by_preprint(&conn, &article.preprint_number) {
            conn.execute(
                "INSERT OR IGNORE INTO paper_categories (article_id, category) VALUES (?1, ?2)",
                params![existing_id, subject],
            ).map_err(|e| format!("补充分类失败: {}", e))?;
        }
        return Ok(false);
    }

    let paper = Paper {
        article_id: 0,
        title: article.title.clone(),
        abstract_text: Some(article.abstract_text.clone()),
        publication_date: Some(article.submit_date.format("%Y-%m-%d").to_string()),
        preprint_number: Some(article.preprint_number.clone()),
        venue_id: None,
        venue_name: None,
        venue_abbreviation: None,
        venue_type: None,
        publication_link: Some(article.publication_link.clone()),
        pdf_link: Some(article.pdf_link.clone()),
        pdf_path: None,
        rankings: None,
        authors: Some(article.authors.iter().map(|a| a.name.clone()).collect()),
        categories: Some(article.subjects.clone()),
        is_favorited: None,
    };

    insert_paper(&conn, &paper)?;
    Ok(true)
}

/// 通过 preprint_number 查询已有文章 ID
fn get_article_id_by_preprint(conn: &DbConnection, preprint: &str) -> Result<Option<i64>, String> {
    let sql = "SELECT article_id FROM papers WHERE preprint_number = ?";
    match conn.query_row(sql, params![preprint], |row| row.get(0)) {
        Ok(id) => Ok(Some(id)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("查询文章ID失败: {}", e)),
    }
}

/// A single crawled article (before DB storage)
#[derive(Debug, Clone)]
pub struct CrawledArticle {
    pub title: String,
    pub abstract_text: String,
    pub submit_date: chrono::DateTime<Utc>,
    pub preprint_number: String,
    pub subjects: Vec<String>,
    pub authors: Vec<CrawledAuthor>,
    pub publication_link: String,
    pub pdf_link: String,
}

#[derive(Debug, Clone)]
pub struct CrawledAuthor {
    pub name: String,
}


/// Parse the arXiv listing page to extract article detail page links
fn parse_list_page(html: &str) -> Result<Vec<String>, String> {
    let document = Html::parse_document(html);
    let dt_selector = Selector::parse("dl dt").map_err(|e| format!("CSS选择器解析失败: {}", e))?;

    let mut links = Vec::new();
    for dt_element in document.select(&dt_selector) {
        // Find <a title="Abstract"> inside the <dt>
        let a_selector = Selector::parse("a[title='Abstract']").unwrap();
        if let Some(link) = dt_element.select(&a_selector).next() {
            if let Some(href) = link.value().attr("href") {
                links.push(href.to_string());
            }
        }
    }

    Ok(links)
}

/// Parse the arXiv article detail page to extract metadata
fn parse_article_page(html: &str, url: &str, subject: &str) -> Result<Option<CrawledArticle>, String> {
    let document = Html::parse_document(html);

    // Extract title
    let title_selector = Selector::parse("h1.title.mathjax")
        .map_err(|e| format!("CSS选择器解析失败: {}", e))?;
    let title = document.select(&title_selector).next()
        .map(|el| {
            el.text().collect::<String>()
                .replace("Title:", "")
                .trim()
                .to_string()
        })
        .ok_or_else(|| "找不到标题".to_string())?;

    // Extract submission date
    let history_selector = Selector::parse("div.submission-history")
        .map_err(|e| format!("CSS选择器解析失败: {}", e))?;
    let history_text = document.select(&history_selector).next()
        .map(|el| el.text().collect::<String>())
        .ok_or_else(|| "找不到提交历史".to_string())?;

    let date_re = Regex::new(r"(\w{3}, \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} UTC)")
        .map_err(|e| format!("正则表达式编译失败: {}", e))?;
    let date_str = date_re.captures(&history_text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str())
        .ok_or_else(|| format!("找不到提交日期: {}", history_text))?;

    // Parse date: "Mon, 1 Jan 2024 12:34:56 UTC"
    let submit_date = DateTime::parse_from_str(
        &date_str.replace(" UTC", " +0000"),
        "%a, %d %b %Y %H:%M:%S %z"
    ).map_err(|e| format!("日期解析失败 '{}': {}", date_str, e))?
    .with_timezone(&Utc);

    // Extract authors
    let authors_selector = Selector::parse("div.authors")
        .map_err(|e| format!("CSS选择器解析失败: {}", e))?;
    let authors_div = document.select(&authors_selector).next()
        .ok_or_else(|| "找不到作者信息".to_string())?;

    let a_selector = Selector::parse("a").unwrap();
    let mut authors = Vec::new();
    for a in authors_div.select(&a_selector) {
        let name = a.text().collect::<String>().trim().to_string();
        if a.value().attr("href").is_some() {
            authors.push(CrawledAuthor { name });
        }
    }

    // Extract abstract
    let abstract_selector = Selector::parse("blockquote.abstract.mathjax")
        .map_err(|e| format!("CSS选择器解析失败: {}", e))?;
    let abstract_text = document.select(&abstract_selector).next()
        .map(|el| {
            el.text().collect::<String>()
                .replace("Abstract:", "")
                .replace("abstract:", "")
                .trim()
                .to_string()
        })
        .ok_or_else(|| "找不到摘要".to_string())?;

    // Extract PDF link and preprint number
    let pdf_selector = Selector::parse("a.download-pdf")
        .map_err(|e| format!("CSS选择器解析失败: {}", e))?;
    let pdf_href = document.select(&pdf_selector).next()
        .and_then(|el| el.value().attr("href"))
        .ok_or_else(|| "找不到PDF链接".to_string())?;

    let pdf_link = if pdf_href.starts_with("http") {
        pdf_href.to_string()
    } else {
        format!("https://arxiv.org{}", pdf_href)
    };

    let preprint_number = pdf_link.split('/').last()
        .unwrap_or("")
        .replace(".pdf", "");

    let publication_link = url.to_string();

    let article = CrawledArticle {
        title,
        abstract_text,
        submit_date,
        preprint_number,
        subjects: vec![subject.to_string()],
        authors,
        publication_link,
        pdf_link,
    };

    Ok(Some(article))
}

/// Get last crawl date from settings.json
fn get_last_crawl_date() -> Option<String> {
    let settings = ensure_settings().ok()?;
    settings.get("lastCrawlTime")?.as_str().map(|s| s.to_string())
}

/// Update last crawl date in settings.json
fn update_last_crawl_date(date: &str) -> Result<(), String> {
    let mut settings = ensure_settings()?;
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("lastCrawlTime".to_string(), serde_json::Value::String(date.to_string()));
    }
    save_settings(settings)?;
    Ok(())
}