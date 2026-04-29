# Research Dashboard 后端架构设计文档

## 一、架构概览

Research Dashboard 是一个基于 Tauri 的桌面应用，后端使用 Rust 实现。整体架构分为三个核心模块：

1. **数据存储模块**：负责 SQLite 数据库和 JSON 配置文件的读写操作
2. **AI 对话模块**：负责云端大模型（OpenAI 格式 API）和本地 MLX 模型的交互
3. **爬虫与 PDF 处理模块**：负责 Arxiv 爬取和 PDF 文本提取

---

## 二、数据存储策略

根据接口需求分析，数据存储采用分层策略：

| 数据类型 | 存储位置 | 原因 |
|---------|---------|------|
| 论文数据、收藏、订阅、历史、对话记录 | SQLite 数据库 | 需要复杂查询、关联查询、全文检索 |
| 应用设置、LLM 配置、爬取配置 | `settings.json` | 配置数据，无需复杂查询 |
| 右边栏布局配置 | `layout.json` | 用户个性化配置，独立于应用设置 |
| 非 Arxiv 论文的 PDF 文件 | `~/.research_dashboard/pdfs/` | 手动添加的非 Arxiv 论文需要持久化存储 |
| Arxiv 论文的 PDF | 不存储，临时下载 | 通过 preprint_number 拼接 URL，临时下载读取后删除 |
| 主题模式 | localStorage | 纯前端状态，无需后端存储 |

---

## 三、应用启动初始化流程

后端需要在应用启动时执行初始化流程，确保数据存储环境准备就绪。这是一个重要的设计考虑点：

### 3.1 初始化检查顺序

应用启动时，后端应按以下顺序进行检查和初始化：

**第一步：检查并创建数据目录**
- 检查 `~/.research_dashboard/` 目录是否存在
- 若不存在，创建该目录
- 同时创建 `pdfs/` 子目录，用于存储用户手动添加的非 Arxiv 论文的 PDF 文件（Arxiv 论文不存储 PDF，临时下载读取后删除）

**第二步：检查并初始化 settings.json**
- 检查 `~/.research_dashboard/settings.json` 文件是否存在
- 若不存在，创建默认设置文件，包含：
  - 空的爬取领域列表 `crawlerCategories: []`
  - 默认爬取频率 `crawlIntervalHours: 4`
  - 空的 PDF 存储路径 `pdfStoragePath: ""`
  - 关闭开机自启动 `autoLaunch: false`
  - 空的云端 Provider 列表 `cloudProviders: []`
  - 空的本地 Provider 列表 `localProviders: []`
  - 未选择模型 `selectedModelId: null`

**第三步：检查并初始化 layout.json**
- 检查 `~/.research_dashboard/layout.json` 文件是否存在
- 若不存在，创建默认布局配置，包含：
  - 默认面板顺序 `panelOrder: ["arxiv", "daily", "favorites", "history", "stats", "subscription"]`
  - 无隐藏面板 `hiddenPanels: []`
  - 仅展开 Arxiv 面板 `expandedPanels: ["arxiv"]`

**第四步：检查并初始化 SQLite 数据库**
- 检查 `~/.research_dashboard/research_dashboard.db` 文件是否存在
- 若不存在，创建数据库文件并执行建表语句，包括：
  - `papers` 论文表，包含 `preprint_number` 字段（存储 arxiv 号，用于拼接 PDF URL）和 `pdf_path` 字段（存储非 Arxiv 论文的本地 PDF 路径）
  - `paper_authors` 论文作者表
  - `paper_categories` 论文领域表
  - `daily_recommendations` 每日推荐表
  - `favorite_folders` 收藏文件夹表
  - `favorite_papers` 收藏论文表
  - `subscribed_authors` 订阅作者表
  - `subscribed_categories` 订阅领域表
  - `subscribed_keywords` 订阅关键词表
  - `user_action_logs` 用户操作日志表
  - `chat_sessions` 对话会话表
  - `chat_messages` 对话消息表
- 若数据库已存在，检查是否需要执行迁移（版本升级时可能有新表或新字段）

**第五步：同步开机自启动状态**
- 读取 `settings.json` 中的 `autoLaunch` 字段
- 查询当前系统的开机自启动状态（通过 Tauri Autostart API）
- 若两者不一致，根据 `autoLaunch` 字段启用或禁用开机自启动

### 3.2 初始化失败处理

若初始化过程中发生错误（如无法创建目录、无法写入文件、无法创建数据库），后端应：
- 记录错误日志
- 向前端返回错误信息，提示用户检查文件系统权限或磁盘空间
- 应用可选择退出或以受限模式运行

---

## 四、接口总览

根据接口需求文档分析，后端共需实现 **45 个接口**，分为以下几类：

| 接口类别 | 接口数量 | 主要功能 |
|---------|---------|---------|
| 论文相关接口 | 6 个 | 论文列表、详情、搜索、订阅筛选、来源、领域 |
| 每日推荐接口 | 3 个 | 推荐列表、推荐详情、最近推荐 |
| 收藏夹接口 | 9 个 | 文件夹 CRUD、收藏 CRUD、移动、路径查询 |
| 订阅系统接口 | 7 个 | 作者/领域/关键词的 CRUD |
| 历史记录接口 | 4 个 | 阅读历史、对话历史、操作日志、分组查询 |
| 统计分析接口 | 3 个 | 综合统计、今日统计、趋势数据 |
| 对话会话接口 | 5 个 | 会话 CRUD、消息列表、发送消息（AI 对话） |
| Tauri Command 接口 | 8 个 | 设置读写、布局读写、连接测试、爬取触发/状态/定时 |

---

## 五、接口与界面功能对应关系

### 5.1 论文相关接口（6 个）

这些接口主要服务于 **ArticleListPage（论文列表页）** 和 **HomePage（主页）的 AI 搜索推荐模式**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/papers** | ArticleListPage 的论文列表展示，支持关键词搜索、日期范围筛选、来源筛选、领域筛选、分页显示。首页右侧工具栏的 Arxiv 面板也会调用此接口展示最近论文。 |
| **GET /api/papers/{articleId}** | ArticleListPage 点击论文查看详情时调用。HomePage 的章节总结模式在开始对话前也需要调用此接口获取论文信息以便读取 PDF。 |
| **GET /api/papers/subscribed** | ArticleListPage 的"仅显示订阅内容"筛选功能。当用户开启此筛选时，后端根据订阅表（作者、领域、关键词）筛选论文，返回与订阅相关的论文列表。 |
| **POST /api/papers/search** | HomePage 的 AI 搜索推荐模式。用户输入关键词后，后端先调用 LLM 分析意图，再查询数据库返回相关论文，最后由 LLM 生成搜索结果解释说明。 |
| **GET /api/papers/sources** | ArticleListPage 的来源筛选下拉框数据来源，返回所有可选的会议/期刊名称列表。 |
| **GET /api/papers/domains** | ArticleListPage 的领域筛选下拉框数据来源，返回所有可选的 arXiv 领域代码列表。 |

---

### 5.2 每日推荐接口（3 个）

这些接口主要服务于 **DailyPage（每日推荐页）** 和 **HomePage（主页）右侧工具栏的 Daily 面板**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/daily-recommendations** | DailyPage 的推荐列表展示，支持按月份筛选和分页显示。每个条目显示推荐日期和论文数量。 |
| **GET /api/daily-recommendations/{recommendationId}** | DailyPage 点击某条推荐后弹窗展示详情，显示该日期推荐的所有论文列表。 |
| **GET /api/daily-recommendations/recent** | HomePage 右侧工具栏的 Daily 面板，展示最近几天的推荐摘要，用户点击可跳转到 DailyPage 查看详情。 |

---

### 5.3 收藏夹接口（9 个）

这些接口主要服务于 **FavoritesPage（收藏夹页）**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/favorites/folders/{folderId}/contents** | FavoritesPage 的核心展示接口。获取指定文件夹下的子文件夹和收藏论文列表。同时返回面包屑路径数据。`folderId=root` 表示根目录。 |
| **POST /api/favorites/folders** | FavoritesPage 的"新建文件夹"功能。在当前目录下创建新文件夹。 |
| **PATCH /api/favorites/folders/{folderId}** | FavoritesPage 的"重命名文件夹"功能。右键菜单或双击编辑触发。 |
| **DELETE /api/favorites/folders/{folderId}** | FavoritesPage 的"删除文件夹"功能。删除时级联删除所有子文件夹和其中的收藏论文。 |
| **PATCH /api/favorites/folders/{folderId}/move** | FavoritesPage 的"剪切/粘贴文件夹"功能。用户选中文件夹后点击剪切，然后导航到目标目录点击粘贴，调用此接口移动文件夹。 |
| **POST /api/favorites/papers** | ArticleListPage 或其他页面的"收藏论文"功能。将论文收藏到指定文件夹。 |
| **DELETE /api/favorites/papers/{articleId}** | ArticleListPage 或 FavoritesPage 的"取消收藏"功能。 |
| **PATCH /api/favorites/papers/{articleId}/move** | FavoritesPage 的"移动收藏"功能。将收藏的论文从当前文件夹移动到另一个文件夹。 |
| **GET /api/favorites/folders/{folderId}/path** | FavoritesPage 的面包屑导航功能。获取从根目录到当前文件夹的完整路径，用于顶部面包屑组件展示。 |

---

### 5.4 订阅系统接口（7 个）

这些接口主要服务于 **订阅管理对话框（SubscriptionDialog）**，该对话框从 HomePage 右侧工具栏的 Subscription 面板打开。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/subscriptions** | SubscriptionDialog 打开时调用，获取用户当前订阅的所有作者、领域、关键词。同时在 HomePage 右侧工具栏的 Subscription 面板直接展示订阅列表。 |
| **POST /api/subscriptions/authors** | SubscriptionDialog 的"添加订阅作者"功能。用户输入作者姓名后添加订阅。 |
| **DELETE /api/subscriptions/authors/{id}** | SubscriptionDialog 的"删除订阅作者"功能。点击作者条目的删除按钮触发。 |
| **POST /api/subscriptions/categories** | SubscriptionDialog 的"添加订阅领域"功能。用户从下拉列表选择 arXiv 领域代码后添加订阅。 |
| **DELETE /api/subscriptions/categories/{id}** | SubscriptionDialog 的"删除订阅领域"功能。 |
| **POST /api/subscriptions/keywords** | SubscriptionDialog 的"添加订阅关键词"功能。用户输入关键词后添加订阅。 |
| **DELETE /api/subscriptions/keywords/{id}** | SubscriptionDialog 的"删除订阅关键词"功能。 |

**补充说明**：订阅数据还用于 ArticleListPage 的"仅显示订阅内容"筛选功能。当用户开启此筛选时，ArticleListPage 调用 `GET /api/papers/subscribed`，后端根据订阅表进行筛选。

---

### 5.5 历史记录接口（4 个）

这些接口主要服务于 **HistoryPage（历史页）**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/history/reading** | HistoryPage 的"阅读历史"标签页。展示用户的论文浏览、收藏、下载等操作记录。支持按日期范围、操作类型筛选。 |
| **GET /api/history/chat** | HistoryPage 的"对话历史"标签页。展示用户的 AI 对话会话记录。支持按日期范围、对话模式筛选。 |
| **POST /api/history/logs** | 其他页面的操作日志记录。当用户在 ArticleListPage 查看摘要、下载 PDF、收藏论文时，前端调用此接口记录操作。该接口也可由其他业务接口内部调用自动记录。 |
| **GET /api/history/reading/grouped** | HistoryPage 的"阅读历史"时间线展示模式。按日期分组返回历史记录，用于前端 Timeline 组件展示。 |

---

### 5.6 统计分析接口（3 个）

这些接口主要服务于 **StatsPage（统计页）** 和 **HomePage 右侧工具栏的 Stats 面板**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **GET /api/stats** | StatsPage 的核心数据接口。返回完整的统计数据，包括：今日/本周/本月阅读数、收藏总数、对话总数、月度热力图数据、阅读时间分布（按星期×小时）、领域分布饼图数据、关键词云数据。支持按日期范围筛选。 |
| **GET /api/stats/today** | HomePage 右侧工具栏的 Stats 面板。快速获取今日统计数据（今日阅读数、收藏数、对话数），用于摘要展示。 |
| **GET /api/stats/trend** | StatsPage 的"阅读趋势"图表数据。获取最近 N 天的阅读趋势折线图数据。 |

---

### 5.7 对话会话接口（5 个）

这些接口主要服务于 **HomePage（主页）的三种对话模式**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **POST /api/chat/sessions** | HomePage 开始新对话时调用。创建新的对话会话，指定对话模式（AI聊天、AI搜索推荐、章节总结）。章节总结模式还需要传递论文 ID 和标题。 |
| **GET /api/chat/sessions/{sessionId}/messages** | HomePage 加载历史对话时调用。获取指定会话的所有消息列表，用于恢复对话上下文。 |
| **POST /api/chat/sessions/{sessionId}/messages** | HomePage 发送用户消息的核心接口。接收用户消息和模型 ID，调用 LLM 生成回复，以 SSE 流式响应返回。同时将用户消息和 AI 回复存入数据库。 |
| **DELETE /api/chat/sessions/{sessionId}** | HomePage 删除对话会话。删除会话及其所有消息记录。 |
| **GET /api/chat/sessions** | HistoryPage 的对话历史列表和 HomePage 左侧会话列表。获取用户最近的对话会话，支持按模式筛选。返回会话标题、模式、关联论文、消息数量等。 |

**补充说明**：
- AI聊天模式：纯对话，不涉及论文数据
- AI搜索推荐模式：结合 `POST /api/papers/search`，LLM 分析用户意图后查询论文数据库
- 章节总结模式：需要先调用 `GET /api/papers/{articleId}` 获取论文信息，后端读取 PDF 内容后发送给 LLM 进行总结

---

### 5.8 Tauri Command 接口（8 个）

这些接口通过 Tauri Command 实现，主要服务于 **SettingsPage（设置页）**、**右边栏布局管理** 和 **爬虫系统**。

#### 5.8.1 应用设置接口（3 个）

服务于 **SettingsPage（设置页）**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **get_settings** | SettingsPage 打开时调用。读取 `settings.json`，返回爬虫配置、PDF 存储路径、LLM 配置（云端/本地模型 Provider 列表）、开机自启动设置、上次选择的模型 ID 等。 |
| **save_settings** | SettingsPage 保存设置时调用。将完整设置写入 `settings.json`，包括爬取领域、爬取频率、LLM Provider 的增删改、API Key 等敏感信息。 |
| **test_connection** | SettingsPage 的 LLM 配置区域的"测试连接"按钮。用户添加或编辑云端/本地模型 Provider 后，点击测试连接验证配置是否正确。云端服务向 `{endpoint}/models` 发送 HTTP 请求验证 API Key；本地服务向 `{endpoint}/api/tags` 发送请求验证服务可用性；MLX 类型检查本地模型文件路径是否存在。 |

#### 5.8.2 布局配置接口（2 个）

服务于 **RightToolbar（右边栏）**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **get_layout** | RightToolbar 初始化时调用。读取 `layout.json`，返回面板顺序、隐藏面板、展开面板等布局配置，用于恢复用户上次的面板排列状态。 |
| **save_layout** | RightToolbar 用户调整布局后自动调用。当用户拖拽面板改变顺序、点击隐藏/展开某个面板时，前端调用此接口保存布局配置到 `layout.json`。 |

#### 5.8.3 爬虫系统接口（3 个）

服务于 **SettingsPage（设置页）的爬虫设置区域** 和 **RightToolbar 的 Arxiv 面板**。

| 接口 | 对应界面功能 |
|-----|-------------|
| **trigger_crawl** | SettingsPage 的"手动爬取"按钮，或定时任务自动触发。读取 `settings.json` 中的爬取领域配置，调用 Arxiv API 获取最新论文，写入数据库，更新最后爬取时间，返回新增论文数量。 |
| **get_crawl_status** | SettingsPage 和 RightToolbar 的 Arxiv 面板展示爬取状态。返回最后爬取时间、总论文数、是否正在爬取、下次定时爬取时间。 |
| **schedule_crawl** | SettingsPage 的"自动爬取"开关和频率设置。用户开启自动爬取并设置间隔小时数后调用。更新 `settings.json` 中的爬取频率配置，同时启动或停止后台定时爬取任务。 |

---

## 六、前端调用的 API 与后端支持

以下功能使用 Tauri 内置 API 或前端处理，但后端仍需提供支持：

| 功能 | 实现方式 | 后端支持 | 对应界面功能 |
|-----|---------|---------|-------------|
| 选择文件夹路径 | Tauri Dialog API (`@tauri-apps/plugin-dialog`) | 无需后端支持，前端直接调用插件打开系统文件夹选择对话框，返回路径后写入 `settings.json`。 | SettingsPage 的 PDF 存储路径选择。 |
| 开机自启动 | Tauri Autostart API (`tauri-plugin-autostart`) | **需要后端支持**：应用启动时需同步 `settings.json` 的 `autoLaunch` 字段与系统自启动状态；用户在 SettingsPage 保存设置时，后端需检测 `autoLaunch` 字段变化并调用 Autostart API 启用/禁用。 | SettingsPage 的"开机自启动"开关。 |
| 学术领域列表 | 前端常量 `academicCategories` | 无需后端支持，领域列表在前端硬编码。 | SettingsPage 的爬虫设置区域，用户选择要爬取的 arXiv 领域。 |
| 主题模式设置 | localStorage | 无需后端支持，主题选择存储在前端 localStorage。 | SettingsPage 的外观设置区域，主题选择（跟随系统/浅色/深色）。 |

### 开机自启动的后端支持设计

开机自启动功能虽然使用 Tauri Autostart API，但后端需要提供以下支持：

**一、应用启动时同步状态**

当应用启动时，后端初始化流程的第五步会执行开机自启动状态同步：
- 读取 `settings.json` 中用户设置的 `autoLaunch` 字段（用户期望值）
- 通过 Tauri Autostart API 的 `isEnabled()` 查询系统当前的自启动状态
- 若两者不一致：
  - 若 `autoLaunch=true` 但系统未启用，调用 `enable()` 启用自启动
  - 若 `autoLaunch=false` 但系统已启用，调用 `disable()` 禁用自启动

这样可以保证用户设置与系统实际状态一致，避免用户手动修改了设置但未生效的情况。

**二、SettingsPage 保存设置时同步状态**

当用户在 SettingsPage 修改"开机自启动"开关并保存时：
- 前端调用 `save_settings` 将完整设置写入 `settings.json`
- 后端在保存完成后，检测 `autoLaunch` 字段是否发生变化
- 若发生变化，后端调用 Tauri Autostart API：
  - 若新值为 `true`，调用 `enable()` 启用自启动
  - 若新值为 `false`，调用 `disable()` 禁用自启动

**三、后端调用 Autostart API 的方式**

后端在 Rust 中调用 Autostart API 的方式有两种：
- 方式一：通过 Tauri 插件机制，在 Rust 中使用 `tauri-plugin-autostart` 的 Rust 接口
- 方式二：前端在保存设置后额外调用 Autostart API，但需要后端通知前端是否需要执行

推荐使用方式一，在后端统一处理自启动状态同步，保持逻辑一致性。

---

## 七、AI 对话模块架构

AI 对话是后端最复杂的模块，需要同时支持两种模型来源：

### 7.1 云端大模型交互

支持 OpenAI 格式的 API（包括 Claude、GPT、DeepSeek 等）。实现要点：

- 使用 HTTP 客户端发送请求到 `POST /v1/chat/completions` 端点
- 请求携带 API Key 认证，请求体包含模型名称和消息列表
- 响应采用 SSE（Server-Sent Events）流式格式，后端解析 `data: {...}` 行并转发给前端
- 连接测试通过 `GET /models` 端点验证 API Key 有效性

**与界面功能的关联**：
- HomePage 的三种对话模式都可能使用云端模型
- 用户在 SettingsPage 配置云端 Provider（endpoint、API Key、模型列表）
- `test_connection` 接口验证云端 Provider 配置

### 7.2 MLX 本地模型交互

MLX 是 Apple 专为 macOS 开发的机器学习框架，目前只有 Python 实现。Rust 无法直接调用，需采用 Sidecar 方案：

- Tauri Sidecar 启动独立的 Python 进程
- Python 进程加载 MLX 模型，监听 stdin 接收请求
- Rust 端通过 stdin 发送 JSON 格式的请求（包含模型路径、消息列表、最大 token 数）
- Python 进程调用 `mlx_lm.generate()` 生成响应，通过 stdout 返回 JSON 格式的流式输出
- Rust 端解析 stdout 流并转发给前端

**与界面功能的关联**：
- SettingsPage 配置本地 Provider 时，`type` 字段选择 `mlx`，`endpoint` 字段填写本地模型路径
- `test_connection` 接口检查 MLX 类型时验证模型路径是否存在
- HomePage 的三种对话模式选择 MLX Provider 时，后端启动 Sidecar 进行对话

### 7.3 Python Sidecar 打包与部署策略

**问题：用户无需配置 Python 环境**

由于不能要求用户自行配置 Python 环境，Python sidecar 需要打包为独立的可执行文件，随 Tauri 应用一起分发。

**一、打包方案**

将 Python 脚本打包为自包含的可执行文件，有以下方案：

| 方案 | 工具 | 说明 |
|-----|------|------|
| 方案 A | PyInstaller | 最常用，支持 macOS/Windows/Linux，生成独立可执行文件 |
| 方案 B | py2app | 仅 macOS，生成 .app 包 |
| 方案 C | shiv | 创建自包含 Python zipapp，需系统有 Python 解释器 |
| 方案 D | PyOxidizer | 将 Python 解释器嵌入可执行文件，单文件分发 |

**推荐方案 A（PyInstaller）**，理由：
- 跨平台支持（macOS/Windows/Linux）
- 生成独立可执行文件，无需用户安装 Python
- Tauri sidecar 配置支持外部二进制文件

**二、打包流程**

1. 在项目目录创建 `sidecars/` 文件夹，存放 Python 源码
2. 使用 PyInstaller 打包 Python 脚本：
   - macOS：`pyinstaller --onefile mlx_server.py --target-dir sidecars/binaries/`
   - Windows：`pyinstaller --onefile mlx_server.py --target-dir sidecars/binaries/`
   - Linux：`pyinstaller --onefile mlx_server.py --target-dir sidecars/binaries/`
3. 打包后的可执行文件命名遵循 Tauri sidecar 规范：
   - macOS：`mlx_server-x86_64-apple-darwin` 或 `mlx_server-aarch64-apple-darwin`
   - Windows：`mlx_server-x86_64-pc-windows-msvc.exe`
   - Linux：`mlx_server-x86_64-linux-gnu`

**三、打包后文件位置**

Tauri 打包后，sidecar 可执行文件位于应用包内部：
- **macOS**：位于 `.app` 包内的 `Resources/` 或 `Frameworks/` 目录，用户安装到 `/Applications/` 文件夹
- **Windows**：位于安装目录内的 `resources/` 子目录，用户安装到用户指定的文件夹
- **Linux**：位于安装目录内的 `resources/` 子目录，安装到默认路径（如 `/opt/research-dashboard/` 或用户主目录）

Rust 代码中通过 Tauri API 获取 sidecar 路径，无需硬编码路径，Tauri 会自动处理不同平台的路径差异。

**四、Tauri 配置**

在 `tauri.conf.json` 中配置 sidecar：

```json
{
  "bundle": {
    "externalBin": [
      "sidecars/binaries/mlx_server"
    ]
  }
}
```

**五、MLX 模型文件位置**

MLX 模型文件（如 `gemma-4-26b-a4b-it-4bit`）体积较大，不适合打包进应用：
- 用户首次使用 MLX 功能时，引导用户下载模型到指定目录（如 `~/Models/`）
- SettingsPage 配置 MLX Provider 时，用户指定本地模型路径
- 或提供模型下载功能，自动下载到 `~/.research_dashboard/models/` 目录

**六、用户安装流程**

用户安装应用时：
1. 下载对应平台的安装包（macOS .dmg/.app、Windows .exe/.msi、Linux .deb/.AppImage）
2. 安装到默认位置或用户指定位置
3. 应用已包含 Python sidecar 可执行文件，无需额外配置
4. 若需使用 MLX 本地模型，首次使用时引导下载模型文件

---

## 八、PDF 处理模块

章节总结模式需要读取论文 PDF 内容。根据论文来源不同，采用不同的处理策略：

### 8.1 Arxiv 论文的 PDF 处理

**不保存 PDF 到本地，临时下载读取后删除**

Arxiv 论文的 PDF 处理流程：
- 论文数据库中存储 `preprint_number`（arxiv 号，如 `2504.12345`）
- 当用户需要进行章节总结时，后端通过拼接 URL 临时下载 PDF：`https://arxiv.org/pdf/{preprint_number}.pdf`
- 下载到临时目录（如系统临时文件夹），读取并提取文本内容
- 将文本内容发送给 LLM 进行总结
- 总结完成后删除临时 PDF 文件

**设计理由**：
- Arxiv 论文数量庞大，保存所有 PDF 会占用大量存储空间
- Arxiv PDF URL 稳定可预测，无需持久化存储
- 临时下载的方式节省存储空间，同时保证访问时效性

### 8.2 非 Arxiv 论文的 PDF 处理

**需要本地保存 PDF**

当用户手动添加非 Arxiv 来源的论文（如会议论文、期刊论文）时：
- 用户需要上传或指定本地 PDF 文件
- 后端将 PDF 文件复制到 `~/.research_dashboard/pdfs/` 目录
- 数据库中存储 `pdf_path` 字段指向本地 PDF 文件路径
- 章节总结时直接读取本地 PDF 文件

**与界面功能的关联**：
- HomePage 的章节总结模式：用户选择论文后，后端根据论文来源判断处理方式
- 若是 Arxiv 论文，临时下载 PDF，总结后删除
- 若是非 Arxiv 论文，读取本地保存的 PDF 文件

### 8.3 PDF 文本提取实现方案

- 与 MLX sidecar 共用进程，在 Python 中使用 `pypdf` 提取文本
- 或使用 Rust 的 PDF 解析库独立实现

---

## 九、爬虫模块

定时或手动爬取 Arxiv 最新论文。

**重要说明：爬虫不调用 Arxiv API，而是直接爬取 arxiv.org 网站页面**

参考 `/Users/bowen/Code/PYTHON_PROJECT/arxiv_crawler_light` 的实现方式：

### 9.1 爬取流程

**第一步：获取论文列表页面**

访问 `https://arxiv.org/list/{subject}/recent` 获取指定领域的最近论文列表页面，例如：
- `https://arxiv.org/list/cs.AI/recent` - AI 领域最近论文
- `https://arxiv.org/list/cs.LG/recent` - 机器学习领域最近论文

分页获取，每页显示 50 篇论文，通过 `?skip={page*50}&show=50` 参数控制分页。

**第二步：解析列表页面获取论文链接**

解析 HTML 页面中的 `<dl><dt>` 标签，提取论文详情页链接（如 `/abs/2504.12345`）。

**第三步：访问论文详情页面并解析元数据**

访问每篇论文的详情页面（如 `https://arxiv.org/abs/2504.12345`），解析 HTML 获取：
- 标题：从 `<h1 class="title mathjax">` 标签提取
- 摘要：从 `<blockquote class="abstract mathjax">` 标签提取
- 作者：从 `<div class="authors">` 标签提取作者姓名和主页链接
- 提交日期：从 `<div class="submission-history">` 标签解析
- arxiv 号（preprint_number）：从 PDF 链接提取，如 `2504.12345`
- 领域：当前爬取的 subject

**第四步：日期过滤与去重**

- 检查论文提交日期，若连续 3 篇都是旧文章（早于上次爬取日期减 2 天）则停止该领域的爬取
- 写入数据库前检查 `preprint_number` 是否已存在，避免重复插入

**第五步：写入数据库**

将爬取到的论文数据写入 SQLite 数据库：
- `papers` 表存储论文基本信息
- `paper_authors` 表存储论文作者
- `paper_categories` 表存储论文所属领域

**第六步：更新 settings.json 中的上次爬取时间**

爬取完成后，更新 `settings.json` 的 `lastCrawlTime` 字段为当前时间（UTC+8 时区，格式 `YYYY-MM-DD HH:MM:SS`），用于：
- 判断是否已在当天爬取过（避免重复爬取）
- 前端展示最后爬取时间
- 定时爬取任务的调度判断

### 9.2 实现要点

- 使用 HTTP 客户端（如 `reqwest`）发送请求，设置合理的 User-Agent
- 使用 HTML 解析库（如 Rust 的 `scraper` crate）解析页面内容
- 每次请求后添加适当延迟（如 2 秒），避免对服务器造成压力
- 支持配置爬取领域列表（对应 arxiv 的 subject 分类，如 `cs.AI`、`cs.LG`）
- 支持定时爬取和手动触发爬取

### 9.3 定时爬取任务逻辑

**重要：Arxiv 在美东时间的周末不更新论文，因此需要跳过周末爬取**

定时爬取任务遵循以下逻辑：

**一、程序启动时立即爬取**

应用启动时，后台定时任务线程立即执行一次爬取（如果满足爬取条件）。

**二、每隔 4 小时检查是否需要爬取**

定时任务每隔 4 小时触发一次，但不是每次都执行爬取，而是先检查条件：

**三、周末跳过逻辑（按美东时间计算）**

判断是否跳过爬取的条件：
- 获取当前美东时间（Eastern Time，UTC-5 或 UTC-4 夏令时）
- 判断当前是否为周末（周六或周日）
- 若当前是周末，读取 `settings.json` 的 `lastCrawlTime`，转换为美东时间
- 若 `lastCrawlTime` 也在这个周末（同一个周六或周日），则**跳过本次爬取**
- 跳过后继续等待，4 小后再次检查

**跳过逻辑的原因**：
- Arxiv 在美东时间的周末不发布新论文
- 如果上次爬取已在这个周末进行，说明已获取该周末之前的最新论文
- 周末期间不会有新论文，无需重复爬取

**四、爬取条件判断流程**

```
定时任务触发（每4小时）
    │
    ▼
获取当前美东时间
    │
    ▼
当前是否为周末？
    │
    ├── 否 → 执行爬取
    │
    └── 是 → 获取 lastCrawlTime（转换为美东时间）
              │
              ▼
         lastCrawlTime 是否也在这个周末？
              │
              ├── 是 → 跳过本次爬取，等待下次触发
              │
              └── 否 → 执行爬取
```

**五、时间计算注意事项**

- 使用美东时间（Eastern Time）进行周末判断
- 美东时间 = UTC-5（标准时间）或 UTC-4（夏令时，3月中旬至11月初）
- 可使用 Rust 的 `chrono` crate 配合 `tz` 库处理时区转换
- 或简化处理：直接使用 UTC 时间，周末判断时减去 5 小时（忽略夏令时差异，误差在可接受范围）

**六、手动触发爬取不受周末限制**

用户在 SettingsPage 点击"手动爬取"按钮时，不受周末跳过逻辑限制，直接执行爬取。这样用户可以在需要时强制刷新数据。

### 9.4 数据存储

爬取的论文数据存入 SQLite 数据库：
- `papers` 表存储论文基本信息，包括 `preprint_number` 字段（用于拼接 PDF URL）
- `paper_authors` 表存储论文作者
- `paper_categories` 表存储论文所属领域

### 9.5 与界面功能的关联
- SettingsPage 配置爬取领域（通过 `crawlerCategories`，存储 subject 代码如 `cs.AI`）和频率（通过 `crawlIntervalHours`）
- `schedule_crawl` 接口启动/停止定时任务
- `trigger_crawl` 接口手动触发爬取
- ArticleListPage 的论文数据来源于爬虫抓取的结果

---

## 十、模块优先级建议

| 优先级 | 模块 | 原因 |
|-------|------|------|
| P0 | SQLite 数据库初始化 + 基础 CRUD 接口 | 核心功能，其他模块依赖数据存储 |
| P0 | 云端 LLM 对话接口 + test_connection | HomePage 核心功能，用户最常用 |
| P1 | MLX Sidecar 集成 | 本地模型支持，技术复杂度高 |
| P1 | PDF 处理（章节总结） | 章节总结模式依赖 |
| P2 | 爬虫系统 + schedule_crawl | 可先使用外部脚本导入数据 |
| P2 | 统计查询优化 | 数据量大时需优化聚合查询性能 |

---

## 十一、总结

本架构文档梳理了后端需实现的 **45 个接口**，并明确了每个接口对应的前端界面功能：

**数据库接口（37 个）**：
- 论文接口（6 个）支撑 ArticleListPage 列表、筛选、搜索和 HomePage AI 搜索推荐
- 收藏接口（9 个）支撑 FavoritesPage 的完整文件管理和论文收藏
- 订阅接口（7 个）支撑 SubscriptionDialog 和订阅筛选功能
- 历史接口（4 个）支撑 HistoryPage 的阅读/对话历史
- 统计接口（3 个）支撑 StatsPage 和右侧 Stats 面板
- 对话接口（5 个）支撑 HomePage 的三种 AI 对话模式
- 每日推荐接口（3 个）支撑 DailyPage 和右侧 Daily 面板

**Tauri Command 接口（8 个）**：
- 设置接口（3 个）支撑 SettingsPage 的应用设置、LLM 配置管理、连接测试
- 布局接口（2 个）支撑 RightToolbar 的面板排列状态持久化
- 爬虫接口（3 个）支撑 SettingsPage 的爬取配置和定时任务管理

关键技术挑战是 MLX 本地模型的集成，推荐采用 Tauri Sidecar 方案通过 Python 进程处理。

下一步应按优先级逐步实现各模块，建议从 P0 的数据库和云端 LLM 开始。