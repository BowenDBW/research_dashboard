# 前端设计文档

本目录包含 Research Dashboard（Claw）的前端设计文档。

## 文档索引

| 文档 | 描述 |
|------|------|
| [00-overview.md](./00-overview.md) | 技术栈、目录结构、路由、状态管理概览 |
| [01-theme-and-layout.md](./01-theme-and-layout.md) | MUI 主题配置、三栏布局设计 |
| [02-home-page.md](./02-home-page.md) | 主页三种对话模式、模型选择器、空状态设计 |
| [03-article-list-page.md](./03-article-list-page.md) | 文章列表、搜索筛选、文章卡片 |
| [04-favorites-page.md](./04-favorites-page.md) | 收藏夹树形结构、文件夹导航 |
| [05-daily-page.md](./05-daily-page.md) | Claw 日报列表、Markdown 渲染、分页控制 |
| [06-history-page.md](./06-history-page.md) | 阅读历史、对话历史、时间分组 |
| [07-settings-dialog.md](./07-settings-dialog.md) | 设置对话框、大模型配置、无限循环问题解决 |
| [08-shared-components.md](./08-shared-components.md) | MarkdownViewer、各种弹窗组件 |
| [09-state-and-data.md](./09-state-and-data.md) | Zustand Store 设计、类型定义、数据流 |
| [10-right-toolbar.md](./10-right-toolbar.md) | 右侧栏四个模块、颜色方案、交互设计 |

## 需求文档

- [Requirements.md](../Requirements.md) - 需求分析文档

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 技术栈

- React 18 + TypeScript
- Material-UI v5
- Zustand (状态管理)
- React Router v6 (HashRouter)
- Tauri (桌面壳)