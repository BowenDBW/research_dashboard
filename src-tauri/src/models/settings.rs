// Settings models

use serde::{Deserialize, Serialize};

/// Cloud provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudProvider {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub api_key: String,
    pub models: Vec<ModelInfo>,
}

/// Local provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalProvider {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub endpoint: String,
    pub models: Vec<ModelInfo>,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub model_name: String,
    pub display_name: String,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub crawler_categories: Vec<String>,
    pub crawl_interval_hours: i32,
    pub last_crawl_time: Option<String>,
    pub pdf_storage_path: String,
    pub auto_launch: bool,
    pub cloud_providers: Vec<CloudProvider>,
    pub local_providers: Vec<LocalProvider>,
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
            cloud_providers: vec![],
            local_providers: vec![],
            selected_model_id: None,
        }
    }
}