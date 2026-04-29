drop table if exists daily_recommendations;
drop table if exists user_action_logs;
drop table if exists chat_messages;
drop table if exists chat_sessions;
drop table if exists subscribed_keywords;
drop table if exists subscribed_categories;
drop table if exists subscribed_authors;
drop table if exists favorite_papers;
drop table if exists favorite_folders;
drop table if exists paper_authors;
drop table if exists paper_categories;
drop table if exists papers;

create table papers (
    article_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT  NOT NULL,
    abstract TEXT,
    publication_date TEXT,
    preprint_number TEXT,
    publication_venue TEXT,
    publication_link TEXT,
    pdf_link TEXT,
    pdf_path TEXT
);

create table paper_authors
(
    article_id   INTEGER NOT NULL,
    author_name  TEXT NOT NULL,
    author_order INTEGER NOT NULL, -- 物理排印的先后顺序（1, 2, 3...）
    PRIMARY KEY (article_id, author_order),
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

create table paper_categories
(
    article_id INTEGER NOT NULL,
    category   TEXT NOT NULL,
    PRIMARY KEY (article_id, category),
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

-- ==========================================
-- 收藏与虚拟文件夹系统 (Adjacency List 树形结构)
-- ==========================================

-- 1. 文件夹表
create table favorite_folders (
    folder_id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,         -- 父文件夹的ID。如果为 NULL，代表在根目录
    folder_name TEXT NOT NULL, -- 文件夹名称
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (parent_id) references favorite_folders (folder_id) ON DELETE CASCADE
);

-- 2. 收藏论文表（文件实体）
create table favorite_papers (
    article_id INTEGER PRIMARY KEY, -- 如果一篇文章只能放在一个文件夹（剪贴逻辑），用 article_id 做主键。如果支持多路径引用，可用 (article_id, folder_id)
    folder_id INTEGER,              -- 所属文件夹ID。如果为 NULL，代表直接收藏在根目录
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE,
    foreign key (folder_id) references favorite_folders (folder_id) ON DELETE CASCADE
);

-- ==========================================
-- 订阅系统 (Subscriptions)
-- ==========================================

-- 1. 订阅的作者
create table subscribed_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL UNIQUE, -- 作者名字。使用 UNIQUE 防止用户重复订阅同一个人
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. 订阅的领域（仅二级领域）
create table subscribed_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,    -- 存储常量文件中的二级字段标识（如 "cs.AI"），UNIQUE 防止重复订阅
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. 订阅的关键词
create table subscribed_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,     -- 用户订阅的关键词（建议存储为全小写以方便忽略大小写查询）
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LLM 多轮对话记录系统 (Chat History)
-- ==========================================

-- 1. 对话会话表 (Session)
create table chat_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,             -- 对话标题（前端可以根据第一句话抽取，或显示"与某论文的对话"）
    article_id INTEGER,     -- 核心区分点：为 NULL 代表“通用不带论文对话”；有值代表“带论文的对话”
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);
-- 💡 设计说明 (Backend Logic):
-- 针对“带论文”的对话，表中强制【只保留 article_id】而不存储大段的论文纯文本。
-- 后端在组装发送给大模型的上下文时，需自行通过此 article_id 去 papers 表或本地文件系统读取摘要或长文本，
-- 在内存中转换为 prompt 后喂给 LLM，确保数据库绝对轻量级。

-- 2. 对话消息明细表 (Messages)
create table chat_messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,     -- 角色标识：通常为 'system', 'user', 'assistant'
    content TEXT NOT NULL,  -- 具体的对话文本
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (session_id) references chat_sessions (session_id) ON DELETE CASCADE
);

-- ==========================================
-- 用户操作日志 (User Action / History Logs)
-- ==========================================

-- 记录用户的核心操作历史（可用于生成“最近浏览”或统计用户习惯）
create table user_action_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 操作类型常量，建议值：'view_abstract' (看摘要), 'open_url' (点开源网址), 'favorite' (收藏), 'open_pdf' (看PDF)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

-- ==========================================
-- 每日推荐 (Daily Recommendations)
-- ==========================================

-- 存储外部（如 Google Scholar, arXiv 等）每日推荐的论文流
create table daily_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    source TEXT DEFAULT 'google',      -- 推荐来源（默认 'google'，备用扩展如 'arxiv'）
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, source), -- 防止同一天同一来源重复推荐相同的论文
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);
