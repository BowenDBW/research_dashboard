// MLX LLM implementation
// Handles local MLX model inference via sidecar binary

use crate::llm::types::*;
use std::path::PathBuf;
use serde_json;
use tauri_plugin_shell::ShellExt;

/// Get the MLX service binary name
/// Must match the externalBin configuration in tauri.conf.json and capabilities
fn get_mlx_binary_name() -> &'static str {
    "mlx-chat-service"
}

/// Get target triple for sidecar binary
fn get_target_triple() -> &'static str {
    #[cfg(target_arch = "aarch64")]
    #[cfg(target_os = "macos")]
    return "aarch64-apple-darwin";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "macos")]
    return "x86_64-apple-darwin";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "linux")]
    return "x86_64-unknown-linux-gnu";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "windows")]
    return "x86_64-pc-windows-msvc";
}

/// Send a chat message to MLX model using the sidecar binary
pub async fn chat_with_mlx(
    app_handle: &tauri::AppHandle,
    messages: Vec<ChatMessage>,
    model_path: String,
    max_tokens: Option<i32>,
) -> Result<String, String> {
    // Convert messages to JSON
    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    // Get the sidecar binary name
    let binary_name = get_mlx_binary_name();
    let target = get_target_triple();
    let full_binary_name = format!("{}-{}", binary_name, target);

    // Debug: print actual search path
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or(&exe_path);
        let search_path = exe_dir.join(&full_binary_name);
        eprintln!("[DEBUG] exe_path: {}", exe_path.display());
        eprintln!("[DEBUG] sidecar_name: {}", full_binary_name);
        eprintln!("[DEBUG] search_path: {}", search_path.display());
        eprintln!("[DEBUG] search_path exists: {}", search_path.exists());
    }

    // Build command using Tauri's sidecar API
    let command = app_handle
        .shell()
        .sidecar(binary_name)
        .map_err(|e| format!("Failed to create sidecar command (binary: {}): {}", binary_name, e))?
        .args([
            "--model", &model_path,
            "--messages", &messages_json,
            "--max-tokens", &max_tokens.unwrap_or(2048).to_string(),
        ]);

    // Execute and capture output
    let output = command
        .output()
        .await
        .map_err(|e| format!("Failed to execute MLX service (binary: {}): {}", binary_name, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("MLX service failed: {}", stderr));
    }

    let response = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response.trim().to_string())
}

/// Test MLX service availability
pub async fn test_mlx_connection(
    app_handle: &tauri::AppHandle,
    model_path: &str,
) -> Result<ConnectionTestResult, String> {
    // Check if model path exists
    let model_path_buf = PathBuf::from(model_path);
    if !model_path_buf.exists() {
        return Ok(ConnectionTestResult {
            success: false,
            message: format!("Model path does not exist: {}", model_path),
        });
    }

    // Try a simple test message
    let test_messages = vec![ChatMessage {
        role: MessageRole::User,
        content: "Hello".to_string(),
    }];

    match chat_with_mlx(app_handle, test_messages, model_path.to_string(), Some(50)).await {
        Ok(_) => Ok(ConnectionTestResult {
            success: true,
            message: "MLX connection successful".to_string(),
        }),
        Err(e) => Ok(ConnectionTestResult {
            success: false,
            message: e,
        }),
    }
}

/// Get the actual binary filename with target triple (for file existence checks)
fn get_mlx_binary_filename() -> String {
    // Determine the target triple based on the current architecture
    #[cfg(target_arch = "aarch64")]
    #[cfg(target_os = "macos")]
    let target = "aarch64-apple-darwin";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "macos")]
    let target = "x86_64-apple-darwin";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "linux")]
    let target = "x86_64-unknown-linux-gnu";

    #[cfg(target_arch = "x86_64")]
    #[cfg(target_os = "windows")]
    let target = "x86_64-pc-windows-msvc";

    format!("mlx-chat-service-{}", target)
}

/// Check if MLX service binary exists (can be called without AppHandle)
pub fn is_mlx_available() -> bool {
    // Get the actual filename with target triple
    let binary_filename = get_mlx_binary_filename();

    // Check project binaries directory (for development)
    let dev_path = PathBuf::from("src-tauri/binaries").join(&binary_filename);
    if dev_path.exists() {
        return true;
    }

    // Check relative to current exe (for production)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check in the app's resource directory
            let prod_path = exe_dir.join("binaries").join(&binary_filename);
            if prod_path.exists() {
                return true;
            }

            // Also check in common macOS app bundle structure
            let macos_path = exe_dir.join("../Resources/binaries").join(&binary_filename);
            if macos_path.exists() {
                return true;
            }
        }
    }

    false
}