// Settings models
//
// 注意：运行时 settings 读写走的是 serde_json::Value（settings.rs），
// 这里仅作结构说明，保持与磁盘 settings.json 的新结构一致：
//   mlxModels（扁平 MLX 模型列表）+ portProviders（OpenAI 兼容端口服务，Ollama / 云端 API 通用）

use serde::{Deserialize, Serialize};

/// 模型配置（port 服务与 MLX 通用）
/// - port 服务：`model_name` 是发给 OpenAI 兼容 API 的模型名
/// - MLX：`model_name` 存模型路径，`display_name` 是展示名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub model_name: String,
    pub display_name: String,
}

/// OpenAI 兼容端口服务（Ollama / 云端 API 通用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProvider {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub api_key: String,
    pub models: Vec<ModelInfo>,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub crawler_categories: Vec<String>,
    pub crawl_interval_hours: i32,
    pub last_crawl_time: Option<String>,
    pub pdf_storage_path: String,
    pub auto_launch: bool,
    pub mlx_models: Vec<ModelInfo>,
    pub port_providers: Vec<PortProvider>,
    pub selected_model_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            crawler_categories: vec![],
            crawl_interval_hours: 4,
            last_crawl_time: None,
            pdf_storage_path: String::new(),
            auto_launch: false,
            mlx_models: vec![],
            port_providers: vec![],
            selected_model_id: None,
        }
    }
}
