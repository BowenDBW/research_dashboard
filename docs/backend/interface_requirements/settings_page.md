# SettingsPage 接口需求文档

## 界面概述

SettingsPage 是应用设置界面，包含：
- **外观设置**：主题模式（跟随系统/浅色/深色）
- **爬虫设置**：爬取领域选择、爬取频率、PDF存储路径
- **应用设置**：开机自启动
- **大模型设置**：云端模型和本地模型的配置管理

## 数据存储

设置数据通过 Tauri 持久化存储在本地文件（`settings.json`），不使用 SQLite 数据库。

---

## 接口列表

### 1. 获取应用设置

**接口**: Tauri Command `get_settings`

**状态**: ✅ 已实现（`lib.rs:46-60`）

**描述**: 从本地文件读取应用设置

**响应**:
```json
{
  "crawlerCategories": ["string"],
  "crawlIntervalHours": number,
  "lastCrawlTime": "string | undefined",
  "pdfStoragePath": "string",
  "autoLaunch": boolean,
  "cloudProviders": [
    {
      "id": "string",
      "name": "string",
      "endpoint": "string",
      "apiKey": "string",
      "models": [
        { "id": "string", "modelName": "string", "displayName": "string" }
      ]
    }
  ],
  "localProviders": [
    {
      "id": "string",
      "name": "string",
      "type": "server" | "mlx",
      "endpoint": "string",
      "models": [
        { "id": "string", "modelName": "string", "displayName": "string" }
      ]
    }
  ],
  "selectedModelId": "string | null"
}
```

---

### 2. 保存应用设置

**接口**: Tauri Command `save_settings`

**状态**: ✅ 已实现（`lib.rs:62-70`）

**描述**: 将应用设置写入本地文件

**请求体**: 完整的 `AppSettings` 对象

**响应**: `void`

---

### 3. 测试模型连接

**接口**: Tauri Command `test_connection`

**状态**: ⚠️ 占位实现（`lib.rs:72-84`）- 需实现真实 HTTP 测试逻辑

**描述**: 测试云端或本地模型服务的连接状态

**请求参数**:
- `providerId`: `string` - 服务提供者 ID
- `providerType`: `"cloud" | "local"` - 服务类型

**响应**:
```json
{
  "success": boolean,
  "message": "string"
}
```

**实现逻辑**:
- 云端服务：向 `{endpoint}/models` 发送请求验证 API Key
- 本地服务：向 `{endpoint}/api/tags` (Ollama) 发送请求验证服务可用性
- MLX：检查本地模型文件是否存在

---

### 4. 选择文件夹路径

**接口**: Tauri Dialog API `open`

**状态**: ✅ Tauri 内置 API（需安装 `@tauri-apps/plugin-dialog`）

**描述**: 打开文件夹选择对话框，用于选择 PDF 存储路径

**参数**:
- `directory`: `true` - 选择文件夹
- `defaultPath`: `string` - 默认路径

**响应**: 选择的文件夹路径或 `null`

---

### 5. 获取可用学术领域列表

**接口**: 前端常量 `academicCategories`

**状态**: ✅ 无需后端接口（前端硬编码常量）

**描述**: 返回所有可选的 arXiv 学术领域代码及名称

**数据格式**:
```typescript
interface AcademicCategory {
  code: string;      // e.g., "cs.AI"
  name: string;      // e.g., "Artificial Intelligence"
  parent?: string;   // 父级分类代码
}
```

---

## 补充说明

1. **本地存储**: 设置数据不存入数据库，而是通过 Tauri 的文件 API 持久化
2. **敏感信息**: API Key 等敏感信息应考虑加密存储
3. **主题设置**: 主题模式存储在前端 localStorage，不需要后端接口
4. **模型选择**: `selectedModelId` 用于记住用户上次选择的模型
5. **自动启动**: `autoLaunch` 需要调用系统 API 设置开机自启动

