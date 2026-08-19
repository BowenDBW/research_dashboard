// LLM module for Research Dashboard
// Handles cloud and local LLM interactions

pub mod types;
pub mod cloud;
#[cfg(target_os = "macos")]
pub mod mlx;

use cloud::CloudLlmProvider;
#[cfg(target_os = "macos")]
use mlx::chat_with_mlx;
use serde_json::Value;

// Re-export main types
pub use types::{ChatMessage, MessageRole, ConnectionTestResult, ProviderConfig};
pub use cloud::test_local_connection;
#[cfg(target_os = "macos")]
pub use mlx::test_mlx_connection;

/// Check if MLX is available (always false on non-macOS)
pub fn is_mlx_available() -> bool {
    #[cfg(target_os = "macos")]
    { mlx::is_mlx_available() }
    #[cfg(not(target_os = "macos"))]
    { false }
}

/// Send a chat message to the appropriate provider based on model configuration
/// Returns the assistant's response content
pub async fn send_chat_message(
    app_handle: &tauri::AppHandle,
    messages: Vec<ChatMessage>,
    model_id: String,
    settings: Value,
) -> Result<String, String> {
    // Find the provider for this model
    let provider_info = find_provider_for_model(&model_id, &settings)?;

    let raw = match provider_info.provider_type.as_str() {
        "cloud" => {
            let provider = CloudLlmProvider::new(ProviderConfig {
                id: provider_info.provider_id,
                endpoint: provider_info.endpoint,
                api_key: provider_info.api_key,
                model: provider_info.model_name,
            });
            provider.chat(messages).await?
        }
        "local" => {
            // Check if it's MLX type
            if provider_info.local_type.as_deref() == Some("mlx") {
                #[cfg(target_os = "macos")]
                {
                    chat_with_mlx(app_handle, messages, provider_info.model_path.clone().unwrap_or_default(), None).await?
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = app_handle;
                    let _ = messages;
                    let _ = provider_info.model_path;
                    return Err("MLX 模型仅在 macOS 上可用".to_string());
                }
            } else {
                // Local server (like Ollama) uses OpenAI format
                let provider = CloudLlmProvider::new(ProviderConfig {
                    id: provider_info.provider_id,
                    endpoint: provider_info.endpoint,
                    api_key: "".to_string(), // No API key for local
                    model: provider_info.model_name,
                });
                provider.chat(messages).await?
            }
        }
        _ => return Err(format!("未知的 provider 类型: {}", provider_info.provider_type)),
    };

    // 仅本地部署的模型（实测 gemma4 / gpt-oss / qwen3.5）在生成时会输出思考过程
    // （`<|channel>`...`<channel|>`、`<|channel|>analysis<|message|>`...`<|end|>`、`Thinking Process:` 等）。
    // 保存/展示前剥离思考，只保留正文；云端 API 不产生思考，原样返回。
    if provider_info.provider_type == "local" {
        Ok(strip_thinking_from_response(&raw))
    } else {
        Ok(raw)
    }
}

/// Generate a short title for a chat session based on the first user message
/// Returns a title string (max ~50 characters)
pub async fn generate_session_title(
    app_handle: &tauri::AppHandle,
    first_user_message: String,
    model_id: String,
    settings: Value,
) -> Result<String, String> {
    let title_prompt = format!(
        "Based on the following user message, generate a very short title (3-10 words, preferably in Chinese if the message is Chinese) for this conversation. Only output the title, nothing else.\n\nUser message: {}",
        first_user_message
    );

    let messages = vec![ChatMessage {
        role: MessageRole::User,
        content: title_prompt,
    }];

    let title = send_chat_message(app_handle, messages, model_id, settings).await?;

    // 剥离思考过程：不同模型思考格式不同（实测 gemma4 / gpt-oss / qwen3.5）：
    //   - gemma4:  `<|channel>` 思考 `<channel|>` 标题      （思考包在 channel token 中）
    //   - gpt-oss: `<|channel|>analysis<|message|>` 思考 `<|end|><|start|>assistant<|channel|>final<|message|>` 标题
    //   - qwen3.5: `Thinking Process:` 纯文本思考 `\n\n` 标题
    // 三者共同点：真正的标题都出现在输出的最后一段非空文本。
    // 统一策略：把 `<...>` 特殊 token 当作分隔符替换为换行，跳过 "Thinking Process:" 前缀块，
    // 再取最后一个非空行作为标题。
    let cleaned_title: String = extract_title_from_response(&title)
        .replace("\"", "")
        .replace("'", "");

    // Limit to 50 characters max
    let final_title = if cleaned_title.len() > 50 {
        cleaned_title.chars().take(50).collect()
    } else if cleaned_title.is_empty() {
        "新对话".to_string()
    } else {
        cleaned_title
    };

    Ok(final_title)
}

/// 从模型响应中提取标题，剥离各模型的思考过程。
///
/// 思考格式因模型而异（见 [`generate_session_title`]），但真正的标题总在
/// 最后一段非空文本，因此这里做通用的结构化提取而不是硬编码某个模型：
/// 1. 把 `<...>` 特殊 token（gemma4 的 `<|channel>`/`<channel|>`、
///    gpt-oss 的 `<|channel|>analysis<|message|>`/`<|end|>`/`<|start|>assistant`/`<|channel|>final<|message|>` 等）
///    当作分隔符替换为换行；
/// 2. 跳过开头的 `Thinking Process:` 前缀块（qwen3.5 的纯文本思考前缀）；
/// 3. 取最后一个非空行作为标题。
fn extract_title_from_response(response: &str) -> String {
    let replaced = replace_special_tokens_with_newlines(response);

    let mut lines: Vec<&str> = replaced
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();

    // 跳过 qwen 等纯文本模型的思考前缀
    while let Some(first) = lines.first() {
        let lower = first.to_lowercase();
        if lower == "thinking process:" || lower.starts_with("thinking process:") {
            lines.remove(0);
        } else {
            break;
        }
    }

    lines.last().map(|s| s.to_string()).unwrap_or_default()
}

/// 把响应里的 `<...>` 特殊 token 替换成换行（token 内容直接丢弃）。
fn replace_special_tokens_with_newlines(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_token = false;
    for c in text.chars() {
        if c == '<' {
            in_token = true;
            out.push('\n');
        } else if c == '>' {
            in_token = false;
        } else if !in_token {
            out.push(c);
        }
    }
    out
}

/// 剥离本地模型对话回复中的思考过程，只保留正文（正文可以是多行）。
///
/// 仅本地部署的模型会输出思考（实测 gemma4 / gpt-oss / qwen3.5）：
///   - gemma4:  `<|channel>` 思考 `<channel|>` 正文
///   - gpt-oss: `<|channel|>analysis<|message|>` 思考 `<|end|><|start|>assistant<|channel|>final<|message|>` 正文
///   - qwen3.5: `Thinking Process:` 纯文本思考，正文在其后（完成时以 ` response` 或最后一段空行分隔）
/// 无思考过程的普通回复（如云端 API）原样返回，不做任何修改。
pub fn strip_thinking_from_response(response: &str) -> String {
    let trimmed = response.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // 1) token 型思考（gemma4 / gpt-oss）：正文起始标记之前都是思考，丢弃
    if trimmed.contains("<|channel") || trimmed.contains("<channel|>") {
        let body = cut_before_answer_opener(trimmed);
        return clean_special_tokens(body).trim().to_string();
    }

    // 2) 纯文本思考（qwen3.5）：去掉 "Thinking Process:" 思考块
    if trimmed.to_lowercase().starts_with("thinking process:") {
        return strip_plain_thinking_block(trimmed).trim().to_string();
    }

    // 3) 无思考：原样返回
    trimmed.to_string()
}

/// 找到最后一个正文起始标记（gpt-oss 的完整 final 标记 / gemma4 的 `<channel|>` /
/// gpt-oss 的 `<|end|>`），丢弃其之前的内容；找不到则原样返回。
fn cut_before_answer_opener(text: &str) -> &str {
    const OPENERS: &[&str] = &[
        "<|start|>assistant<|channel|>final<|message|>", // gpt-oss 正文起始（复合标记，须整体截断）
        "<channel|>",                                     // gemma4 正文起始
        "<|end|>",                                        // gpt-oss 分析段结束
    ];
    let mut start = 0usize;
    for opener in OPENERS {
        if let Some(pos) = text.rfind(opener) {
            start = start.max(pos + opener.len());
        }
    }
    if start > 0 {
        &text[start.min(text.len())..]
    } else {
        text
    }
}

/// qwen 等纯文本思考：去掉 "Thinking Process:" 思考块，取正文。
/// 优先按 ` response` 分隔符切（qwen 模板的正文起始标记）；
/// 没有分隔符时取最后一个空行分隔的段落（qwen 完成时正文在最后一段）。
fn strip_plain_thinking_block(text: &str) -> String {
    if let Some(pos) = text.rfind("\n response") {
        return text[pos + "\n response".len()..].to_string();
    }
    if let Some(pos) = text.rfind("response\n\n") {
        return text[pos + "response\n\n".len()..].to_string();
    }
    // 无分隔符：取最后一个空行分隔段（思考若被截断，退化为最后一段残留，可接受）
    text.rsplit("\n\n").next().unwrap_or("").trim_start().to_string()
}

/// 直接删除响应里残留的 `<...>` 特殊 token（不插入换行）。
fn clean_special_tokens(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_token = false;
    for c in text.chars() {
        if c == '<' {
            in_token = true;
        } else if c == '>' {
            in_token = false;
        } else if !in_token {
            out.push(c);
        }
    }
    out
}

/// Provider information extracted from settings
struct ProviderInfo {

    provider_id: String,
    provider_type: String,
    endpoint: String,
    api_key: String,
    model_name: String,
    local_type: Option<String>,
    model_path: Option<String>,
}

/// Find the provider configuration for a given model ID
fn find_provider_for_model(model_id: &str, settings: &Value) -> Result<ProviderInfo, String> {
    eprintln!("[DEBUG] Finding provider for model_id: {}", model_id);
    eprintln!("[DEBUG] Settings cloudProviders: {}", settings["cloudProviders"]);
    eprintln!("[DEBUG] Settings localProviders: {}", settings["localProviders"]);

    // Search in cloud providers
    if let Some(cloud_providers) = settings["cloudProviders"].as_array() {
        for provider in cloud_providers {
            eprintln!("[DEBUG] Checking cloud provider: id={}, endpoint={}, apiKey={}",
                provider["id"], provider["endpoint"],
                if provider["apiKey"].as_str().map(|s| s.len()).unwrap_or(0) > 0 { "(set)" } else { "(empty)" });
            if let Some(models) = provider["models"].as_array() {
                for model in models {
                    eprintln!("[DEBUG]   model: id={}, modelName={}", model["id"], model["modelName"]);
                    if model["id"].as_str() == Some(model_id) {
                        return Ok(ProviderInfo {
                            provider_id: provider["id"].as_str()
                                .unwrap_or("unknown").to_string(),
                            provider_type: "cloud".to_string(),
                            endpoint: provider["endpoint"].as_str()
                                .unwrap_or("https://api.openai.com").to_string(),
                            api_key: provider["apiKey"].as_str()
                                .unwrap_or("").to_string(),
                            model_name: model["modelName"].as_str()
                                .unwrap_or(model_id).to_string(),
                            local_type: None,
                            model_path: None,
                        });
                    }
                }
            }
        }
    }

    // Search in local providers
    if let Some(local_providers) = settings["localProviders"].as_array() {
        for provider in local_providers {
            let local_type = provider["type"].as_str().unwrap_or("server").to_string();
            eprintln!("[DEBUG] Checking local provider: type={}, provider={}", local_type, provider);
            if let Some(models) = provider["models"].as_array() {
                for model in models {
                    eprintln!("[DEBUG] Checking model: id={}, modelName={}, modelPath={}", model["id"], model["modelName"], model["modelPath"]);
                    if model["id"].as_str() == Some(model_id) {
                        // For MLX, modelName contains the model path
                        // For other local servers, modelName is the actual model name
                        let model_path = if local_type == "mlx" {
                            model["modelName"].as_str().map(|s| s.to_string())
                        } else {
                            model["modelPath"].as_str().map(|s| s.to_string())
                        };
                        let model_name = if local_type == "mlx" {
                            model["displayName"].as_str()
                                .unwrap_or(model_id).to_string()
                        } else {
                            model["modelName"].as_str()
                                .unwrap_or(model_id).to_string()
                        };
                        eprintln!("[DEBUG] Found model! model_path: {:?}", model_path);
                        return Ok(ProviderInfo {
                            provider_id: provider["id"].as_str()
                                .unwrap_or("unknown").to_string(),
                            provider_type: "local".to_string(),
                            endpoint: provider["endpoint"].as_str()
                                .unwrap_or("http://localhost:11434").to_string(),
                            api_key: "".to_string(),
                            model_name,
                            local_type: Some(local_type.clone()),
                            model_path,
                        });
                    }
                }
            }
        }
    }

    Err(format!("找不到模型 {} 的 provider 配置", model_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// gemma4 实测输出：`<|channel>` 思考 `<channel|>` 标题
    #[test]
    fn extract_title_gemma4() {
        let response = "<|channel>thought\n*   User message: ...\n*   Task: Generate a title.\n*   Selected: Transformer 架构核心思想总结\n<channel|>Transformer 架构核心思想总结";
        assert_eq!(extract_title_from_response(response), "Transformer 架构核心思想总结");
    }

    /// gpt-oss 实测输出：`<|channel|>analysis<|message|>` 思考 `<|end|>` `<|start|>assistant<|channel|>final<|message|>` 标题（无换行）
    #[test]
    fn extract_title_gpt_oss() {
        let response = "<|channel|>analysis<|message|>We need to produce a very short title. Something like \"Transformer核心思想概述\". That's 5 words. Good.<|end|><|start|>assistant<|channel|>final<|message|>Transformer核心思想概述";
        assert_eq!(extract_title_from_response(response), "Transformer核心思想概述");
    }

    /// qwen3.5 实测输出：`Thinking Process:` 纯文本思考 + 标题
    #[test]
    fn extract_title_qwen() {
        let response = "Thinking Process:\n\n1.  **Analyze the Request:**\n    *   Input: user message.\n\n6.  **Final Output Generation:**\n    Transformer 架构核心思想总结\n\nTransformer 架构核心思想总结";
        assert_eq!(extract_title_from_response(response), "Transformer 架构核心思想总结");
    }

    /// 无思考过程的普通响应：直接取最后一行
    #[test]
    fn extract_title_plain() {
        assert_eq!(extract_title_from_response("Transformer 架构核心思想总结"), "Transformer 架构核心思想总结");
        assert_eq!(extract_title_from_response(""), "");
    }

    // ===== 对话消息剥离思考过程 =====

    /// gemma4 实测消息结构：`<|channel>` 思考 `<channel|>` 正文（正文可多行前的单行答案）
    #[test]
    fn strip_message_gemma4() {
        let raw = "<|channel>thought\n\nThe user said \"hi\".\n\nRespond with a greeting.\n\n*   \"Hello! How can I help you today?\"\n\n\"Hello! How can I help you today?\" (best).<channel|>Hello! How can I help you today?";
        assert_eq!(strip_thinking_from_response(raw), "Hello! How can I help you today?");
    }

    /// gpt-oss 实测消息结构：`<|channel|>analysis<|message|>` 思考 `<|end|><|start|>assistant<|channel|>final<|message|>` 正文
    #[test]
    fn strip_message_gpt_oss() {
        let raw = "<|channel|>analysis<|message|>User says \"hi\". We should respond with a friendly greeting.<|end|><|start|>assistant<|channel|>final<|message|>Hi there! How can I help you?";
        assert_eq!(strip_thinking_from_response(raw), "Hi there! How can I help you?");
    }

    /// qwen3.5 完成时：`Thinking Process:` 思考 + 最后一段正文
    #[test]
    fn strip_message_qwen_complete() {
        let raw = "Thinking Process:\n\n1.  **Analyze the Request:**\n    *   Input: user message.\n\n6.  **Final Output Generation:**\n    Transformer 架构核心思想总结\n\nTransformer 架构核心思想总结";
        assert_eq!(strip_thinking_from_response(raw), "Transformer 架构核心思想总结");
    }

    /// qwen3.5 带 ` response` 分隔符
    #[test]
    fn strip_message_qwen_response_marker() {
        let raw = "Thinking Process:\nLet me think about this.\n response\n\n你好！很高兴见到你。";
        assert_eq!(strip_thinking_from_response(raw), "你好！很高兴见到你。");
    }

    /// 无思考的普通回复（如云端 API）：原样返回
    #[test]
    fn strip_message_plain_noop() {
        let raw = "这是一段普通的多行回复。\n第二行。";
        assert_eq!(strip_thinking_from_response(raw), raw);
    }
}