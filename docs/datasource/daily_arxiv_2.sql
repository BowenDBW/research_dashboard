use arxiv_tool;

drop table if exists chat_messages;
drop table if exists llm_chat_records;

create table llm_chat_records
(
    chat_id      integer primary key auto_increment,
    user_id      integer not null,
    chat_title   varchar(64) not null,
    create_time  datetime,
    foreign key (user_id) references user_info (user_id)
);

create table chat_messages
(
    message_id   integer primary key auto_increment,
    chat_id      integer not null,
    role         varchar(32) not null,
    content      text         not null,
    create_time  datetime,
    foreign key (chat_id) references llm_chat_records (chat_id)
);