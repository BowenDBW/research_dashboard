# 设计文档概览

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 框架 | React | 18 |
| 语言 | TypeScript | 5.x |
| UI 库 | Material-UI | v5 |
| 日期选择 | @mui/x-date-pickers | v6 |
| 日期处理 | dayjs | 1.x |
| 状态管理 | Zustand | 4.x |
| 路由 | React Router | v6 |
| 桌面壳 | Tauri | 2.x |
| 构建工具 | Vite | 5.x |

## 项目目录结构

```
src/
├── app/                    # 应用入口与全局配置
│   ├── App.tsx            # 根组件
│   ├── Router.tsx         # 路由配置
│   └── ThemeProvider.tsx  # 主题提供者
├── components/            # 组件
│   ├── common/            # 通用组件
│   │   ├── ConfirmDialog.tsx
│   │   ├── MarkdownViewer.tsx
│   │   └── SubscriptionDialog.tsx
│   ├── layout/            # 布局组件
│   │   ├── AppShell.tsx   # 三栏布局外壳
│   │   ├── SideDrawer.tsx # 左侧栏
│   │   └── RightToolbar.tsx # 右侧栏
│   ├── settings/          # 设置组件
│   │   └── SettingsDialog.tsx
│   ├── article/           # 文章相关组件
│   │   ├── ArticleCard.tsx
│   │   ├── ArticleActions.tsx
│   │   └── AbstractDialog.tsx
│   └── daily/             # 日报相关组件
│       └── DailyReportDialog.tsx
├── pages/                 # 页面组件
│   ├── HomePage/          # 主页
│   ├── ArticleListPage/   # 文章列表
│   ├── FavoritesPage/     # 收藏夹
│   ├── HistoryPage/       # 历史记录
│   ├── DailyPage/         # Claw 日报
│   └── SettingsPage/      # 设置页（已废弃，改用对话框）
├── stores/                # Zustand 状态管理
│   ├── useChatStore.ts
│   ├── useArticleStore.ts
│   ├── useFavoriteStore.ts
│   ├── useHistoryStore.ts
│   ├── useDailyStore.ts
│   ├── useSettingsStore.ts
│   └── useSubscriptionStore.ts
├── types/                 # TypeScript 类型定义
│   ├── article.ts
│   ├── chat.ts
│   ├── favorite.ts
│   ├── history.ts
│   ├── daily.ts
│   ├── settings.ts
│   ├── subscription.ts
│   └── index.ts
└── main.tsx              # 入口文件
```

## 路由结构

使用 `createHashRouter` 创建嵌套路由，适配 Tauri 桌面应用：

```typescript
const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,      // 三栏布局外壳
    children: [
      { index: true, element: <HomePage /> },
      { path: 'articles', element: <ArticleListPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'favorites/:folderId', element: <FavoritesPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'daily', element: <DailyPage /> },
    ],
  },
]);
```

## 全局状态管理

使用 Zustand 进行状态管理，各 Store 职责如下：

| Store | 职责 |
|-------|------|
| useChatStore | 对话会话与消息管理 |
| useArticleStore | 文章数据与搜索 |
| useFavoriteStore | 收藏夹树形结构 |
| useHistoryStore | 阅读与对话历史 |
| useDailyStore | Claw 日报数据 |
| useSettingsStore | 应用设置（主题、模型配置等） |
| useSubscriptionStore | 订阅关键词与作者 |

## 设计文档索引

| 文档 | 内容 |
|------|------|
| [01-theme-and-layout](./01-theme-and-layout.md) | 主题配置与三栏布局 |
| [02-home-page](./02-home-page.md) | 主页与 AI 对话 |
| [03-article-list-page](./03-article-list-page.md) | 文章列表页 |
| [04-favorites-page](./04-favorites-page.md) | 收藏夹页面 |
| [05-daily-page](./05-daily-page.md) | Claw 日报页面 |
| [06-history-page](./06-history-page.md) | 历史记录页面 |
| [07-settings-dialog](./07-settings-dialog.md) | 设置对话框 |
| [08-shared-components](./08-shared-components.md) | 共享组件 |
| [09-state-and-data](./09-state-and-data.md) | 状态管理与数据流 |
| [10-right-toolbar](./10-right-toolbar.md) | 右侧栏设计 |