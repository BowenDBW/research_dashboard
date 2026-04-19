# 06 — 阅读历史页（HistoryPage）

## 页面概述

阅读历史页按时间顺序展示用户的阅读行为记录（查看摘要、访问来源、收藏、下载均视为阅读），支持按时间和行为类别筛选，点击条目可跳转至文章列表页查看详情。

## 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ HistoryPage                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AppBar: [← 返回主页]  阅读历史                          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Filter Bar                                              │ │
│ │ ┌───────────────────┐ ┌──────────────────────────────┐ │ │
│ │ │ 时间范围          │ │ 行为类别                     │ │ │
│ │ │ DatePicker 起止   │ │ [全部][摘要][链接][收藏][下载]│ │ │
│ │ └───────────────────┘ └──────────────────────────────┘ │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Timeline                                                │ │
│ │ ┌─ 2026-04-18 ──────────────────────────────────────┐  │ │
│ │ │ ● 文章标题A  · 查看摘要  · 14:30                  │  │ │
│ │ │ ● 文章标题B  · 收藏      · 10:15                  │  │ │
│ │ └───────────────────────────────────────────────────┘  │ │
│ │ ┌─ 2026-04-17 ──────────────────────────────────────┐  │ │
│ │ │ ● 文章标题C  · 下载PDF   · 16:00                  │  │ │
│ │ │   └ 展开详情: 标题/作者/来源                      │  │ │
│ │ │     [摘要][链接][收藏][下载][AI]                   │  │ │
│ │ └───────────────────────────────────────────────────┘  │ │
│ │ ...                                                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Pagination                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 使用的 MUI 组件

| 组件 | 用途 |
|------|------|
| `AppBar` + `Toolbar` | 顶部导航 |
| `Button` / `IconButton` | 返回主页、功能按钮 |
| `Container` | 内容区 |
| `Timeline` / `TimelineItem` / `TimelineSeparator` / `TimelineContent` / `TimelineDot` / `TimelineOppositeContent` | 按日期分组的时间线展示 |
| `DatePicker` (@mui/x-date-pickers) | 时间范围筛选 |
| `ToggleButtonGroup` / `ToggleButton` | 行为类别筛选（全部/摘要/链接/收藏/下载） |
| `Typography` | 日期标题、文章标题、行为描述、时间 |
| `Chip` | 行为类别标签 |
| `Card` / `CardContent` / `CardActions` | 展开后的文章详情 |
| `Collapse` | 详情展开/收起 |
| `IconButton` | 展开按钮、功能按钮 |
| `Pagination` | 分页 |
| `Tooltip` | 按钮提示 |
| `Dialog` | 摘要查看弹窗 |
| `Avatar` | Timeline 节点图标 |

## 交互逻辑

### 筛选栏

- 时间范围：`DatePicker` 起止日期，默认显示最近一周。
- 行为类别：`ToggleButtonGroup`，选项为 "全部 / 摘要 / 链接 / 收藏 / 下载"，多选。
- 筛选变更自动触发查询。

### 时间线列表

- 按 `Timeline` 组件展示，按日期分组。每个 `TimelineItem` 显示文章标题、行为类别（`Chip`）、时间。
- 点击条目展开详情（`Collapse`），显示文章完整信息（标题、作者、来源）+ 5 个功能按钮。
- 点击 AI 按钮跳转至主页 Summary 模式，与文章列表页逻辑一致。
- 点击 "查看详情" 跳转至文章列表页并定位该文章：`navigate(`/articles?highlight=${articleId}`)`。

### 分页

- 使用 `Pagination` 组件，按时间倒序分页。

## 状态管理

```typescript
// stores/useHistoryStore.ts
interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  filters: HistoryFilters;
  loading: boolean;
  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
}

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

## 组件树

```
HistoryPage
├── AppBar + Toolbar
│   ├── IconButton (返回 ArrowBack)
│   └── Typography (标题)
├── Box (筛选栏)
│   ├── DatePicker × 2 (时间范围)
│   └── ToggleButtonGroup (行为类别)
│       └── ToggleButton × N
├── Timeline
│   └── TimelineItem × N
│       ├── TimelineSeparator
│       │   └── TimelineDot (Avatar)
│       ├── TimelineContent
│       │   ├── Typography (文章标题)
│       │   ├── Chip (行为类别)
│       │   ├── Typography (时间)
│       │   ├── IconButton (展开)
│       │   └── Collapse (详情)
│       │       ├── Typography (标题)
│       │       ├── Typography (作者)
│       │       ├── Chip (来源)
│       │       └── ArticleActions (5 按钮，见 07-shared-components.md)
│       └── TimelineOppositeContent (时间)
└── Pagination
```
