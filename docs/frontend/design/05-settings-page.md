# 05 — 设置界面（SettingsPage）

## 页面概述

设置界面提供应用全局配置，包括爬虫来源、爬取频率、数据库路径、开机自启动、大模型选择（云端/本地）。页面采用分组列表式布局，每组设置通过 `Paper` 组织，居中显示。

## 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ SettingsPage                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AppBar: [← 返回主页]  设置                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Container (maxWidth=md)                                 │ │
│ │                                                         │ │
│ │ ┌─ Paper: 爬虫设置 ─────────────────────────────────┐ │ │
│ │ │ 爬取来源    [Arxiv] [Semantic Scholar] ...  Checkbox│ │ │
│ │ │ 爬取频率    [4] 小时    Slider / NumberField      │ │ │
│ │ │ 数据库路径  [/path/to/db]  [浏览] Button          │ │ │
│ │ └───────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ ┌─ Paper: 应用设置 ─────────────────────────────────┐ │ │
│ │ │ 开机自启动    Switch                              │ │ │
│ │ └───────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ ┌─ Paper: 大模型设置 ───────────────────────────────┐ │ │
│ │ │ 模型类型  ( ) 云端  ( ) 本地     RadioGroup      │ │ │
│ │ │                                                     │ │ │
│ │ │ ┌─ 云端设置 (Collapse) ──────────────────────────┐│ │ │
│ │ │ │ API Endpoint   TextField                       ││ │ │
│ │ │ │ API Key        TextField (type=password)       ││ │ │
│ │ │ │ [测试连接] Button                               ││ │ │
│ │ │ └────────────────────────────────────────────────┘│ │ │
│ │ │                                                     │ │ │
│ │ │ ┌─ 本地设置 (Collapse) ──────────────────────────┐│ │ │
│ │ │ │ 子选项  ( ) HuggingFace  ( ) 指定路径  Radio   ││ │ │
│ │ │ │ HF 模型名   TextField (Autocomplete)           ││ │ │
│ │ │ │ 本地路径   TextField + [浏览] Button           ││ │ │
│ │ │ └────────────────────────────────────────────────┘│ │ │
│ │ └───────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ [保存设置] Button                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 使用的 MUI 组件

| 组件 | 用途 |
|------|------|
| `AppBar` + `Toolbar` | 顶部导航 |
| `Button` / `IconButton` | 返回、浏览、测试连接、保存 |
| `Container` | 内容区居中容器（`maxWidth="md"`） |
| `Paper` | 各设置分组卡片 |
| `Typography` | 分组标题、字段标签 |
| `FormControlLabel` / `Checkbox` | 爬取来源多选 |
| `Slider` | 爬取频率滑块（1-24 小时） |
| `NumberField` | 爬取频率精确输入 |
| `TextField` | 数据库路径、API Endpoint、API Key、HF 模型名、本地路径 |
| `Switch` | 开机自启动开关 |
| `RadioGroup` / `Radio` / `FormControlLabel` | 模型类型（云端/本地）、本地子选项 |
| `Collapse` | 云端/本地设置区域条件展开 |
| `Alert` / `AlertTitle` | 连接测试结果提示 |
| `Snackbar` | 保存成功提示 |
| `Divider` | 设置分组间分隔 |

## 交互逻辑

### 爬虫设置

- 爬取来源：`Checkbox` 组，选项从后端获取支持的来源列表（Arxiv、Semantic Scholar 等），至少需勾选一个。
- 爬取频率：`Slider`（步进 1，范围 1-24）+ `NumberField` 联动，显示 "每 N 小时爬取一次"。
- 数据库路径：`TextField`（只读）+ `Button`（浏览），浏览按钮调用 Tauri 文件对话框 `invoke('open_path_dialog')`，选择后回填路径。

### 应用设置

- 开机自启动：`Switch`，切换时调用 Tauri 原生 API `invoke('set_auto_launch', { enabled })`。

### 大模型设置

- `RadioGroup` 选择云端/本地，选中后 `Collapse` 展开对应配置区域。
- 云端设置：
  - API Endpoint：`TextField`，支持自定义端点（如 OpenAI 兼容格式）。
  - API Key：`TextField`（`type="password"`），含 `IconButton` 切换密码可见性。
  - 测试连接：`Button`，点击后调用 `invoke('test_llm_connection', { config })`，结果通过 `Alert` 显示（成功/失败+原因）。
- 本地设置：
  - 子选项 `RadioGroup`：HuggingFace / 指定路径。
  - HF 模型名：`Autocomplete`，输入时从 HuggingFace API 搜索模型名候选。
  - 本地路径：`TextField` + 浏览按钮，选择本地 GGUF 模型文件。

### 保存设置

- 点击保存按钮，调用 `invoke('save_settings', { settings })`，成功后 `Snackbar` 提示。

## 状态管理

```typescript
// stores/useSettingsStore.ts
interface SettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
}

interface AppSettings {
  crawlerSources: string[];
  crawlIntervalHours: number;
  databasePath: string;
  autoLaunch: boolean;
  llmType: 'cloud' | 'local';
  cloudLlm: { endpoint: string; apiKey: string };
  localLlm: { type: 'huggingface' | 'path'; modelName: string; modelPath: string };
}
```

## 组件树

```
SettingsPage
├── AppBar + Toolbar
│   ├── IconButton (返回 ArrowBack)
│   └── Typography (标题)
└── Container (maxWidth=md)
    ├── Paper (爬虫设置)
    │   ├── Typography (分组标题)
    │   ├── FormControlLabel + Checkbox × N (来源)
    │   ├── Box
    │   │   ├── Slider (频率)
    │   │   └── NumberField (频率精确值)
    │   └── Box
    │       ├── TextField (数据库路径，只读)
    │       └── Button (浏览)
    ├── Paper (应用设置)
    │   ├── Typography (分组标题)
    │   └── FormControlLabel + Switch (自启动)
    ├── Paper (大模型设置)
    │   ├── Typography (分组标题)
    │   ├── RadioGroup (云端/本地)
    │   ├── Collapse (云端)
    │   │   ├── TextField (Endpoint)
    │   │   ├── TextField (API Key, password)
    │   │   ├── Alert (测试结果)
    │   │   └── Button (测试连接)
    │   └── Collapse (本地)
    │       ├── RadioGroup (HF/路径)
    │       ├── Autocomplete (HF 模型名)
    │       ├── TextField + Button (本地路径)
    │       └── Alert (测试结果)
    └── Button (保存设置)
```
