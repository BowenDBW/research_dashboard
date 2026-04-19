# 03 — 文章列表页（ArticleListPage）

## 页面概述

文章列表页展示爬虫抓取的全部文章，提供多维筛选（时间段、来源、作者、领域）、分页浏览、以及针对每篇文章的操作按钮（查看摘要、来源链接、收藏、下载 PDF、AI 总结跳转）。页面顶部为筛选栏，中部为文章列表，底部为分页控件。

## 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ ArticleListPage                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AppBar: [← 返回主页]  文章列表                          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Filter Bar (Collapsible)                                │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│ │ │ 时间段   │ │ 来源     │ │ 作者     │ │ 领域     │  │ │
│ │ │ DatePicker│ │Autocomplete│ │ TextField│ │Autocomplete│ │
│ │ │  起止    │ │  多选    │ │ 文本搜索 │ │  多选    │  │ │
│ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Article List                                            │ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ ArticleCard 1                                       ││ │
│ │ │ 标题  作者  来源  时间  [摘要][链接][收藏][下载][AI]││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ ArticleCard 2                                       ││ │
│ │ │ ...                                                 ││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ │ ...                                                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Pagination  [每页N条 ▼]  < 1 2 3 ... >               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────┐                                   ┌───────┐ │
│ │ SideDrawer  │                                   │Right  │ │
│ │ (折叠态)    │                                   │Toolbar│ │
│ └─────────────┘                                   └───────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 使用的 MUI 组件

| 组件 | 用途 |
|------|------|
| `AppBar` + `Toolbar` | 顶部导航栏，含返回按钮和标题 |
| `Button` (IconButton) | 返回主页、各功能按钮 |
| `ArrowBack` (Icon) | 返回按钮图标 |
| `Box` | 筛选栏容器、列表容器 |
| `Accordion` / `AccordionSummary` / `AccordionDetails` | 筛选栏可折叠面板 |
| `DatePicker` (@mui/x-date-pickers) | 时间段起止选择 |
| `Autocomplete` (multiple, freeSolo) | 来源多选（可输入文字） |
| `Autocomplete` (multiple, freeSolo) | 领域多选（可输入文字） |
| `TextField` | 作者名文本搜索框 |
| `Grid` (v2) | 筛选栏四列布局 |
| `Card` / `CardContent` / `CardActions` | 文章列表项卡片 |
| `Typography` | 标题、作者、来源、时间文字 |
| `Chip` | 领域标签显示 |
| `IconButton` | 5 个功能按钮 |
| `Tooltip` | 按钮悬浮说明 |
| `Snackbar` | 操作反馈（收藏成功等） |
| `Pagination` | 底部分页 |
| `Select` / `MenuItem` | 每页条数选择 |
| `Skeleton` | 文章加载占位 |
| `Dialog` / `DialogTitle` / `DialogContent` | 摘要弹窗 |
| `Badge` | 新文章标记 |

## 交互逻辑

### 筛选栏

- 默认展开，可通过 `Accordion` 折叠。筛选条件变更后自动触发查询（防抖 300ms）。
- 时间段：两个 `DatePicker`，起止日期，精确到天。
- 来源：`Autocomplete`，`multiple` + `freeSolo`，选项来自后端已收录的期刊/会议列表，用户也可自由输入。
- 作者：`TextField`，文本模糊匹配，输入后实时过滤。
- 领域：`Autocomplete`，`multiple` + `freeSolo`，预置 cs.LG、cs.AI 等选项，用户可自定义。
- 订阅关键词和作者自动作为默认筛选值填入（来自 `useSubscriptionStore`）。

### 文章列表

- 每篇文章渲染为 `Card`，内含标题（`Typography subtitle1`）、作者（`Typography body2`）、来源（`Chip`）、发布时间（`Typography caption`）。
- 右侧 5 个 `IconButton`：
  - **查看摘要**：弹出 `Dialog`，显示完整 abstract。
  - **来源网页**：调用 `invoke('open_url', { url })` 通过系统浏览器打开 arxiv 或来源链接。
  - **收藏**：调用 `invoke('toggle_favorite', { articleId, folderId })`，切换收藏状态，图标在高亮/默认间切换。
  - **下载 PDF**：调用 `invoke('open_url', { url })` 在浏览器预览 PDF（后端提供链接）。
  - **AI 总结**：跳转至主页 Summary 模式，`navigate('/?tab=summary&articleId=xxx')`，自动触发逐章总结。

### 分页

- 底部 `Pagination` 组件 + `Select` 选择每页条数（10/20/50）。
- 翻页调用 `invoke('query_articles', { page, pageSize, filters })` 从后端分页查询。

### 返回主页

- `AppBar` 左侧 `IconButton`（`ArrowBack`），点击 `navigate('/')`。

## 状态管理

```typescript
// stores/useArticleStore.ts
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

interface ArticleFilters {
  dateRange: [Dayjs | null, Dayjs | null];
  sources: string[];
  author: string;
  domains: string[];
}
```

## 组件树

```
ArticleListPage
├── AppBar + Toolbar
│   ├── IconButton (返回 ArrowBack)
│   └── Typography (标题)
├── Accordion (筛选栏)
│   └── Grid (4 列)
│       ├── DatePicker × 2 (时间段)
│       ├── Autocomplete (来源，multiple + freeSolo)
│       ├── TextField (作者搜索)
│       └── Autocomplete (领域，multiple + freeSolo)
├── Box (文章列表)
│   └── ArticleCard × N
│       ├── CardContent
│       │   ├── Typography (标题 subtitle1)
│       │   ├── Typography (作者 body2)
│       │   ├── Chip (来源)
│       │   └── Typography (时间 caption)
│       └── CardActions
│           └── ArticleActions (5 按钮，见 07-shared-components.md)
└── Box (分页)
    ├── Pagination
    └── Select + MenuItem (每页条数)
```
