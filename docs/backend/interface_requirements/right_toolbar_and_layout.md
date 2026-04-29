# 右边栏、订阅、爬取与布局持久化接口需求

## 概述

本文档补充分析右边栏（RightToolbar）相关的接口需求，包括：
1. **订阅管理** - 存储到数据库
2. **Arxiv 爬取** - 配置存 JSON，执行结果存数据库
3. **布局持久化** - 存储到 JSON
4. **设置界面** - 部分已实现，存 JSON

---

## 一、数据存储策略

| 功能模块 | 存储位置 | 原因 |
|---------|---------|------|
| 订阅（作者/领域/关键词） | SQLite 数据库 | 需要与论文数据关联查询，支持复杂筛选 |
| 爬取配置（领域、频率） | `settings.json` | 应用配置，无需复杂查询 |
| 爬取执行状态（最后时间） | `settings.json` | 运行时状态，简单读写 |
| 爬取结果（论文数据） | SQLite 数据库 | 核心业务数据，需要全文检索 |
| 右边栏布局（面板顺序、显隐） | `layout.json` | 用户个性化配置，独立于应用设置 |
| LLM 配置（云端/本地模型） | `settings.json` | 敏感配置，需要加密存储 |
| 主题设置 | localStorage | 纯前端状态，无需持久化到文件 |

---

## 二、右边栏布局持久化

### 存储内容

```typescript
interface LayoutConfig {
  panelOrder: string[];      // 面板顺序 ['arxiv', 'daily', 'favorites', ...]
  hiddenPanels: string[];    // 隐藏的面板 ['stats']
  expandedPanels: string[];  // 展开的面板 ['arxiv', 'daily']
}
```

### 接口需求

#### 1. 获取布局配置

**接口**: Tauri Command `get_layout`

**描述**: 从 `layout.json` 读取右边栏布局配置

**响应**:
```json
{
  "panelOrder": ["arxiv", "daily", "favorites", "history", "stats", "subscription"],
  "hiddenPanels": [],
  "expandedPanels": ["arxiv"]
}
```

---

#### 2. 保存布局配置

**接口**: Tauri Command `save_layout`

**描述**: 将布局配置写入 `layout.json`

**请求体**:
```json
{
  "panelOrder": ["string[]"],
  "hiddenPanels": ["string[]"],
  "expandedPanels": ["string[]"]
}
```

**响应**: `void`

---

## 三、订阅管理

> 注：订阅接口已在 `subscriptions.md` 中定义，此处仅补充与右边栏的关联说明

### 右边栏订阅面板功能

1. **显示已订阅内容**：调用 `GET /api/subscriptions` 获取数据
2. **编辑订阅**：打开 `SubscriptionDialog`，调用 CRUD 接口
3. **筛选订阅论文**：在 ArticleListPage 中调用 `GET /api/papers/subscribed`

### 数据库表（已存在）

- `subscribed_authors` - 订阅作者
- `subscribed_categories` - 订阅领域
- `subscribed_keywords` - 订阅关键词

---

## 四、Arxiv 爬取系统

### 4.1 爬取配置（存 JSON）

已在 `settings.json` 中实现：
- `crawlerCategories`: 爬取领域列表
- `crawlIntervalHours`: 爬取频率（小时）
- `lastCrawlTime`: 最后爬取时间

### 4.2 爬取执行接口

#### 1. 触发爬取

**接口**: Tauri Command `trigger_crawl`

**描述**: 手动触发一次 Arxiv 爬取任务

**请求参数**: 无（使用 settings.json 中的配置）

**响应**:
```json
{
  "success": boolean,
  "message": "string",
  "articlesAdded": number,
  "crawlTime": "string"
}
```

**实现逻辑**:
1. 读取 `settings.crawlerCategories` 获取要爬取的领域
2. 调用 Arxiv API 获取最新论文
3. 写入 `papers`, `paper_authors`, `paper_categories` 表
4. 更新 `settings.lastCrawlTime`
5. 返回新增论文数量

---

#### 2. 获取爬取状态

**接口**: Tauri Command `get_crawl_status`

**描述**: 获取当前爬取状态和统计信息

**响应**:
```json
{
  "lastCrawlTime": "string | null",
  "totalArticles": number,
  "isCrawling": boolean,
  "nextScheduledCrawl": "string | null"
}
```

**数据库操作**:
```sql
SELECT COUNT(*) as total FROM papers;
SELECT MAX(created_at) as last_crawl FROM papers;
```

---

#### 3. 配置自动爬取

**接口**: Tauri Command `schedule_crawl`

**描述**: 配置定时爬取任务

**请求参数**:
- `intervalHours`: `number` - 间隔小时数
- `enabled`: `boolean` - 是否启用

**响应**: `void`

**实现逻辑**:
1. 更新 `settings.crawlIntervalHours`
2. 启动/停止后台定时任务（Tauri sidecar 或系统任务）

---

## 五、设置界面补充

### 已实现的接口（lib.rs）

| 接口 | 状态 | 说明 |
|-----|------|------|
| `get_settings` | ✅ 已实现 | 从 settings.json 读取配置 |
| `save_settings` | ✅ 已实现 | 写入 settings.json |
| `test_connection` | ⚠️ 占位 | 需要实现真实 HTTP 测试 |

### 待实现的接口

#### 1. 选择文件夹路径

**接口**: Tauri Dialog API（已内置）

**调用方式**:
```typescript
import { open } from '@tauri-apps/plugin-dialog';
const path = await open({ directory: true });
```

---

#### 2. 开机自启动设置

**接口**: Tauri Autostart API（需安装插件）

**调用方式**:
```typescript
import { enable, disable, isEnabled } from 'tauri-plugin-autostart';
```

---

#### 3. 测试连接（真实实现）

**接口**: Tauri Command `test_connection`（需重构）

**实现逻辑**:
```rust
#[tauri::command]
async fn test_connection(
    provider_id: String,
    provider_type: String,
    settings: State<'_, AppSettings>
) -> Result<ConnectionTestResult, String> {
    match provider_type.as_str() {
        "cloud" => {
            // 找到 provider 配置
            let provider = settings.cloudProviders.iter()
                .find(|p| p.id == provider_id)
                .ok_or("Provider not found")?;

            // 发送 HTTP 请求测试连接
            let client = reqwest::Client::new();
            let response = client
                .get(&format!("{}/models", provider.endpoint))
                .bearer_auth(&provider.api_key)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => Ok(ConnectionTestResult {
                    success: true,
                    message: "连接成功".to_string(),
                }),
                Ok(resp) => Ok(ConnectionTestResult {
                    success: false,
                    message: format!("HTTP {}", resp.status()),
                }),
                Err(e) => Ok(ConnectionTestResult {
                    success: false,
                    message: e.to_string(),
                }),
            }
        }
        "local" => {
            // 测试本地服务（Ollama 等）
            let provider = settings.localProviders.iter()
                .find(|p| p.id == provider_id)
                .ok_or("Provider not found")?;

            let client = reqwest::Client::new();
            let response = client
                .get(&format!("{}/api/tags", provider.endpoint))
                .send()
                .await;

            // ... 类似处理
        }
        _ => Err("Invalid provider type".to_string()),
    }
}
```

---

## 六、文件结构规划

```
~/.research_dashboard/
├── settings.json          # 应用设置（LLM配置、爬取配置）
├── layout.json            # 右边栏布局配置
├── research_dashboard.db  # SQLite 数据库
└── pdfs/                  # 下载的 PDF 文件
```

---

## 七、补充说明

1. **敏感信息加密**: `settings.json` 中的 `apiKey` 应考虑加密存储
2. **布局同步**: `layout.json` 应在用户编辑布局后自动保存
3. **爬取去重**: 爬取时需检查 `papers` 表避免重复插入
4. **错误处理**: 爬取失败时应记录日志并通知用户
5. **并发控制**: 避免同时运行多个爬取任务

