# Research Dashboard 前端详细设计方案

> 技术栈：React 19 + Material UI v9.0 + Tauri v2 + TypeScript + Vite
> 目标平台：桌面端（Windows / macOS / Linux），以桌面端为主
> 输出日期：2026-04-19

---

## 文档索引

本设计方案按职责拆分为以下子文档，实现时按需查阅对应文档即可：

| 序号 | 文档 | 内容 | 实现优先级 |
|------|------|------|-----------|
| 0 | [00-overview.md](./00-overview.md) | 技术选型、项目结构、架构分层、开发路线图 | 首先阅读 |
| 1 | [01-theme-and-layout.md](./01-theme-and-layout.md) | 主题定制、全局布局壳、路由配置、响应式设计 | P0 — 基础框架 |
| 2 | [02-home-page.md](./02-home-page.md) | 主页：左侧 Drawer + AI 三模式 + 右侧工具栏入口 | P0 — 核心页面 |
| 3 | [03-article-list-page.md](./03-article-list-page.md) | 文章列表页：多维筛选 + 文章卡片 + 分页 | P1 |
| 4 | [04-favorites-page.md](./04-favorites-page.md) | 收藏页：文件夹层级 + 右键菜单 + 面包屑导航 | P1 |
| 5 | [05-settings-page.md](./05-settings-page.md) | 设置页：爬虫/应用/大模型配置 | P2 |
| 6 | [06-history-page.md](./06-history-page.md) | 阅读历史页：时间线 + 行为筛选 | P2 |
| 7 | [07-shared-components.md](./07-shared-components.md) | 公共组件：ArticleActions、RightToolbar、SubscriptionDialog、ContextMenu、ConfirmDialog | P0 — 跨页面复用 |
| 8 | [08-state-and-data.md](./08-state-and-data.md) | Zustand Store 设计、数据流、持久化策略、Tauri Commands、TypeScript 类型定义 | P0 — 全局数据层 |
| 9 | [09-extensibility.md](./09-extensibility.md) | 扩展性设计：数据源扩展、AI 功能扩展、插件化预留 | 参考 |

---

## 建议实现顺序

```
Phase 1 — 骨架搭建
  00-overview → 01-theme-and-layout → 08-state-and-data（类型定义部分）

Phase 2 — 核心功能
  07-shared-components → 02-home-page

Phase 3 — 文章管理
  03-article-list-page → 04-favorites-page → 06-history-page

Phase 4 — 配置与完善
  05-settings-page → 08-state-and-data（Store 完整实现） → 09-extensibility
```

---

*文档版本：v1.0 | 编写日期：2026-04-19 | 基于 Ruqirements.md v1.0 + Material UI v9.0 文档*
