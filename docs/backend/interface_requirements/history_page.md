# HistoryPage 接口需求文档

## 界面概述

HistoryPage 展示用户操作历史，包含两种模式：
- **阅读历史**：展示论文浏览、收藏、下载等操作记录
- **对话历史**：展示 AI 对话会话记录

支持按日期范围、操作类型、对话模式筛选。

## 相关数据表

- `user_action_logs` - 用户操作日志表
- `chat_sessions` - 对话会话表
- `chat_messages` - 对话消息表
- `papers` - 论文表
- `paper_authors` - 论文作者表

---

## 接口列表

### 1. 获取阅读历史

**接口**: `GET /api/history/reading`

**描述**: 分页获取阅读历史记录

**查询参数**:
- `page`: `number` - 页码
- `pageSize`: `number` - 每页数量
- `startDate`: `string | null` - 开始日期
- `endDate`: `string | null` - 结束日期
- `actions`: `string` - 操作类型筛选，逗号分隔（view_abstract,view_source,favorite,download）

**响应**:
```json
{
  "records": [
    {
      "id": "string",
      "articleId": "string",
      "action": "view_abstract" | "view_source" | "favorite" | "download",
      "timestamp": "string",
      "article": {
        "id": "string",
        "title": "string",
        "authors": ["string"],
        "source": "string",
        "url": "string",
        "pdfUrl": "string",
        "domains": ["string"],
        "isFavorited": boolean
      }
    }
  ],
  "total": number,
  "page": number,
  "pageSize": number
}
```

**数据库操作**:
```sql
SELECT l.log_id as id, l.article_id, l.action_type as action, l.created_at as timestamp,
       p.*, GROUP_CONCAT(pa.author_name) as authors, GROUP_CONCAT(pc.category) as domains
FROM user_action_logs l
JOIN papers p ON l.article_id = p.article_id
LEFT JOIN paper_authors pa ON p.article_id = pa.article_id
LEFT JOIN paper_categories pc ON p.article_id = pc.article_id
WHERE (? IS NULL OR l.created_at >= ?)
  AND (? IS NULL OR l.created_at <= ?)
  AND (? IS NULL OR l.action_type IN (?))
GROUP BY l.log_id
ORDER BY l.created_at DESC
LIMIT ? OFFSET ?
```

---

### 2. 获取对话历史

**接口**: `GET /api/history/chat`

**描述**: 分页获取对话历史记录

**查询参数**:
- `page`: `number` - 页码
- `pageSize`: `number` - 每页数量
- `startDate`: `string | null` - 开始日期
- `endDate`: `string | null` - 结束日期
- `modes`: `string` - 对话模式筛选，逗号分隔（chat,paper_search,chapter_summary）

**响应**:
```json
{
  "records": [
    {
      "id": "string",
      "title": "string",
      "mode": "chat" | "paper_search" | "chapter_summary",
      "articleId": "string | null",
      "articleTitle": "string | null",
      "timestamp": "string",
      "messageCount": number
    }
  ],
  "total": number,
  "page": number,
  "pageSize": number
}
```

**数据库操作**:
```sql
SELECT s.session_id as id, s.title, s.mode, s.article_id, s.article_title,
       s.updated_at as timestamp, COUNT(m.message_id) as message_count
FROM chat_sessions s
LEFT JOIN chat_messages m ON s.session_id = m.session_id
WHERE (? IS NULL OR s.updated_at >= ?)
  AND (? IS NULL OR s.updated_at <= ?)
  AND (? IS NULL OR s.mode IN (?))
GROUP BY s.session_id
ORDER BY s.updated_at DESC
LIMIT ? OFFSET ?
```

---

### 3. 记录用户操作

**接口**: `POST /api/history/logs`

**描述**: 记录用户的操作日志（由其他接口内部调用，或前端显式调用）

**请求体**:
```json
{
  "articleId": "string",
  "actionType": "view_abstract" | "view_source" | "favorite" | "download"
}
```

**响应**: `201 Created`

**数据库操作**:
```sql
INSERT INTO user_action_logs (article_id, action_type)
VALUES (?, ?)
```

---

### 4. 按日期分组获取阅读历史

**接口**: `GET /api/history/reading/grouped`

**描述**: 按日期分组获取阅读历史（用于时间线展示）

**查询参数**:
- `startDate`: `string | null`
- `endDate`: `string | null`
- `actions`: `string | null`

**响应**:
```json
{
  "groups": [
    {
      "date": "string",  // YYYY-MM-DD
      "records": [
        {
          "id": "string",
          "articleId": "string",
          "action": "string",
          "timestamp": "string",
          "article": { /* Article */ }
        }
      ]
    }
  ]
}
```

**数据库操作**: 与获取阅读历史相同，前端分组或后端分组均可

---

## 补充说明

1. **操作类型**: 当前支持 `view_abstract`, `view_source`, `favorite`, `download`
2. **对话历史**: 复用 `chat_sessions` 表，按 `updated_at` 排序展示最近对话
3. **时间线展示**: 前端实现按日期分组的 Timeline 组件
4. **操作记录触发**: 操作日志应在相关业务接口中自动记录（如查看摘要、下载PDF时）
