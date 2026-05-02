// Layout configuration module
// Handles layout.json read/write operations

use crate::database::models::LayoutConfig;
use std::fs;
use std::path::PathBuf;

/// Get the layout file path: ~/.research_dashboard/layout.json
fn get_layout_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let data_dir = home_dir.join(".research_dashboard");

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
    }

    Ok(data_dir.join("layout.json"))
}

/// Get layout configuration
pub fn get_layout() -> Result<LayoutConfig, String> {
    let layout_path = get_layout_path()?;

    if layout_path.exists() {
        let content = fs::read_to_string(&layout_path)
            .map_err(|e| format!("读取布局文件失败: {}", e))?;
        let layout: LayoutConfig = serde_json::from_str(&content)
            .map_err(|e| format!("解析布局JSON失败: {}", e))?;
        Ok(layout)
    } else {
        // Return default layout
        Ok(LayoutConfig::default())
    }
}

/// Save layout configuration
pub fn save_layout(layout: &LayoutConfig) -> Result<(), String> {
    let layout_path = get_layout_path()?;
    let content = serde_json::to_string_pretty(layout)
        .map_err(|e| format!("序列化布局失败: {}", e))?;
    fs::write(&layout_path, content)
        .map_err(|e| format!("写入布局文件失败: {}", e))?;
    Ok(())
}