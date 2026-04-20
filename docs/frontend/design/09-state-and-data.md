# 状态管理与数据流设计

## 1. 状态管理方案

采用 Zustand 进行全局状态管理，具有以下优势：
- 轻量级，无 Provider 包裹
- TypeScript 支持良好
- API 简洁，学习成本低

## 2. Store 结构

### 2.1 Store 列表

| Store | 文件 | 职责 |
|-------|------|------|
| useChatStore | `stores/useChatStore.ts` | 对话会话与消息 |
| useArticleStore | `stores/useArticleStore.ts` | 文章数据与搜索 |
| useFavoriteStore | `stores/useFavoriteStore.ts` | 收藏夹树形结构 |
| useHistoryStore | `stores/useHistoryStore.ts` | 阅读与对话历史 |
| useDailyStore | `stores/useDailyStore.ts` | Claw 日报数据 |
| useSettingsStore | `stores/useSettingsStore.ts` | 应用设置 |
| useSubscriptionStore | `stores/useSubscriptionStore.ts` | 订阅关键词与作者 |

### 2.2 Store 依赖关系

```
useSettingsStore (全局设置)
       ↓
useChatStore (依赖 selectedModelId)
       ↓
useHistoryStore (记录对话历史)
```

## 3. 类型定义

### 3.1 文件结构

```
src/types/
├── index.ts         # 统一导出
├── article.ts       # 文章类型
├── chat.ts          # 对话类型
├── favorite.ts      # 收藏夹类型
├── history.ts       # 历史记录类型
├── daily.ts         # 日报类型
├── settings.ts      # 设置类型
└── subscription.ts  # 订阅类型
```

### 3.2 核心类型

#### Article

```typescript
interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;           // 数据源名称
  sourceType: string;       // arxiv, semantic_scholar, etc.
  publishDate: string;
  abstract: string;
  url: string;
  pdfUrl: string;
  domains: string[];        // 研究领域
  isFavorited: boolean;
  metadata: Record<string, any>;
}
```

#### Chat

```typescript
type ChatMode = 'chat' | 'paper_search' | 'chapter_summary';

interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

#### Favorite

```typescript
interface FavoriteItem {
  id: string;
  name: string;
  type: 'folder' | 'article';
  article?: Article;
  children?: FavoriteItem[];
}
```

#### Daily

```typescript
interface DailyReportListItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  articleCount: number;
}

interface DailyReport extends DailyReportListItem {
  content: string;        // Markdown 内容
  createdAt: string;
  updatedAt: string;
}
```

#### Settings

```typescript
interface ModelConfig {
  id: string;
  modelName: string;
  displayName: string;
}

interface CloudProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  models: ModelConfig[];
}

type LocalProviderType = 'server' | 'mlx';

interface LocalProviderConfig {
  id: string;
  name: string;
  type: LocalProviderType;
  endpoint: string;
  models: ModelConfig[];
}

interface AppSettings {
  crawlerSources: string[];
  crawlIntervalHours: number;
  databasePath: string;
  autoLaunch: boolean;
  cloudProviders: CloudProviderConfig[];
  localProviders: LocalProviderConfig[];
  selectedModelId: string | null;
}
```

## 4. Store 详细设计

### 4.1 useChatStore

```typescript
interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;

  // Actions
  createSession: (mode: ChatMode) => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'sessionId' | 'timestamp'>) => void;
  getCurrentMessages: () => ChatMessage[];
}
```

**使用示例**：

```typescript
const { sessions, currentSessionId, createSession, addMessage } = useChatStore();

// 创建新会话
const sessionId = createSession('chat');

// 添加消息
addMessage(sessionId, {
  role: 'user',
  content: 'Hello!',
});
```

### 4.2 useArticleStore

```typescript
interface ArticleStore {
  articles: Article[];
  totalArticles: number;
  loading: boolean;
  searchQuery: string;

  // Actions
  fetchArticles: (params: SearchParams) => Promise<void>;
  getArticleById: (id: string) => Article | undefined;
  toggleFavorite: (id: string) => void;
}
```

### 4.3 useFavoriteStore

```typescript
interface FavoriteStore {
  items: FavoriteItem[];
  expandedFolders: Set<string>;

  // Actions
  toggleFolder: (folderId: string) => void;
  addToFavorite: (article: Article, folderId?: string) => void;
  removeFromFavorite: (articleId: string) => void;
  createFolder: (name: string, parentId?: string) => void;
  deleteFolder: (folderId: string) => void;
}
```

### 4.4 useHistoryStore

```typescript
interface HistoryStore {
  records: HistoryRecord[];

  // Actions
  addRecord: (article: Article) => void;
  clearHistory: () => void;
  getRecentRecords: (count?: number) => HistoryRecord[];
}
```

### 4.5 useDailyStore

```typescript
interface DailyStore {
  reports: DailyReportListItem[];
  currentReport: DailyReport | null;
  loading: boolean;
  totalReports: number;

  // Actions
  fetchReports: (page: number, pageSize: number, searchMonth?: string) => Promise<void>;
  fetchReportById: (id: string) => Promise<DailyReport | null>;
  getRecentReports: () => DailyReportListItem[];
}
```

### 4.6 useSettingsStore

```typescript
interface SettingsStore {
  settings: AppSettings;

  // Actions
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}
```

### 4.7 useSubscriptionStore

```typescript
interface SubscriptionStore {
  keywords: string[];
  authors: string[];

  // Actions
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;
  addAuthor: (author: string) => void;
  removeAuthor: (author: string) => void;
}
```

## 5. 数据流

### 5.1 用户操作流程

```
用户点击 → 组件调用 Store Action → Store 更新状态 → 组件重新渲染
```

### 5.2 示例：发送消息

```
1. 用户在输入框输入内容
2. 点击发送按钮
3. 组件调用 addMessage(sessionId, message)
4. useChatStore 更新 messages
5. 消息列表组件重新渲染
6. AI 回复（模拟或实际 API 调用）
7. 再次调用 addMessage 添加 AI 回复
```

### 5.3 示例：收藏文章

```
1. 用户点击收藏按钮
2. 组件调用 useArticleStore.toggleFavorite(id)
3. 文章的 isFavorited 更新
4. 同时调用 useFavoriteStore.addToFavorite(article)
5. 收藏夹列表更新
```

## 6. Mock 数据策略

原型阶段使用 Mock 数据：

### 6.1 Mock 位置

Mock 数据直接定义在各 Store 文件中：

```typescript
// useArticleStore.ts
const mockArticles: Article[] = [
  { id: '1', title: 'Attention Is All You Need', ... },
  { id: '2', title: 'BERT: Pre-training...', ... },
];

// useDailyStore.ts
const mockReports: DailyReportListItem[] = [
  { id: 'daily-2024-01-15', date: '2024-01-15', ... },
];
```

### 6.2 模拟异步

使用 setTimeout 模拟网络延迟：

```typescript
fetchReports: async (page, pageSize, searchMonth) => {
  set({ loading: true });
  await new Promise(resolve => setTimeout(resolve, 300));
  // 处理 mock 数据...
  set({ loading: false, reports: paginated });
}
```

## 7. 数据持久化（未来实现）

### 7.1 Tauri 文件存储

```typescript
// 使用 Tauri 的 fs API
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';

const saveSettings = async (settings: AppSettings) => {
  await writeTextFile('settings.json', JSON.stringify(settings));
};

const loadSettings = async (): Promise<AppSettings> => {
  const content = await readTextFile('settings.json');
  return JSON.parse(content);
};
```

### 7.2 Zustand 持久化中间件

```typescript
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist<SettingsStore>(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
    }),
    { name: 'settings-storage' }
  )
);
```