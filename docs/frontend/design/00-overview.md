# 00 — 总体架构

## 技术选型

| 层次 | 技术 | 说明 |
|------|------|------|
| 桌面壳 | Tauri v2 | Rust 后端，提供文件系统、HTTP、自启动等原生能力 |
| 前端框架 | React 19 | 函数组件 + Hooks |
| UI 组件库 | Material UI v9.0 | 含 MCP AI 对话组件 |
| 路由 | React Router v7 | 客户端路由，HashRouter 适配 Tauri |
| 状态管理 | Zustand | 轻量、TypeScript 友好 |
| 类型系统 | TypeScript 5.8 | 全量严格模式 |
| 构建工具 | Vite 7 | HMR + Tauri 集成 |

## 项目目录结构

```
src/
├── app/                    # 应用入口、路由、主题
│   ├── App.tsx
│   ├── Router.tsx
│   └── ThemeProvider.tsx
├── pages/                  # 一级页面
│   ├── HomePage/
│   ├── ArticleListPage/
│   ├── FavoritesPage/
│   ├── SettingsPage/
│   └── HistoryPage/
├── components/             # 公共组件
│   ├── layout/
│   │   ├── AppShell.tsx        # 全局三栏布局壳
│   │   ├── SideDrawer.tsx      # 左侧可折叠 Drawer
│   │   └── RightToolbar.tsx    # 右侧常驻工具栏
│   ├── article/
│   │   ├── ArticleCard.tsx     # 文章列表项
│   │   ├── ArticleDetail.tsx   # 文章详情展开
│   │   └── ArticleActions.tsx  # 5 功能按钮组
│   ├── ai/
│   │   ├── ChatPanel.tsx       # MCP AI 对话面板
│   │   ├── PaperSearchPanel.tsx
│   │   └── ChapterSummaryPanel.tsx
│   ├── favorites/
│   │   ├── FolderItem.tsx
│   │   ├── FavoriteFileItem.tsx
│   │   └── FolderBreadcrumb.tsx
│   └── common/
│       ├── SubscriptionDialog.tsx
│       ├── ConfirmDialog.tsx
│       └── ContextMenu.tsx
├── stores/                 # Zustand stores
│   ├── useArticleStore.ts
│   ├── useFavoriteStore.ts
│   ├── useChatStore.ts
│   ├── useSettingsStore.ts
│   ├── useHistoryStore.ts
│   └── useSubscriptionStore.ts
├── hooks/                  # 自定义 Hooks
│   ├── useTauriCommand.ts
│   ├── useContextMenu.ts
│   └── usePagination.ts
├── types/                  # TypeScript 类型
│   ├── article.ts
│   ├── favorite.ts
│   ├── chat.ts
│   ├── settings.ts
│   └── subscription.ts
├── utils/                  # 工具函数
│   ├── tauri.ts
│   └── formatters.ts
└── assets/
```

## 架构分层

```
┌──────────────────────────────────────────────────┐
│                   Tauri Window                    │
│  ┌──────────────────────────────────────────────┐ │
│  │              React Application                │ │
│  │  ┌─────────┐  ┌──────────────┐  ┌────────┐ │ │
│  │  │  Pages   │  │  Components  │  │ Stores │ │ │
│  │  │ (Route)  │←→│  (UI 层)     │←→│(状态层)│ │ │
│  │  └─────────┘  └──────┬───────┘  └───┬────┘ │ │
│  │                       │               │      │ │
│  │              ┌────────┴────────┐      │      │ │
│  │              │   Tauri API     │←─────┘      │ │
│  │              │ (invoke / event)│             │ │
│  │              └────────┬────────┘             │ │
│  └───────────────────────┼──────────────────────┘ │
│                          │                        │
│  ┌───────────────────────┴──────────────────────┐ │
│  │              Rust Backend                     │ │
│  │  (爬虫调度 / 数据库 / 文件操作 / HTTP 代理)  │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## 页面间导航关系

```
                     ┌──────────┐
                     │   主页   │
                     │ HomePage │
                     └──┬───┬───┘
                        │   │
            ┌───────────┘   └───────────┐
            ▼                           ▼
  ┌──────────────────┐        ┌──────────────────┐
  │   文章列表页     │←───────│   阅读历史页     │
  │ ArticleListPage  │  跳转  │   HistoryPage    │
  └────────┬─────────┘        └──────────────────┘
           │                           
           │ (AI 按钮跳回主页 Summary)
           ▼
  ┌──────────────────┐        ┌──────────────────┐
  │   收藏文章页     │        │   设置界面       │
  │ FavoritesPage    │        │  SettingsPage    │
  └──────────────────┘        └──────────────────┘

右侧工具栏入口：
  - 收藏夹文件树 → 点击标题跳转收藏页
  - 本周历史    → 点击标题跳转历史页
  - 订阅设置    → 弹出 SubscriptionDialog
```
