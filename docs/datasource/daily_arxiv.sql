-- Delete database if exists
drop database if exists arxiv_tool;
create database arxiv_tool;
use arxiv_tool;

drop table if exists register_code;
drop table if exists starred_articles;
drop table if exists paper_comments;
drop table if exists arxiv_config;
drop table if exists crawled_subjects;
drop table if exists subscribed_topics;
drop table if exists arxiv_authors;
drop table if exists arxiv_subjects;
drop table if exists arxiv_articles;
drop table if exists subscribed_authors;
drop table if exists user_info;

create table user_info
(
    user_id    integer primary key auto_increment,
    username   varchar(63)  not null,
    password   varchar(255)  not null,
    email      varchar(255) not null,
    first_name varchar(63)  not null,
    last_name  varchar(63)  not null,
    -- 0:Student 1:Professor/Counselor/Admin
    position   int          not null default 0
);

create table arxiv_articles
(
    article_id      integer primary key auto_increment,
    title           varchar(255) not null,
    abstract_text        text         not null,
    submit_date     datetime,
    preprint_number varchar(255) not null
);

create table arxiv_subjects
(
    article_id int         not null,
    subject    varchar(32) not null,
    foreign key (article_id) references arxiv_articles (article_id)
);

create table arxiv_authors
(
    name          varchar(255) not null,
    article_id    int          not null,
    homepage_link varchar(255) not null,
    foreign key (article_id) references arxiv_articles (article_id)
);

create table subscribed_authors
(
    name          varchar(63)  not null,
    institute     varchar(255),
    homepage_link varchar(255),
    subscriber_id int          not null,
    foreign key (subscriber_id) references user_info (user_id)
);

create table subscribed_topics
(
    topic         varchar(127) not null,
    subscriber_id int          not null,
    foreign key (subscriber_id) references user_info (user_id)
);

create table crawled_subjects
(
    subject varchar(127) not null
);

create table arxiv_config
(
    config_key   varchar(63) not null,
    config_value varchar(63) not null
);

create table starred_articles
(
    article_id int not null,
    user_id    int not null,
    foreign key (article_id) references arxiv_articles (article_id),
    foreign key (user_id) references user_info (user_id)
);

create table paper_comments
(
    comment_id integer primary key auto_increment,
    article_id integer not null,
    user_id    integer not null,
    comment    text    not null,
    foreign key (article_id) references arxiv_articles (article_id),
    foreign key (user_id) references user_info (user_id)
);

create table register_code
(
    code       varchar(63) not null unique
);

-- Insert relevant topics into crawled_subjects table
INSERT INTO crawled_subjects (subject)
VALUES ('cs.AI');
INSERT INTO crawled_subjects (subject)
VALUES ('cs.RO');
INSERT INTO crawled_subjects (subject)
VALUES ('cs.LG');
INSERT INTO crawled_subjects (subject)
VALUES ('cs.CV');
INSERT INTO crawled_subjects (subject)
VALUES ('cs.CL');
INSERT INTO arxiv_config (config_key, config_value)
VALUES ('last_run', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '%Y-%m-%d'));
INSERT INTO `user_info`
VALUES (1, 'caTom',
        '$2a$12$0oN/2m8EfQweo4zt/sy60.4QJMKgzRE8sKwb9yUIO8T3RtPaUBrIa',
        '2631702650@qq.com','Bowen', 'Deng', 1);