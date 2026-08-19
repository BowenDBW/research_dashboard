// Paper search service - LLM 关键词提取 + BM25 检索
// 检索流程：
//   1. 先用 LLM 从用户问题提取 BM25 关键词/短语
//   2. 对 papers 表（title + abstract）做 BM25 打分
//   3. 结合时间权重（新文章优先）与相关度排序，返回 Top N 文章

use std::collections::{HashMap, HashSet};
use rusqlite::params;
use serde_json::Value;
use tauri::AppHandle;

use crate::dao::DbConnection;
use crate::dao::papers::get_paper_by_id;
use crate::llm::{send_chat_message, ChatMessage, MessageRole};
use crate::models::Paper;

/// BM25 参数（标准默认值）
const K1: f64 = 1.5;
const B: f64 = 0.75;
/// 最终排序权重：相关度 0.7，时效 0.3
const RELEVANCE_WEIGHT: f64 = 0.7;
const RECENCY_WEIGHT: f64 = 0.3;
/// 时效半衰期：5 年前的文章时效分视为 0
const RECENCY_HALFLIFE_DAYS: f64 = 1825.0;

/// 一次检索命中的文章
pub struct PaperSearchHit {
    pub article_id: i64,
    pub score: f64,
    pub paper: Paper,
}

/// 简单分词：小写、按非字母数字切分
fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty() && s.len() >= 2)
        .map(|s| s.to_string())
        .collect()
}

/// 用 LLM 从用户问题中提取 BM25 检索关键词/短语（3-8 个，优先英文）
pub async fn extract_keywords(
    app_handle: &AppHandle,
    query: &str,
    model_id: &str,
    settings: Value,
) -> Result<Vec<String>, String> {
    let prompt = format!(
        "你是学术文献检索助手。根据用户下面的检索需求，提取 3-8 个最适合做 BM25 关键词检索的关键词或短语\
         （学术术语，优先英文，短语如 \"federated learning\"、\"program repair\"）。\
         只输出一个 JSON 字符串数组，不要输出任何其他内容、不要解释。\n\n用户需求：{}",
        query
    );
    let messages = vec![ChatMessage {
        role: MessageRole::User,
        content: prompt,
    }];
    let raw = send_chat_message(app_handle, messages, model_id.to_string(), settings).await?;

    // 从响应中截取 JSON 数组并解析
    let trimmed = raw.trim();
    if let (Some(s), Some(e)) = (trimmed.find('['), trimmed.rfind(']')) {
        if e > s {
            let slice = &trimmed[s..=e];
            if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(slice) {
                let words: Vec<String> = arr
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.is_empty())
                    .collect();
                if !words.is_empty() {
                    println!("[检索] LLM 提取关键词: {:?}", words);
                    return Ok(words);
                }
            }
        }
    }

    // 解析失败时回退：直接把用户 query 分词
    println!("[检索] LLM 关键词解析失败，回退为对 query 分词");
    Ok(tokenize(query))
}

/// 把 NaiveDate 转成"距离纪元的天数"
fn date_to_days(d: chrono::NaiveDate) -> i64 {
    d.and_hms_opt(0, 0, 0).unwrap().timestamp() / 86_400
}

/// 解析 publication_date 为"距离纪元的天数"，支持 YYYY-MM-DD / YYYY-MM / YYYY
fn parse_date_to_days(s: &str) -> Option<i64> {
    let d = if s.len() == 10 {
        chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
    } else if s.len() == 7 {
        let (y, m) = s.split_once('-')?;
        chrono::NaiveDate::from_ymd_opt(y.parse().ok()?, m.parse().ok()?, 1)
    } else if s.len() == 4 {
        let y: i32 = s.parse().ok()?;
        chrono::NaiveDate::from_ymd_opt(y, 1, 1)
    } else {
        None
    };
    d.map(date_to_days)
}

/// 时效分：0~1，新文章更接近 1
fn recency_score(date_str: &Option<String>) -> f64 {
    let s = date_str.as_deref().unwrap_or("");
    let today = date_to_days(chrono::Utc::now().date_naive());
    match parse_date_to_days(s) {
        Some(days) => {
            let age = (today - days).max(0) as f64;
            (1.0f64 - age / RECENCY_HALFLIFE_DAYS).clamp(0.0, 1.0)
        }
        None => 0.0,
    }
}

/// BM25 检索：对 papers 的 title+abstract 打分，结合时效权重排序，返回 Top N
pub fn bm25_search(
    conn: &DbConnection,
    keywords: &[String],
    limit: usize,
) -> Result<Vec<PaperSearchHit>, String> {
    // 1. 加载所有论文的标题/摘要/日期用于打分
    let mut stmt = conn
        .prepare("SELECT article_id, title, abstract, publication_date FROM papers")
        .map_err(|e| format!("准备检索语句失败: {}", e))?;

    struct ScoreDoc {
        article_id: i64,
        terms: Vec<String>,
        text_lower: String,
        date: Option<String>,
    }

    let mut docs: Vec<ScoreDoc> = Vec::new();
    {
        let rows = stmt
            .query_map([], |row| {
                let title: Option<String> = row.get(1)?;
                let abstract_text: Option<String> = row.get(2)?;
                let text = format!(
                    "{} {}",
                    title.unwrap_or_default(),
                    abstract_text.unwrap_or_default()
                );
                let text_lower = text.to_lowercase();
                Ok(ScoreDoc {
                    article_id: row.get(0)?,
                    terms: tokenize(&text),
                    text_lower,
                    date: row.get(3)?,
                })
            })
            .map_err(|e| format!("加载论文失败: {}", e))?;
        for r in rows.flatten() {
            docs.push(r);
        }
    }

    if docs.is_empty() {
        return Ok(Vec::new());
    }

    // 2. 统计文档频率 / 平均长度（BM25 前置数据）
    let n = docs.len() as f64;
    let mut doc_freq: HashMap<String, usize> = HashMap::new();
    let mut total_len: usize = 0;
    for doc in &docs {
        total_len += doc.terms.len();
        let mut seen: HashSet<&str> = HashSet::new();
        for t in &doc.terms {
            if seen.insert(t) {
                *doc_freq.entry(t.clone()).or_insert(0) += 1;
            }
        }
    }
    let avgdl = total_len as f64 / n;

    // 3. 查询词与短语
    let query_terms: Vec<String> = keywords.iter().flat_map(|k| tokenize(k)).collect();
    let query_phrases: Vec<String> = keywords
        .iter()
        .filter(|k| k.split_whitespace().count() > 1)
        .map(|k| k.to_lowercase())
        .collect();

    // 4. 逐文档打分（记录 bm25 原始分 + 时效分，稍后归一化合并）
    let mut raw: Vec<(i64, f64, f64)> = Vec::new();
    for doc in &docs {
        let dl = doc.terms.len() as f64;
        let mut tf: HashMap<&str, usize> = HashMap::new();
        for t in &doc.terms {
            *tf.entry(t.as_str()).or_insert(0) += 1;
        }

        let mut bm25 = 0.0f64;
        for term in &query_terms {
            if let Some(&f) = tf.get(term.as_str()) {
                let df = *doc_freq.get(term).unwrap_or(&0) as f64;
                if df == 0.0 {
                    continue;
                }
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();
                let f = f as f64;
                bm25 += idf * (f * (K1 + 1.0)) / (f + K1 * (1.0 - B + B * dl / avgdl));
            }
        }

        // 短语精确命中加分（文档包含完整短语）
        for phrase in &query_phrases {
            if doc.text_lower.contains(phrase.as_str()) {
                bm25 += 0.5;
            }
        }

        raw.push((doc.article_id, bm25, recency_score(&doc.date)));
    }

    // 5. 归一化 BM25 并合并时效权重
    let max_bm25 = raw.iter().map(|r| r.1).fold(0.0f64, f64::max);
    let mut final_scored: Vec<(i64, f64)> = raw
        .into_iter()
        .map(|(id, bm25, recency)| {
            let bm25_norm = if max_bm25 > 0.0 { bm25 / max_bm25 } else { 0.0 };
            let total = RELEVANCE_WEIGHT * bm25_norm + RECENCY_WEIGHT * recency;
            (id, total)
        })
        .collect();

    // 6. 排序取 Top N
    final_scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top: Vec<(i64, f64)> = final_scored.into_iter().take(limit).collect();

    // 7. 取完整论文
    let mut hits = Vec::new();
    for (id, score) in top {
        match get_paper_by_id(conn, id) {
            Ok(paper) => hits.push(PaperSearchHit {
                article_id: id,
                score,
                paper,
            }),
            Err(e) => println!("[检索] 加载论文 {} 失败: {}", id, e),
        }
    }
    println!("[检索] BM25 检索完成，命中 {} 篇", hits.len());

    Ok(hits)
}
