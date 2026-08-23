
## Research Dashboard V0.1.3

### What's Changed 🚀
* **Google Alerts crawl window fixed (no more flooding old emails):**
    * The Gmail search window is now based on **where the data in the database stopped** (`MAX(created_at)` of existing Google recommendations), not the last sync time. The last sync time only decides whether a crawl runs at all.
    * First crawl after importing data no longer reaches back 90 days — it starts from today, so importing a big database no longer floods the daily report with months of old alerts.
* **Crawl results are sorted & deduplicated:**
    * Emails are now processed in chronological order (oldest first), so an article that appears in several alerts is attributed to its earliest appearance date.
    * Recommendations are guaranteed duplicate-free: existing `UNIQUE(article_id, source)` + `INSERT OR IGNORE`, plus in-run title dedup and a normalized (fuzzy) title match against the library to avoid creating duplicate papers.
* **Daily report now grouped by email with sub-headings:**
    * Opening a day shows articles grouped by the alert email they came from, with the **email title as a sub-heading** above each batch (e.g. "2 new related researches to John"), so you can see the author relationship at a glance.
    * Source emails are stored once in a dedicated table (linked by reference), so the email title is not duplicated across every article in a batch.
    * Existing Google recommendations were rebuilt once so the grouping applies to all your historical data.
* **Pagination fixes:**
    * The total count is now computed from the exact same grouping as the list, so page numbers always match the actual items (no more wrong totals / duplicate or missing pages).
    * The per-page selector now shows "N / page" instead of "N articles".
* **Storage paths are directories + confirm-to-move:**
    * The database & PDF storage path settings now show a **directory only** (no filename); the app appends `research_dashboard.db` / the `pdfs` folder itself.
    * Picking a folder no longer moves anything immediately — you click **"Confirm & Move"** and the app performs the transfer (DB via online `VACUUM INTO`, PDFs by moving files).
* **Reverted the 0.1.2 "Ollama 404" workaround:**
    * That 404 came from an incorrectly typed endpoint (e.g. missing `/v1`), not an app bug. The app no longer auto-appends `/v1` to the endpoint — the endpoint is used exactly as configured (Ollama should be `http://127.0.0.1:11434/v1`). The default/placeholder now shows the correct format.

---

### 更新日志 🚀
* **修复 Google 推荐爬取窗口（不再疯狂灌旧邮件）：**
    * Gmail 搜索窗口改为以**数据库里 google 推荐停在哪一天**（现有 google 推荐的 `MAX(created_at)`）为准，而不是上次同步时间；上次同步时间只决定是否触发爬取。
    * 导入数据后的首次爬取不再回溯 90 天，只从今天开始 —— 导入大数据后不会再把几个月前的旧推荐全部灌进每日推荐。
* **爬取结果按时间排序 + 去重：**
    * 邮件按发送时间升序处理，同一篇文章在多封 alert 里重复出现时归到它最早出现的那天。
    * 推荐保证不重复：保留 `UNIQUE(article_id, source)` + `INSERT OR IGNORE`，并新增批内标题去重与归一化（模糊）标题匹配，避免重复建档导致重复推荐。
* **每日推荐按邮件分组显示小标题：**
    * 点开某天，文章按来源邮件分组，每组上方显示**邮件标题作为小标题**（如 "2 new related researches to John"），一眼看出这批文章与作者的关系。
    * 来源邮件单独存一张表（外键关联），同一封邮件的标题等字段只存一份，不会随每篇文章重复。
    * 已对现有 Google 推荐做了一次重建回填，历史数据也能按邮件分组展示。
* **分页修复：**
    * 总数改为与列表完全相同的分组口径计算，页码与实际条目恒等（不再出现总数错、首末页重复或缺页）。
    * 每页选择器文案改为「N 条/页」，不再是「N 篇」。
* **存储路径只填目录 + 点确认才转移：**
    * 数据库与 PDF 存储路径设置只显示/填写**目录（不含文件名）**，文件名由应用自动补（`research_dashboard.db` / `pdfs` 文件夹）。
    * 选择文件夹后不会立即搬运，需点**「确认转移」**按钮，由应用执行转移（数据库在线 `VACUUM INTO` 复制，PDF 逐个移动文件）。
* **撤回 0.1.2 的「Ollama 404」修复：**
    * 那个 404 是用户 endpoint 填错导致的（比如漏了 `/v1`），不是应用 bug。应用不再自动给 endpoint 补 `/v1`，endpoint 按填写原样使用（Ollama 应填 `http://127.0.0.1:11434/v1`）。新建服务默认值与输入框占位符已改为正确格式。

---

## Research Dashboard V0.1.2

### What's Changed 🚀
* **High-performance SQL import:**
    * Rewrote the import pipeline: runs in a background thread (no more UI freeze / crash on large files).
    * Streams the file line-by-line instead of loading it all into memory (safe for multi-hundred-MB dumps).
    * Merges consecutive same-table `INSERT` statements into batched multi-row statements (~500 rows / statement), cutting SQLite prepare calls from ~1M to ~2k.
    * Added real-time import progress bar (percentage + MB + inserted row count).
    * Wraps the whole import in a transaction with automatic rollback on failure — no partial data left behind.
    * Measured on the real 1.07M-row merged dataset: **~20 seconds** (was ~17–20 minutes), ~55k rows/sec, no freeze.
* **Configurable database storage path:**
    * Settings can now change where the database file is stored. The app copies the current database to the new location (via online `VACUUM INTO`, no service interruption) and takes effect after restart.
* **Automatic legacy-schema migration for the papers table:**
    * Fixed all article-related pages showing empty / failing to load on databases created by v0.1.0 (which stored venues in a `publication_venue` text column instead of a `venue_id` foreign key).
    * The app now detects the old schema on startup / import and migrates it in place — numeric venue ids are carried over, venue names are matched against the venues table, and the old column is dropped. Idempotent and non-destructive.
* **Crawler time fixes:**
    * Fixed the last-crawl timestamp being written **8 hours ahead of real time** (the instant was shifted to +08:00 a second time inside the timestamp formatter). The timestamp is now recorded at the actual crawl completion moment.
    * If `lastCrawlTime` in settings is unexpectedly ahead of the current time (clock drift / legacy bad value), it is now treated as "never crawled" — otherwise the 5-minute anti-duplicate guard clamped the negative elapsed time to 0 and silently blocked every manual crawl, making the button flash to "crawling" and back.
    * Manual crawls that are skipped or fail now show a toast with the reason instead of silently reverting.
* **Single-instance enforcement:**
    * The app now runs as a single instance on all platforms. Launching it while an instance is already running focuses the existing window (restoring it from the system tray if hidden) instead of opening a second process — avoiding concurrent writes to the same SQLite database and duplicate scheduled crawlers.
* **Unified LLM provider configuration (MLX + port services):**
    * Removed the separate "cloud" and "local" provider sections. There are now just two simple categories: **MLX** (Apple Silicon local models) and **port services** (OpenAI-compatible endpoints — Ollama, OpenAI, DeepSeek, etc. are all configured the same way; no more local/cloud distinction).
    * Existing cloud/local provider configs are migrated automatically on startup: services from `cloudProviders` (e.g. Ollama) move into `portProviders`, MLX models into `mlxModels`, and the selected model is preserved.
* **Fixed Ollama returning 404:**
    * Chat requests to an endpoint like `http://127.0.0.1:11434` were sent to `/chat/completions`, which Ollama doesn't serve. The endpoint is now normalized to the OpenAI-compatible `/v1/...` base path (e.g. `/v1/chat/completions`, `/v1/models`), fixing both chat and connection testing.

---

### 更新日志 🚀
* **高性能 SQL 导入：**
    * 重写导入流程：后台线程执行，不再因大文件卡死/闪退。
    * 流式逐行读取，不再整文件读入内存（几百 MB 的 dump 也能安全导入）。
    * 连续同表的 INSERT 合并为批量多行语句（约 500 行/条），把 SQLite 的 prepare 次数从约 100 万次降到约 2 千次。
    * 新增实时导入进度条（百分比 + 已读 MB + 已插入行数）。
    * 全程事务包裹，失败自动回滚，不留半截数据。
    * 用真实 107 万行合并数据集实测：**约 20 秒**（原约 17–20 分钟），约 5.5 万行/秒，全程不卡顿。
* **可配置数据库存放路径：**
    * 设置中可更改数据库文件存放位置。应用会在线把当前数据库复制到新位置（`VACUUM INTO`，无需停机），重启后生效。
* **papers 表旧版结构自动迁移：**
    * 修复了 v0.1.0 创建的老库（用 `publication_venue` 文本列存刊会、而非 `venue_id` 外键）导致的所有文章相关页面空白/加载失败问题。
    * 应用启动/导入时自动检测旧结构并在原库就地迁移：数字刊会号直接结转、刊会名称匹配 venues 表换算、随后删除旧列。幂等且不破坏数据。
* **爬虫时间修复：**
    * 修复"上次爬取时间"比真实时间**超前 8 小时**的问题（时间戳在写入时被重复转了一次 +08:00 时区）。现在按爬取完成那一刻的真实时间记录。
    * 若 settings 中的 lastCrawlTime 异常超前于当前时间（时钟漂移 / 历史脏数据），按"从未爬取"处理——否则 5 分钟反重复保护会算出负的间隔（被截成 0）而永久拦截手动爬取，表现为点"立即爬取"按钮一闪而过、毫无进展。
    * 手动爬取被跳过 / 失败时，现在会弹出提示说明原因，而不是无声闪回。
* **单实例限制：**
    * 应用现在全平台单实例运行。已有实例在运行时再次启动，会聚焦已有窗口（若最小化到托盘则恢复显示），而不是新开一个进程——避免两个实例同时写同一个 SQLite 库、重复定时爬取。
* **统一大模型服务配置（MLX + 端口调用）：**
    * 去掉原先"云端 / 本地"两套配置，简化为两类：**MLX**（Apple Silicon 本地模型）与**端口调用**（OpenAI 兼容服务——Ollama、OpenAI、DeepSeek 等统一按端口服务配置，不再区分本地或云端）。
    * 启动时自动迁移旧配置：`cloudProviders` 里的服务（如 Ollama）并入 `portProviders`，MLX 模型并入 `mlxModels`，已选模型保持不变。
* **修复 Ollama 返回 404：**
    * 聊天请求原来会把 `http://127.0.0.1:11434` 这类 endpoint 拼成 `/chat/completions`（Ollama 不提供该地址，返回 404）。现在自动归一化为 OpenAI 兼容的 `/v1/...` 路径（`/v1/chat/completions`、`/v1/models`），聊天与测试连接均已修复。

---

## Research Dashboard V0.1.1

### What's Changed 🚀
* **Cross-Platform Background Persistence:**
    * Supported background system tray persistence across all major platforms (Windows, macOS, Linux).
    * Flexible window close behavior: users can now customize the close button action (minimize to tray vs. exit application).
* **Auto-Launch on Startup:**
    * Added system startup / auto-launch configuration support.

---

### 更新日志 🚀
* **全平台后台常驻：**
    * 支持 Windows、macOS 和 Linux 主流平台的系统托盘后台常驻。
    * 灵活的窗口关闭策略：用户可自定义点击关闭按钮时的行为（最小化至托盘或直接退出程序）。
* **开机自启动：**
    * 新增开机自动启动功能。



Research Dashboard V0.1.0
----------------------------------------

First release 🎉

A local-first desktop literature management and AI reading assistant for researchers, built with Tauri + React + Rust. Cross-platform: Windows / macOS / Linux.

Highlights:
- Paper library: multi-dimensional filtering, built-in CCF / JCR journal rankings, PDF reader
- AI assistant: chat, literature search & recommendation, chapter summaries — cloud models (Claude / GPT / DeepSeek) and local models (MLX / Ollama)
- Scheduled arXiv crawler: auto-fetch by subscribed fields, de-duplication, resume after interruption
- Daily recommendations: sync Google Scholar Alerts via Gmail automatically
- Subscriptions & favorites: multi-level folders, filter by subscribed authors
- Reading stats: heatmap, keyword cloud, trend charts
- Local-first data (SQLite), with .sql import / export for migration
----------------------------------------

首个正式版本 🎉

面向科研人员的本地文献管理与 AI 阅读助手，基于 Tauri + React + Rust 构建。跨平台：Windows / macOS / Linux。

主要亮点：
- 文献管理：文章库多维筛选、内置 CCF / JCR 期刊分级、PDF 阅读器
- AI 助手：聊天、文献搜索与推荐、章节总结 —— 支持云端模型（Claude / GPT / DeepSeek）与本地模型（MLX / Ollama）
- arXiv 定时爬虫：按订阅领域自动抓取、自动去重、断点续爬
- 每日推荐：通过 Gmail 自动同步 Google Scholar Alert 论文
- 订阅与收藏：多级收藏夹、按订阅作者筛选
- 阅读统计：热力图、关键词云、趋势图表
- 数据本地存储（SQLite），支持 .sql 导入导出迁移

