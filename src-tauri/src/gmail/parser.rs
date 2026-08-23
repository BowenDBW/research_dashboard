// Scholar Alert email parser module
// Parses Google Scholar Alert email HTML to extract paper information

use regex::Regex;
use super::{ParsedScholarArticle, ParsedScholarEmail};

/// Extract scholar name from email subject
pub fn extract_scholar_name(subject: &str) -> String {
    let patterns = [
        r"^(.+?)\s*[—\-–]\s*新的相关研究工作",
        r"^(.+?)\s*[—\-–]\s*new related research",
        r"^(.+?)\s*[—\-–]\s*新文章",
        r"^(.+?)\s*[—\-–]\s*(?i:new articles)",             // 不区分大小写（实际邮件有 "new articles"）
        r"^(.+?)\s*的文章新增了",
        r"^(\d+)\s*new citation[s]? to articles? by\s+(.+)", // 单复数都兼容（citation/citations, article/articles）
        r"^(.+?)\s*的文章新增了",
        r"^([^,]+),",                                        // 兜底："Jieping Ye, IEEE Fellow ..." -> "Jieping Ye"
    ];

    for pattern in &patterns {
        if let Some(caps) = Regex::new(pattern).ok().and_then(|re| re.captures(subject)) {
            if pattern.starts_with(r"^(\d+)") {
                return caps.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            }
            return caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
        }
    }
    String::new()
}

/// Check if a title looks like a real paper (not a scholar name or button text)
pub fn is_paper_title(title: &str) -> bool {
    let title = title.trim();
    if title.len() < 8 {
        return false;
    }

    // 含中日韩/韩文等字符的标题直接视为论文
    // （本功能里的学者名均为拉丁字母，中文/韩文标题只可能是真实论文标题）
    let has_cjk = title.chars().any(|c| {
        let u = c as u32;
        (0x4E00..=0x9FFF).contains(&u)      // CJK 统一汉字
            || (0x3040..=0x30FF).contains(&u) // 日文假名
            || (0xAC00..=0xD7AF).contains(&u) // 韩文音节
    });
    if has_cjk {
        return true;
    }

    // Check if it's just a name (2-4 words, no uppercase letters after first char)
    // 注意：不能按字节切片 title[1..]，遇到多字节字符会 panic，必须按 char 迭代判断。
    let words: Vec<&str> = title.split_whitespace().collect();
    if words.len() <= 4 && !title.chars().skip(1).any(char::is_uppercase) {
        return false;
    }

    // Filter out common non-paper entries
    let lower = title.to_lowercase();
    if matches!(lower.as_str(), "view" | "cancel" | "alert" | "alerts" | "download") {
        return false;
    }

    // Long titles are almost always papers
    if title.len() > 15 {
        return true;
    }

    // Titles with colons are typically papers
    if title.contains(':') {
        return true;
    }

    false
}

/// Extract arXiv ID from a URL
pub fn extract_arxiv_id(url: &str) -> Option<String> {
    let re = Regex::new(r"arxiv\.org/(?:pdf|abs)/([0-9]+\.[0-9]+)").ok()?;
    re.captures(url)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// 把 RFC2822 Date 头解析成 UTC+8 时区的完整时间 "YYYY-MM-DD HH:MM:SS"。
/// 用于天内邮件排序 / email_received_at 存储。解析失败返回 None。
pub fn email_send_datetime(raw_date: &str) -> Option<String> {
    // 标准 RFC2822 格式，如 "Tue, 18 Aug 2026 03:21:45 +0000"
    chrono::DateTime::parse_from_str(raw_date, "%a, %d %b %Y %H:%M:%S %z").ok()
        .map(|dt| {
            let tz8 = chrono::FixedOffset::east_opt(8 * 3600).unwrap();
            dt.with_timezone(&tz8).format("%Y-%m-%d %H:%M:%S").to_string()
        })
}

/// 从邮件 Date 头提取发送日期（统一转成 UTC+8），返回 "YYYY-MM-DD"。
/// 推荐分组必须按邮件发送时间，而不是同步/爬取时间。
pub fn email_send_date(raw_date: &str) -> Option<String> {
    email_send_datetime(raw_date)
        .map(|dt| dt[..10].to_string())
}

/// Parse a full Scholar Alert email into structured data
pub fn parse_scholar_email(
    gmail_message_id: &str,
    payload: &crate::gmail::client::MessagePayload,
    snippet: &str,
) -> Result<ParsedScholarEmail, String> {
    let from = crate::gmail::client::get_header(payload, "From")
        .unwrap_or_default();
    let subject = crate::gmail::client::get_header(payload, "Subject")
        .unwrap_or_default();
    let date = crate::gmail::client::get_header(payload, "Date")
        .unwrap_or_default();

    let scholar_name = extract_scholar_name(&subject);

    // Extract HTML body
    let html = crate::gmail::client::extract_html_body(payload)
        .unwrap_or_default();

    // Parse articles from HTML
    let articles = parse_articles_from_html(&html);

    Ok(ParsedScholarEmail {
        gmail_message_id: gmail_message_id.to_string(),
        scholar_name,
        recommended_at: date,
        sender_email: from,
        subject,
        raw_snippet: snippet.to_string(),
        articles,
    })
}

/// Parse articles from Scholar Alert HTML
fn parse_articles_from_html(html: &str) -> Vec<ParsedScholarArticle> {
    let mut articles = Vec::new();

    // 匹配所有 gse_alrt_title 链接。
    // 注意：Google 邮件的属性顺序不固定（href 可能在 class 前也可能在后），
    // 所以先捕获整个 <a ...> 开标签，再从标签里单独提取 href。
    let link_re = Regex::new(
        r#"<a\b(?P<opentag>[^>]*class="gse_alrt_title"[^>]*)>(?P<title>.*?)</a>"#
    ).unwrap();
    let href_re = Regex::new(r#"href="([^"]*)""#).unwrap();

    let mut title_matches: Vec<(String, String, usize)> = Vec::new();

    for cap in link_re.captures_iter(html) {
        let opentag = cap.name("opentag").map(|m| m.as_str()).unwrap_or("");
        let url = href_re.captures(opentag)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str())
            .unwrap_or("")
            .to_string();
        let title_html = cap.name("title").map(|m| m.as_str()).unwrap_or("");
        let title = html_escape_to_text(title_html);
        let start = cap.get(0).map(|m| m.start()).unwrap_or(0);
        title_matches.push((title, url, start));
    }

    for (i, (title, url, _start)) in title_matches.iter().enumerate() {
        if !is_paper_title(title) {
            continue;
        }

        // Extract actual URL from scholar_url
        let actual_url = extract_actual_url(url);

        // Extract arXiv ID
        let arxiv_id = extract_arxiv_id(&actual_url);

        // Extract authors/source from surrounding text
        let authors_source = extract_authors_source(html, i, &title_matches);

        // Get the actual paper URL
        let clean_url = if actual_url.starts_with("http") {
            actual_url.clone()
        } else {
            url.clone()
        };

        articles.push(ParsedScholarArticle {
            title: title.clone(),
            url: clean_url,
            authors_source,
            arxiv_id,
        });
    }

    articles
}

/// Extract the actual URL from a Google Scholar URL
fn extract_actual_url(url: &str) -> String {
    if let Some(pos) = url.find("scholar_url?url=") {
        let after = &url[pos + "scholar_url?url=".len()..];
        let decoded = urlencoding_decode(after);
        if let Some(amp_pos) = decoded.find('&') {
            return decoded[..amp_pos].to_string();
        }
        return decoded;
    }
    url.to_string()
}

/// Extract authors/source text from around the title in the HTML
fn extract_authors_source(
    html: &str,
    index: usize,
    all_matches: &[(String, String, usize)],
) -> String {
    // Find the text between this title link and the next one
    let start_pos = if index + 1 < all_matches.len() {
        // Find the closing </a> tag after this title
        let search_from = all_matches[index].2;
        if let Some(end) = html[search_from..].find("</a>") {
            search_from + end + 4
        } else {
            all_matches[index].2 + 100
        }
    } else {
        all_matches[index].2 + 100
    };

    let end_pos = if index + 1 < all_matches.len() {
        all_matches[index + 1].2
    } else {
        html.len()
    };

    if start_pos < end_pos && end_pos <= html.len() {
        let between = &html[start_pos..end_pos];
        let text = Regex::new(r"<[^>]+>").unwrap().replace_all(between, " ");
        let text = Regex::new(r"\s+").unwrap().replace_all(&text, " ");
        let text = text.trim().to_string();

        // Take text before the first bullet or button
        if let Some(pos) = text.find('•') {
            return text[..pos].trim().to_string();
        }
        if let Some(pos) = text.find("View") {
            return text[..pos].trim().to_string();
        }
        if let Some(pos) = text.find("Cancel") {
            return text[..pos].trim().to_string();
        }

        return text.chars().take(200).collect();
    }

    String::new()
}

/// Convert HTML escaped text to plain text
fn html_escape_to_text(html: &str) -> String {
    let text = Regex::new(r"<[^>]+>").unwrap().replace_all(html, " ");
    let text = Regex::new(r"\s+").unwrap().replace_all(&text, " ");
    let mut text = text.trim().to_string();

    // Decode HTML entities
    let entities = [
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", "\""),
        ("&#39;", "'"),
        ("&nbsp;", " "),
    ];
    for (entity, char) in &entities {
        text = text.replace(entity, char);
    }

    text
}

/// Simple URL decoding
fn urlencoding_decode(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_scholar_name_english() {
        assert_eq!(extract_scholar_name("Lingming Zhang - new related research"), "Lingming Zhang");
        assert_eq!(extract_scholar_name("Yuanqing Zheng - new related research"), "Yuanqing Zheng");
    }

    #[test]
    fn test_extract_scholar_name_chinese() {
        assert_eq!(extract_scholar_name("Jiliang Wang - 新的相关研究工作"), "Jiliang Wang");
        assert_eq!(extract_scholar_name("Ziqian Liu - 新文章"), "Ziqian Liu");
    }

    #[test]
    fn test_extract_scholar_name_citation() {
        assert_eq!(extract_scholar_name("Jiliang Wang的文章新增了 2 次引用"), "Jiliang Wang");
        assert_eq!(extract_scholar_name("2 new citations to articles by Yuanqing Zheng"), "Yuanqing Zheng");
    }

    #[test]
    fn test_extract_scholar_name_singular_citation() {
        // 单数 "citation"（原正则只匹配复数 "citations"）
        assert_eq!(extract_scholar_name("1 new citation to articles by Yuanqing Zheng"), "Yuanqing Zheng");
    }

    #[test]
    fn test_extract_scholar_name_lowercase_new_articles() {
        // 小写 "new articles"（原正则只匹配大写 "New articles"）
        assert_eq!(extract_scholar_name("Yuanqing Zheng - new articles"), "Yuanqing Zheng");
    }

    #[test]
    fn test_extract_scholar_name_profile_style() {
        // 作者主页风格标题 -> 取逗号前部分
        assert_eq!(extract_scholar_name("Jieping Ye, IEEE Fellow & ACM Distinguished Member ..."), "Jieping Ye");
    }

    #[test]
    fn test_is_paper_title_multibyte_no_panic() {
        // 多字节标题（韩文）不应 panic，且含大写（CSS）应判为论文
        let t = "극저신호대잡음비환경에서잠재학습과잔차학습기반의LoRa CSS 복조성능비교.";
        assert!(is_paper_title(t));
        // 纯中文长标题也应判为论文
        assert!(is_paper_title("基于深度学习的无线通信信号调制识别方法研究"));
    }

    #[test]
    fn test_is_paper_title() {
        assert!(is_paper_title("Attention Is All You Need: A Transformer Approach"));
        assert!(is_paper_title("Beyond the Limit: A Transformer-Based Approach"));
        assert!(!is_paper_title("Jiliang Wang"));
        assert!(!is_paper_title("Yuanqing Zheng"));
        assert!(!is_paper_title("View"));
    }

    #[test]
    fn test_email_send_date() {
        // 标准 RFC2822，带 +0000 时区
        assert_eq!(email_send_date("Tue, 18 Aug 2026 03:21:45 +0000"), Some("2026-08-18".to_string()));
        // 带非零时区，UTC+8 后日期可能跨天
        assert_eq!(email_send_date("Mon, 17 Aug 2026 23:00:00 -0700"), Some("2026-08-18".to_string()));
        // 无法解析
        assert_eq!(email_send_date(""), None);
    }

    #[test]
    fn test_email_send_datetime() {
        // 完整时间（UTC+8）
        assert_eq!(
            email_send_datetime("Tue, 18 Aug 2026 03:21:45 +0000"),
            Some("2026-08-18 11:21:45".to_string())
        );
        // 跨天：UTC+8 后日期+1
        assert_eq!(
            email_send_datetime("Mon, 17 Aug 2026 23:00:00 -0700"),
            Some("2026-08-18 14:00:00".to_string())
        );
        // 无法解析
        assert_eq!(email_send_datetime(""), None);
    }

    #[test]
    fn test_extract_arxiv_id() {
        assert_eq!(
            extract_arxiv_id("https://arxiv.org/pdf/2607.01876"),
            Some("2607.01876".to_string())
        );
        assert_eq!(
            extract_arxiv_id("https://arxiv.org/abs/2301.12345"),
            Some("2301.12345".to_string())
        );
        assert_eq!(
            extract_arxiv_id("https://ieeexplore.ieee.org/abstract/123"),
            None
        );
    }
}