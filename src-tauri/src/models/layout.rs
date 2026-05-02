// Layout models

use serde::{Deserialize, Serialize};

/// Layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub panel_order: Vec<String>,
    pub hidden_panels: Vec<String>,
    pub expanded_panels: Vec<String>,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            panel_order: vec![
                "arxiv".to_string(),
                "daily".to_string(),
                "favorites".to_string(),
                "history".to_string(),
                "stats".to_string(),
                "subscription".to_string(),
            ],
            hidden_panels: vec![],
            expanded_panels: vec!["arxiv".to_string()],
        }
    }
}