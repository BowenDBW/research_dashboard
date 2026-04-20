# 02 — 主页（HomePage）

## 页面概述

主页是用户进入应用后的首屏，包含三个核心区域：左侧可折叠菜单栏（爬虫状态 + 历史对话 + 设置入口）、中央 AI 对话/搜索区域、右侧常驻工具栏。中央区域通过 `Tabs` 组件实现三种模式切换：AI 对话、文章检索、文章逐章总结。

## 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ HomePage                                                     │
│ ┌────────────┐ ┌─────────────────────────┐ ┌─────────────┐ │
│ │ SideDrawer │ │   Central Content       │ │ RightToolbar│ │
│ │            │ │ ┌─────────────────────┐ │ │             │ │
│ │ ┌────────┐ │ │ │  Tabs:              │ │ │ ┌─────────┐ │ │
│ │ │爬虫记录│ │ │ │  [Chat] [Search]    │ │ │ │收藏夹   │ │ │
│ │ │标题→   │ │ │ │  [Summary]          │ │ │ │文件树   │ │ │
│ │ │------  │ │ │ ├─────────────────────┤ │ │ │       → │ │ │
│ │ │最后爬取│ │ │ │                     │ │ │ ├─────────┤ │ │
│ │ │文章总量│ │ │ │  Tab Content Panel  │ │ │ │本周历史 │ │ │
│ │ ├────────┤ │ │ │                     │ │ │ │       → │ │ │
│ │ │+ 新对话│ │ │ │  (ChatPanel /       │ │ │ ├─────────┤ │ │
│ │ │------  │ │ │ │   PaperSearch /     │ │ │ │订阅设置 │ │ │
│ │ │历史对话│ │ │ │   ChapterSummary)   │ │ │ └─────────┘ │ │
│ │ │条目1   │ │ │ │                     │ │ │             │ │
│ │ │条目2   │ │ │ │                     │ │ │             │ │
│ │ │...     │ │ │ │                     │ │ │             │ │
│ │ ├────────┤ │ │ └─────────────────────┘ │ │             │ │
│ │ │⚙ 设置→│ │ │                         │ │             │ │
│ │ │ v0.1.0 │ │ │                         │ │             │ │
│ │ └────────┘ │ └─────────────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 使用的 MUI 组件

| 组件 | 用途 |
|------|------|
| `Drawer` | 左侧可折叠菜单栏 |
| `List` / `ListItem` / `ListItemButton` / `ListItemText` | 历史对话记录列表 |
| `ListItemAvatar` | 对话条目前显示头像/图标 |
| `Divider` | 分隔爬虫记录区、对话区、设置区 |
| `Button` | 新建对话按钮 |
| `Typography` | 爬虫状态文字、版本号 |
| `IconButton` | 设置按钮、折叠按钮 |
| `ArrowForward` (Icon) | 标题旁的箭头提示可跳转 |
| `Tabs` / `Tab` | 三种模式切换（Chat / Search / Summary） |
| `Box` | 各区域容器 |
| `Container` | 中央内容区容器 |
| `TextField` | 对话输入框 |
| `TextareaAutosize` | 对话输入框（自适应高度） |
| `Button` (Send) | 发送按钮 |
| `Chip` | 对话中的标签显示 |
| `Avatar` | 用户/AI 消息头像 |
| `Stack` | 对话消息垂直排列 |
| `Paper` | 对话消息气泡容器 |
| `Skeleton` | AI 回复加载占位 |
| `DatePicker` (来自 @mui/x-date-pickers) | 文章检索 起止时间选择 |
| `Autocomplete` | 文章标题输入 + 下拉候选 |
| `CircularProgress` | AI 思考中进度指示 |
| `Tooltip` | 按钮悬浮提示 |
| `Badge` | 爬虫记录区的新文章数量徽标 |

## 交互逻辑

### 左侧 Drawer

- **爬虫记录区**：顶部显示 "爬虫记录" 标题，右侧带 `ArrowForward` 图标，点击跳转至文章列表页。下方展示最后爬取时间（`Typography caption`）和文章总量（`Typography body2`）。
- **新建对话按钮**：点击清空当前对话区，创建新的对话 session，调用 `useChatStore.createSession()`。
- **历史对话列表**：每条记录为 `ListItemButton`，点击加载该 session 的对话历史。当前选中项高亮（`selected` 状态）。
- **设置按钮**：底部 `IconButton`，右侧 `ArrowForward`，点击 `navigate('/settings')`。
- **折叠/展开**：通过 `Drawer` 的 `variant="persistent"` 和 `open` 状态控制。折叠后仅显示图标列表。

### 中央内容区 — Chat 模式

- 输入区域位于底部，使用 `TextField`（`multiline`）+ `IconButton`（发送图标）组成。
- 消息列表使用 `Stack` 纵向排列，用户消息右对齐（`Avatar` + `Paper`），AI 消息左对齐。
- 发送后调用 `invoke('chat_send', { message, sessionId })` 与 Tauri 后端通信，后端将请求转发至大模型（云端或本地）。
- AI 回复流式显示：后端通过 Tauri Event `chat:stream` 推送 token，前端逐步追加到消息内容。

### 中央内容区 — 文章检索 模式

- 切换到该 Tab 后，输入区上方显示 `DatePicker` 起止时间选择（精确到天）。
- 用户输入搜索需求后，发送至大模型，大模型返回匹配论文列表。
- 搜索结果以 `Card` 列表展示，每张卡片包含论文标题、作者、摘要缩略、来源。

### 中央内容区 — Chapter Summary 模式

- 切换到该 Tab 后，显示 `Autocomplete` 输入框，输入文章标题部分后展示下拉候选。
- 选择文章后点击发送，AI 对文章内容逐章总结。
- 若从文章列表页跳转而来（携带 `articleId` query param），自动填入文章信息并触发总结，用户无需再次输入。

### 右侧工具栏

详见 [07-shared-components.md](./07-shared-components.md) 中 RightToolbar 组件设计。

## 状态管理

```typescript
// stores/useChatStore.ts
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

- 爬虫状态通过 `invoke('get_crawler_status')` 获取，存入 `useArticleStore`。
- 对话 session 持久化至 Tauri 本地 SQLite 数据库，通过后端 API 管理。

## 与大模型交互入口

主页的 AI 对话是核心入口，通过 Tauri `invoke` 调用后端统一的大模型接口：

```
用户输入 → invoke('chat_send', {message, mode, context})
         → 后端判断云端/本地模型
         → 流式返回 → listen('chat:stream', callback)
```

三种模式（Chat / Search / Summary）共用同一对话后端，通过 `mode` 参数区分上下文构建方式。

## 组件树

```
HomePage
├── SideDrawer (左侧)
│   ├── Box (爬虫记录区)
│   │   ├── Typography (标题 + ArrowForward → 文章列表)
│   │   ├── Typography (最后爬取时间)
│   │   └── Typography (文章总量)
│   ├── Divider
│   ├── Button (新建对话)
│   ├── List (历史对话)
│   │   └── ListItemButton × N
│   │       ├── ListItemAvatar
│   │       └── ListItemText
│   ├── Divider
│   ├── IconButton (设置 → ArrowForward)
│   └── Typography (版本号)
│
├── Box (中央内容区)
│   ├── Tabs [Chat | Search | Summary]
│   ├── ChatPanel
│   │   ├── Stack (消息列表)
│   │   │   └── (Avatar + Paper) × N
│   │   ├── Skeleton (加载占位)
│   │   └── Box (输入区)
│   │       ├── TextField (multiline)
│   │       └── IconButton (发送)
│   ├── PaperSearchPanel
│   │   ├── Box (DatePicker × 2)
│   │   ├── Stack (搜索结果)
│   │   │   └── Card × N
│   │   └── Box (输入区)
│   └── ChapterSummaryPanel
│       ├── Autocomplete (文章选择)
│       ├── Stack (总结结果)
│       └── Box (输入区)
│
└── RightToolbar (右侧，见 07-shared-components.md)
```
