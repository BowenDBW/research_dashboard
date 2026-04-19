# 08 — 状态管理与数据流

## 8.1 Store 架构

采用 Zustand 管理全局状态，按领域拆分 Store：

```
stores/
├── useArticleStore.ts      # 文章列表、筛选、分页
├── useFavoriteStore.ts     # 收藏夹层级、剪贴板、CRUD
├── useChatStore.ts         # 对话 session、消息、流式响应
├── useSettingsStore.ts     # 应用设置
├── useHistoryStore.ts      # 阅读历史记录
└── useSubscriptionStore.ts # 订阅关键词/作者
```

## 8.2 数据流图

```
┌─────────────┐    invoke()    ┌─────────────┐
│  React UI   │ ─────────────→ │  Rust Core  │
│  (Zustand)  │ ←───────────── │  (Tauri)    │
│             │   listen()     │             │
│  Stores     │   (stream)     │  SQLite DB  │
│             │                │  HTTP Proxy │
└──────┬──────┘                │  LLM Bridge │
       │                       └─────────────┘
       │ UI Render
       ▼
┌─────────────┐
│  MUI v9.0   │
│  Components │
└─────────────┘
```

## 8.3 关键数据流

| 用户操作 | 数据流 |
|----------|--------|
| AI 对话发送 | `ChatStore.addMessage` → `invoke('chat_send')` → 后端流式返回 → `listen('chat:stream')` → `ChatStore.appendStreamToken` |
| 文章筛选 | `ArticleStore.setFilters` → 防抖 300ms → `invoke('query_articles')` → 更新 `articles` |
| 收藏操作 | `ArticleActions.onFavorite` → `invoke('toggle_favorite')` → `FavoriteStore` 刷新 + `ArticleStore` 更新 `isFavorited` |
| 阅读行为记录 | 任何文章操作按钮点击 → `invoke('record_action', { articleId, action })` → 后端写入行为数据库 |
| 订阅管理 | `SubscriptionDialog` 保存 → `SubscriptionStore.update` → `invoke('save_subscriptions')` → 同步为文章列表默认筛选 |

## 8.4 持久化策略

| 数据 | 持久化方式 |
|------|-----------|
| 对话历史 | Tauri SQLite（后端管理） |
| 收藏夹结构 | Tauri SQLite |
| 阅读历史 | Tauri SQLite |
| 应用设置 | Tauri SQLite + 文件系统（数据库路径等） |
| 订阅关键词/作者 | Tauri SQLite |
| UI 偏好（主题、Drawer 状态等） | `localStorage` |
| 文章数据 | Tauri SQLite（后端爬虫写入） |

## 8.5 各 Store 完整定义

### useArticleStore

```typescript
interface ArticleStore {
  articles: Article[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: ArticleFilters;
  loading: boolean;
  setFilters: (filters: Partial<ArticleFilters>) => void;
  fetchArticles: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}
```

### useFavoriteStore

```typescript
interface FavoriteStore {
  currentFolderId: string | null;
  folderPath: FolderNode[];
  items: FavoriteItem[];
  clipboard: { type: 'cut'; folderId: string } | null;
  loading: boolean;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cutFolder: (folderId: string) => void;
  pasteFolder: (targetParentId: string) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
}
```

### useChatStore

```typescript
interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  createSession: () => string;
  switchSession: (id: string) => void;
  addMessage: (sessionId: string, msg: ChatMessage) => void;
  appendStreamToken: (sessionId: string, token: string) => void;
}
```

### useSettingsStore

```typescript
interface SettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
}
```

### useHistoryStore

```typescript
interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  filters: HistoryFilters;
  loading: boolean;
  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
}
```

### useSubscriptionStore

```typescript
interface SubscriptionStore {
  keywords: string[];
  authors: string[];
  loading: boolean;
  loadSubscriptions: () => Promise<void>;
  updateSubscriptions: (data: Partial<Subscriptions>) => Promise<void>;
}
```

---

## 8.6 Tauri 集成

### 前后端通信

| 通信方式 | 用途 | 示例 |
|----------|------|------|
| `invoke()` | 请求-响应式调用 | `invoke('query_articles', {...})` |
| `listen()` | 事件监听（流式数据） | `listen('chat:stream', ...)` |
| `emit()` | 前端向 Rust 发事件 | 前端触发爬虫任务 |

### 核心 Tauri Commands

```rust
// 前端需要调用的后端命令（设计稿）
#[tauri::command]
fn get_crawler_status() -> CrawlerStatus;

#[tauri::command]
fn query_articles(filters: ArticleFilters, page: i32, page_size: i32) -> PaginatedArticles;

#[tauri::command]
fn chat_send(session_id: String, message: String, mode: ChatMode, context: Option<ChatContext>);

#[tauri::command]
fn toggle_favorite(article_id: String, folder_id: Option<String>) -> bool;

#[tauri::command]
fn remove_favorite(article_id: String) -> bool;

#[tauri::command]
fn create_folder(parent_id: Option<String>, name: String) -> Folder;

#[tauri::command]
fn rename_folder(folder_id: String, new_name: String);

#[tauri::command]
fn delete_folder(folder_id: String);

#[tauri::command]
fn move_folder(folder_id: String, target_parent_id: Option<String>);

#[tauri::command]
fn get_favorites(folder_id: Option<String>) -> FavoriteItems;

#[tauri::command]
fn get_history(filters: HistoryFilters, page: i32, page_size: i32) -> PaginatedHistory;

#[tauri::command]
fn record_action(article_id: String, action: String);

#[tauri::command]
fn save_settings(settings: AppSettings);

#[tauri::command]
fn load_settings() -> AppSettings;

#[tauri::command]
fn test_llm_connection(config: LlmConfig) -> ConnectionTestResult;

#[tauri::command]
fn open_url(url: String);

#[tauri::command]
fn open_path_dialog() -> Option<String>;

#[tauri::command]
fn set_auto_launch(enabled: bool);

#[tauri::command]
fn get_crawler_sources() -> Vec<String>;

#[tauri::command]
fn save_subscriptions(subscriptions: Subscriptions);

#[tauri::command]
fn load_subscriptions() -> Subscriptions;
```

### 安全注意事项

- API Key 等敏感信息通过 Tauri 安全存储（`keyring` 或加密文件），不在前端明文保留。
- CSP 策略通过 `tauri.conf.json` 配置，限制外部资源加载。
- 所有后端命令均在 Rust 侧做输入校验。

---

## 8.7 TypeScript 类型定义

```typescript
// types/article.ts
interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;
  sourceType: string;
  publishDate: string;
  abstract: string;
  url: string;
  pdfUrl: string;
  domains: string[];
  isFavorited: boolean;
  metadata: Record<string, unknown>;
}

interface PaginatedArticles {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}

interface ArticleFilters {
  dateRange: [Dayjs | null, Dayjs | null];
  sources: string[];
  author: string;
  domains: string[];
}

// types/favorite.ts
interface FavoriteItem {
  id: string;
  type: 'folder' | 'file';
  name: string;
  article?: Article;
  children?: FavoriteItem[];
  parentId: string | null;
  createdAt: string;
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

// types/chat.ts
interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
}

type ChatMode = 'chat' | 'paper_search' | 'chapter_summary';

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatContext {
  articleId?: string;
  dateRange?: [string, string];
}

// types/settings.ts
interface AppSettings {
  crawlerSources: string[];
  crawlIntervalHours: number;
  databasePath: string;
  autoLaunch: boolean;
  llmType: 'cloud' | 'local';
  cloudLlm: CloudLlmConfig;
  localLlm: LocalLlmConfig;
}

interface CloudLlmConfig {
  endpoint: string;
  apiKey: string;
}

interface LocalLlmConfig {
  type: 'huggingface' | 'path';
  modelName: string;
  modelPath: string;
}

// types/subscription.ts
interface Subscriptions {
  keywords: string[];
  authors: string[];
}

// types/history.ts
interface HistoryRecord {
  id: string;
  articleId: string;
  article: Article;
  action: 'view_abstract' | 'view_source' | 'favorite' | 'download';
  timestamp: string;
}

interface HistoryFilters {
  dateRange: [Dayjs | null, Dayjs | null];
  actions: string[];
}
```
