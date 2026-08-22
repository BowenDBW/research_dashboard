// Cloud LLM implementation
// Handles OpenAI-format API calls for cloud providers

use crate::llm::types::*;
use reqwest::Client;
use futures::StreamExt;
use std::time::Duration;

/// Cloud LLM provider
pub struct CloudLlmProvider {
    client: Client,
    endpoint: String,
    api_key: String,
    model: String,
}

impl CloudLlmProvider {
    /// Create a new cloud provider
    pub fn new(config: ProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            endpoint: config.endpoint,
            api_key: config.api_key,
            model: config.model,
        }
    }

    /// Send a chat completion request (non-streaming)
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<String, String> {
        let request = ChatCompletionRequest {
            model: self.model.clone(),
            messages,
            stream: None,
            max_tokens: Some(4096),
        };

        // 统一补 /v1：Ollama 的 OpenAI 兼容接口挂在 /v1 下（http://127.0.0.1:11434/v1/chat/completions），
        // 云端 endpoint 一般已含 /v1。不补会拼出 http://127.0.0.1:11434/chat/completions，Ollama 返回 404。
        let url = format!("{}/chat/completions", ensure_v1_path(&self.endpoint));

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("发送请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API 返回错误 {}: {}", status, body));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let content = completion.choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(content)
    }

    /// Send a chat completion request with streaming
    pub async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<impl futures::Stream<Item = Result<String, String>>, String> {
        let request = ChatCompletionRequest {
            model: self.model.clone(),
            messages,
            stream: Some(true),
            max_tokens: Some(4096),
        };

        let url = format!("{}/chat/completions", ensure_v1_path(&self.endpoint));

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("发送请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("API 返回错误 {}", status));
        }

        let stream = response.bytes_stream()
            .then(|chunk| async move {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        // Parse SSE format: "data: {...}"
                        for line in text.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if data == "[DONE]" {
                                    return Ok("[DONE]".to_string());
                                }
                                // Try to parse the stream response
                                if let Ok(stream_resp) = serde_json::from_str::<StreamResponse>(data) {
                                    if let Some(choice) = stream_resp.choices.first() {
                                        if let Some(content) = &choice.delta.content {
                                            return Ok(content.clone());
                                        }
                                    }
                                }
                            }
                        }
                        Ok(String::new())
                    }
                    Err(e) => Err(format!("读取流失败: {}", e)),
                }
            });

        Ok(stream)
    }

    /// Test connection to the provider
    pub async fn test_connection(endpoint: &str, api_key: &str) -> Result<ConnectionTestResult, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

        let url = format!("{}/models", ensure_v1_path(endpoint));

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| format!("发送请求失败: {}", e))?;

        if response.status().is_success() {
            Ok(ConnectionTestResult {
                success: true,
                message: "连接成功".to_string(),
            })
        } else {
            let status = response.status();
            Ok(ConnectionTestResult {
                success: false,
                message: format!("HTTP 错误: {}", status),
            })
        }
    }
}

/// 把 endpoint 归一化为 OpenAI 兼容的 base URL（以 `/v1` 结尾）。
///
/// Ollama 的 OpenAI 兼容接口挂在 `/v1` 下（`http://127.0.0.1:11434/v1/chat/completions`），
/// 云端（OpenAI / DeepSeek 等）的 endpoint 一般已含 `/v1`。统一补上，幂等：
/// 无论用户填 `http://127.0.0.1:11434`、`http://127.0.0.1:11434/` 还是 `https://api.openai.com/v1`，
/// 都得到以 `/v1` 结尾的 base URL，避免拼出 404 地址。
fn ensure_v1_path(endpoint: &str) -> String {
    let trimmed = endpoint.trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        trimmed.to_string()
    } else {
        format!("{}/v1", trimmed)
    }
}

#[cfg(test)]
mod url_tests {
    use super::ensure_v1_path;

    #[test]
    fn normalizes_endpoint_to_v1() {
        assert_eq!(ensure_v1_path("http://127.0.0.1:11434"), "http://127.0.0.1:11434/v1");
        assert_eq!(ensure_v1_path("http://127.0.0.1:11434/"), "http://127.0.0.1:11434/v1");
        assert_eq!(ensure_v1_path("https://api.openai.com/v1"), "https://api.openai.com/v1");
        assert_eq!(ensure_v1_path("https://api.deepseek.com/v1/"), "https://api.deepseek.com/v1");
    }
}