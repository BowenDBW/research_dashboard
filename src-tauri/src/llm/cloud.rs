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

        // Endpoint should already include /v1 if needed
        let url = format!("{}/chat/completions", self.endpoint);

        // Debug output
        eprintln!("[DEBUG] Cloud chat request:");
        eprintln!("[DEBUG]   endpoint: {}", self.endpoint);
        eprintln!("[DEBUG]   url: {}", url);
        eprintln!("[DEBUG]   model: {}", self.model);
        eprintln!("[DEBUG]   api_key length: {} (empty: {})", self.api_key.len(), self.api_key.is_empty());
        eprintln!("[DEBUG]   messages count: {}", request.messages.len());

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

        // Endpoint should already include /v1 if needed
        let url = format!("{}/chat/completions", self.endpoint);

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

        let url = format!("{}/models", endpoint);

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

/// Test connection for a local server provider (Ollama style)
pub async fn test_local_connection(endpoint: &str) -> Result<ConnectionTestResult, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // Ollama uses /api/tags endpoint
    let url = format!("{}/api/tags", endpoint);

    let response = client
        .get(&url)
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