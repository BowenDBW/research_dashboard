# Research Dashboard 数据持久化规范

本文档规定了 Research Dashboard 项目的本地数据存储与持久化逻辑。为了方便数据维护、跨端同步以及隔离开发环境，所有的应用级产生数据将集中存放在用户主目录下的统一数据文件夹中。

## 核心数据工作空间
所有的本地持久化数据均默认存储于：
- **路径**：`~/.research_dashboard/`  （即以当前系统用户名为主目录下的隐藏文件夹）

### 1. 关系型数据库 (SQLite)
用于存放大规模、具有结构与关联性以及需要复杂查询的业务数据（如文章列表、分类、收藏记录、历史记录等）。
- **文件命名约束**：整个应用**仅维护一个** SQLite 数据库文件，命名必须为 `research_dashboard.db`。
- **存储路径**：`~/.research_dashboard/research_dashboard.db`
- **初始化与重置**：数据库建表及默认数据基于 `docs/datasource/research_dashboard.sql` 驱动。

### 2. 键值对存储配置 (JSON)
用于存储应用层的轻量级数据和配置状态，如主题偏好、订阅列表配置、页面布局选项等。
- **划分逻辑**：支持按业务模块划分为**多个** JSON 文件，避免单个配置文件过于臃肿导致读写冲突。
- **推荐命名与存储路径**：
  - 应用通用设置：`~/.research_dashboard/settings.json`
  - 窗口状态/缓存：`~/.research_dashboard/window_state.json`
- **写入机制**：可结合 Tauri 侧直接读写，或者使用官方支持的 `tauri-plugin-store`。

### 3. 普通文件存储逻辑 (File/Blob)
由于阅读器或爬虫可能会产生 PDF 文档、离线 HTML 网页、封面图片等二进制或大型文本文件，这类数据既不适合放进数据库，也不适合放进 JSON。
- **存储路径**：建立特定的子目录进行归档分类：
  - PDF/文章下载：`~/.research_dashboard/files/`

