// Gmail API client module
// Handles communication with the Gmail REST API

use reqwest::header::{AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

const GMAIL_API_BASE: &str = "https://gmail.googleapis.com/gmail/v1/users/me";

/// Create a reqwest client with a 30-second timeout to prevent hanging.
fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

/// Gmail message list response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageListResponse {
    pub messages: Option<Vec<MessageRef>>,
    pub next_page_token: Option<String>,
    pub result_size_estimate: Option<u32>,
}

/// Gmail message reference
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRef {
    pub id: String,
    pub thread_id: String,
}

/// Gmail message detail
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDetail {
    pub id: Option<String>,
    pub thread_id: Option<String>,
    pub label_ids: Option<Vec<String>>,
    pub snippet: Option<String>,
    pub payload: Option<MessagePayload>,
    pub internal_date: Option<String>,
}

/// Gmail message payload
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessagePayload {
    pub mime_type: Option<String>,
    pub headers: Option<Vec<MessageHeader>>,
    pub body: Option<MessageBody>,
    pub parts: Option<Vec<MessagePayload>>,
}

/// Gmail message header
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageHeader {
    pub name: Option<String>,
    pub value: Option<String>,
}

/// Gmail message body
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageBody {
    pub data: Option<String>,
    pub attachment_id: Option<String>,
    pub size: Option<i32>,
}

/// Gmail profile
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailProfile {
    pub email_address: Option<String>,
    pub messages_total: Option<i64>,
    pub threads_total: Option<i64>,
}

/// Search for Gmail messages
pub async fn search_messages(
    access_token: &str,
    query: &str,
    max_results: u32,
) -> Result<MessageListResponse, String> {
    let client = http_client()?;
    let url = format!("{}/messages", GMAIL_API_BASE);

    let response = client
        .get(&url)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(USER_AGENT, "ResearchDashboard/1.0")
        .query(&[
            ("q", query),
            ("maxResults", &max_results.to_string()),
        ])
        .send()
        .await
        .map_err(|e| format!("Gmail API请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gmail API错误 ({}): {}", status, body));
    }

    response
        .json::<MessageListResponse>()
        .await
        .map_err(|e| format!("解析Gmail API响应失败: {}", e))
}

/// Get message detail
pub async fn get_message(
    access_token: &str,
    message_id: &str,
    format: &str,
) -> Result<MessageDetail, String> {
    let client = http_client()?;
    let url = format!("{}/messages/{}", GMAIL_API_BASE, message_id);

    let response = client
        .get(&url)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(USER_AGENT, "ResearchDashboard/1.0")
        .query(&[("format", format)])
        .send()
        .await
        .map_err(|e| format!("Gmail API请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gmail API错误 ({}): {}", status, body));
    }

    response
        .json::<MessageDetail>()
        .await
        .map_err(|e| format!("解析Gmail API响应失败: {}", e))
}

/// Get user's Gmail profile
pub async fn get_profile(access_token: &str) -> Result<GmailProfile, String> {
    let client = http_client()?;
    let url = format!("{}/profile", GMAIL_API_BASE);

    let response = client
        .get(&url)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(USER_AGENT, "ResearchDashboard/1.0")
        .send()
        .await
        .map_err(|e| format!("Gmail API请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gmail API错误 ({}): {}", status, body));
    }

    response
        .json::<GmailProfile>()
        .await
        .map_err(|e| format!("解析Gmail API响应失败: {}", e))
}

/// Extract header value from message payload
pub fn get_header(payload: &MessagePayload, name: &str) -> Option<String> {
    payload
        .headers
        .as_ref()?
        .iter()
        .find(|h| h.name.as_deref() == Some(name))
        .and_then(|h| h.value.clone())
}

/// Extract text/html body from message payload (recursive)
pub fn extract_html_body(payload: &MessagePayload) -> Option<String> {
    if payload.mime_type.as_deref() == Some("text/html") {
        if let Some(body) = &payload.body {
            if let Some(data) = &body.data {
                return decode_base64url(data);
            }
        }
    }

    if let Some(parts) = &payload.parts {
        for part in parts {
            if let Some(html) = extract_html_body(part) {
                return Some(html);
            }
        }
    }

    None
}

/// Extract text/plain body from message payload (recursive)
pub fn extract_text_body(payload: &MessagePayload) -> Option<String> {
    if payload.mime_type.as_deref() == Some("text/plain") {
        if let Some(body) = &payload.body {
            if let Some(data) = &body.data {
                return decode_base64url(data);
            }
        }
    }

    if let Some(parts) = &payload.parts {
        for part in parts {
            if let Some(text) = extract_text_body(part) {
                return Some(text);
            }
        }
    }

    None
}

/// Decode base64url encoded string
fn decode_base64url(data: &str) -> Option<String> {
    // Add padding if needed
    let padded = format!("{}{}", data, "=".repeat((4 - data.len() % 4) % 4));
    let fixed = padded.replace('-', "+").replace('_', "/");

    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    let bytes = engine.decode(&fixed).ok()?;
    String::from_utf8(bytes).ok()
}