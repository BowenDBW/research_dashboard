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

    match provider_info.provider_type.as_str() {
        "cloud" => {
            let provider = CloudLlmProvider::new(ProviderConfig {
                id: provider_info.provider_id,
                endpoint: provider_info.endpoint,
                api_key: provider_info.api_key,
                model: provider_info.model_name,
            });
            provider.chat(messages).await
        }
        "local" => {
            // Check if it's MLX type
            if provider_info.local_type.as_deref() == Some("mlx") {
                #[cfg(target_os = "macos")]
                {
                    chat_with_mlx(app_handle, messages, provider_info.model_path.clone().unwrap_or_default(), None).await
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = app_handle;
                    let _ = messages;
                    let _ = provider_info.model_path;
                    Err("MLX 模型仅在 macOS 上可用".to_string())
                }
            } else {
                // Local server (like Ollama) uses OpenAI format
                let provider = CloudLlmProvider::new(ProviderConfig {
                    id: provider_info.provider_id,
                    endpoint: provider_info.endpoint,
                    api_key: "".to_string(), // No API key for local
                    model: provider_info.model_name,
                });
                provider.chat(messages).await
            }
        }
        _ => Err(format!("未知的 provider 类型: {}", provider_info.provider_type)),
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

    // Clean up the title - remove quotes, trim whitespace, limit length
    let cleaned_title: String = title
        .trim()
        .replace("\"", "")
        .replace("'", "")
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();

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