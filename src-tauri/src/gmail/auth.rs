// Gmail OAuth2 authentication module
// Handles the OAuth2 device flow for desktop apps using reqwest directly

use std::path::PathBuf;
use serde::{Deserialize, Serialize};

const SCOPES: &str = "https://www.googleapis.com/auth/gmail.readonly";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

/// Stored OAuth token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
}

/// Token response from Google
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    token_type: Option<String>,
}

/// Get the token storage path
fn get_token_path() -> Result<PathBuf, String> {
    let data_dir = crate::settings::ensure_data_dir()?;
    Ok(data_dir.join("gmail_token.json"))
}

/// Check if a token file exists
pub fn has_token() -> bool {
    get_token_path().map(|p| p.exists()).unwrap_or(false)
}

/// Read stored token from disk
pub fn read_stored_token() -> Result<Option<StoredToken>, String> {
    let path = get_token_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取Token文件失败: {}", e))?;
    let token: StoredToken = serde_json::from_str(&content)
        .map_err(|e| format!("解析Token文件失败: {}", e))?;
    Ok(Some(token))
}

/// Write token to disk
pub fn write_stored_token(token: &StoredToken) -> Result<(), String> {
    let path = get_token_path()?;
    let content = serde_json::to_string_pretty(token)
        .map_err(|e| format!("序列化Token失败: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入Token文件失败: {}", e))?;
    Ok(())
}

/// Delete stored token
pub fn delete_token() -> Result<(), String> {
    let path = get_token_path()?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("删除Token文件失败: {}", e))?;
    }
    Ok(())
}

/// Get an access token, refreshing if necessary
pub async fn get_access_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    // Try reading stored token first
    if let Some(stored) = read_stored_token()? {
        // Check if token is still valid (with 5 min buffer)
        if let Some(expires_at) = stored.expires_at {
            let now = chrono::Utc::now().timestamp();
            if now < expires_at - 300 {
                return Ok(stored.access_token);
            }
        }

        // Try to refresh token
        if let Some(refresh_token) = &stored.refresh_token {
            match refresh_access_token(client_id, client_secret, refresh_token).await {
                Ok(new_token) => return Ok(new_token),
                Err(_) => {
                    delete_token()?;
                }
            }
        }
    }

    Err("未授权，请先完成Gmail OAuth认证".to_string())
}

/// Refresh an access token using a refresh token
async fn refresh_access_token(client_id: &str, client_secret: &str, refresh_token: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let resp = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("刷新Token请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("刷新Token失败 ({}): {}", status, body));
    }

    let token_resp: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析Token响应失败: {}", e))?;

    let stored = StoredToken {
        access_token: token_resp.access_token.clone(),
        refresh_token: token_resp.refresh_token.or_else(|| Some(refresh_token.to_string())),
        expires_at: token_resp.expires_in.map(|d| chrono::Utc::now().timestamp() + d),
    };
    write_stored_token(&stored)?;

    Ok(token_resp.access_token)
}

/// Perform OAuth2 authorization flow (opens browser)
pub async fn authorize(client_id: &str, client_secret: &str) -> Result<String, String> {
    // Start a local server to listen for the redirect
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("无法启动本地服务器: {}", e))?;
    let local_port = listener.local_addr()
        .map_err(|e| format!("获取端口失败: {}", e))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{}/", local_port);

    // Build the authorization URL
    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&access_type=offline&prompt=consent",
        AUTH_URL, client_id, redirect_uri, SCOPES
    );

    println!("请在浏览器中打开以下链接进行授权:");
    println!("{}", auth_url);

    // Try to open browser automatically
    let _ = open::that(&auth_url);

    // Wait for the redirect
    let (socket, _) = listener
        .accept()
        .await
        .map_err(|e| format!("等待回调失败: {}", e))?;

    // Read the HTTP request to get the authorization code
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buf = vec![0u8; 4096];
    let _ = socket
        .readable()
        .await
        .map_err(|e| format!("等待可读失败: {}", e))?;
    let n = socket.try_read(&mut buf).map_err(|e| format!("读取请求失败: {}", e))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // Extract the authorization code from the query string
    let code = extract_auth_code(&request)?;

    // Send response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<!DOCTYPE html><html><body><h1>授权成功!</h1><p>请关闭此页面返回应用。</p></body></html>";
    let mut socket = socket;
    let _ = socket
        .writable()
        .await
        .map_err(|e| format!("等待可写失败: {}", e))?;
    let _ = socket.try_write(response.as_bytes());

    // Exchange the authorization code for tokens
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let params = [
        ("code", &code),
        ("client_id", &client_id.to_string()),
        ("client_secret", &client_secret.to_string()),
        ("redirect_uri", &redirect_uri),
        ("grant_type", &"authorization_code".to_string()),
    ];

    let resp = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("交换授权码请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("交换授权码失败 ({}): {}", status, body));
    }

    let token_resp: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析Token响应失败: {}", e))?;

    let access_token = token_resp.access_token;
    let expires_at = token_resp.expires_in.map(|d| chrono::Utc::now().timestamp() + d);

    // Store the token
    let stored = StoredToken {
        access_token: access_token.clone(),
        refresh_token: token_resp.refresh_token,
        expires_at,
    };
    write_stored_token(&stored)?;

    Ok(access_token)
}

/// Extract authorization code from HTTP request
fn extract_auth_code(request: &str) -> Result<String, String> {
    // Parse the first line: GET /?code=xxx&state=yyy HTTP/1.1
    let first_line = request.lines().next().unwrap_or("");
    let query = first_line
        .split(' ')
        .nth(1)
        .unwrap_or("")
        .to_string();

    // Parse query string
    let params: std::collections::HashMap<String, String> = query
        .trim_start_matches("/?")
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            match (parts.next(), parts.next()) {
                (Some(k), Some(v)) => Some((k.to_string(), urlencoding_decode(v))),
                _ => None,
            }
        })
        .collect();

    params
        .get("code")
        .cloned()
        .ok_or_else(|| "未找到授权码".to_string())
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