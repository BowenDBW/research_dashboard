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
drop table if exists venue_rankings;
drop table if exists venues;

-- ==========================================
-- 刊会信息与分区系统 (Venues & Rankings)
-- ==========================================

-- 1. 刊会基本信息表
create table venues (
    venue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- 刊会名称（可能重复，如同名不同刊）
    abbreviation TEXT,               -- 简称/缩写（如 TOCS, CVPR）
    issn TEXT,                       -- ISSN（期刊唯一标识）
    eissn TEXT,                      -- 电子ISSN
    venue_type TEXT DEFAULT 'journal', -- journal/conference
    publisher TEXT,                  -- 出版社/主办方
    url TEXT                         -- 官网/DBLP链接
);

-- 创建索引加速查询
create index idx_venues_name on venues(name);
create index idx_venues_issn on venues(issn);
create index idx_venues_abbreviation on venues(abbreviation);

-- 2. 刊会分区排名表（一对多：一个刊会可隶属多个分区名单）
create table venue_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL,
    ranking_source TEXT NOT NULL,    -- ccf/jcr/sci/ssci
    ranking_category TEXT,           -- CCF: A/B/C, JCR: Q1/Q2/Q3/Q4, SCI/SSCI: 无分级但有收录
    ranking_year INTEGER,            -- 分区年份（如CCF 2022, JCR 2024）
    category_detail TEXT,            -- 详细分类（如CCF子领域、JCR学科、WoS Categories）
    UNIQUE(venue_id, ranking_source, ranking_year),
    foreign key (venue_id) references venues (venue_id) ON DELETE CASCADE
);

create index idx_rankings_venue on venue_rankings(venue_id);

-- ==========================================
-- 论文核心表 (Papers)
-- ==========================================

create table papers (
    article_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    abstract TEXT,
    publication_date TEXT,
    preprint_number TEXT,            -- arXiv号等预印本编号
    venue_id INTEGER,                -- 外键连接刊会表（替代原publication_venue）
    publication_link TEXT,           -- 论文链接
    pdf_link TEXT,                   -- PDF下载链接
    pdf_path TEXT,                   -- 本地PDF存储路径
    foreign key (venue_id) references venues (venue_id) ON DELETE SET NULL
);

-- ==========================================
-- 论文关联信息 (Authors & Categories)
-- ==========================================

create table paper_authors (
    article_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    author_order INTEGER NOT NULL,   -- 物理排印顺序（1, 2, 3...）
    PRIMARY KEY (article_id, author_order),
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

create table paper_categories (
    article_id INTEGER NOT NULL,
    category TEXT NOT NULL,          -- arXiv分类如 cs.AI, cs.LG
    PRIMARY KEY (article_id, category),
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

-- ==========================================
-- 收藏与虚拟文件夹系统 (Favorites)
-- ==========================================

create table favorite_folders (
    folder_id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,               -- 父文件夹ID，NULL表示根目录
    folder_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (parent_id) references favorite_folders (folder_id) ON DELETE CASCADE
);

create table favorite_papers (
    article_id INTEGER PRIMARY KEY,  -- 一篇文章只能放在一个文件夹
    folder_id INTEGER,               -- 所属文件夹ID，NULL表示根目录收藏
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE,
    foreign key (folder_id) references favorite_folders (folder_id) ON DELETE CASCADE
);

-- ==========================================
-- 订阅系统 (Subscriptions)
-- ==========================================

create table subscribed_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

create table subscribed_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,   -- 如 cs.AI, cs.LG
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

create table subscribed_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LLM 多轮对话记录系统 (Chat History)
-- ==========================================

create table chat_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    mode TEXT DEFAULT 'chat',        -- chat/paper_chat/paper_search
    article_id INTEGER,              -- NULL为通用对话，有值为带论文对话
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

create table chat_messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,              -- system/user/assistant
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (session_id) references chat_sessions (session_id) ON DELETE CASCADE
);

-- ==========================================
-- 用户操作日志 (User Action Logs)
-- ==========================================

create table user_action_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,       -- view_abstract/open_url/favorite/download
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);

-- ==========================================
-- 每日推荐 (Daily Recommendations)
-- ==========================================

create table daily_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    source TEXT DEFAULT 'google',    -- google/arxiv
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, source),
    foreign key (article_id) references papers (article_id) ON DELETE CASCADE
);