# HomePage 接口需求文档

## 界面概述

HomePage 是主界面，包含三种对话模式：
- **AI聊天** (chat)：通用AI对话
- **AI搜索推荐** (paper_search)：根据关键词搜索论文
- **章节总结** (chapter_summary)：对选定论文进行章节级总结

## 相关数据表

- `chat_sessions` - 对话会话表
- `chat_messages` - 对话消息表
- `papers` - 论文表（用于 chapter_summary 关联）

---

## 接口列表

### 1. 创建对话会话

**接口**: `POST /api/chat/sessions`

**描述**: 创建新的对话会话

**请求体**:
```json
{
  "mode": "chat" | "paper_search" | "chapter_summary",
  "articleId": "string | null",  // 仅 chapter_summary 模式需要
  "articleTitle": "string | null"  // 仅 chapter_summary 模式需要
}
```

**响应**:
```json
{
  "id": "string",
  "title": "string",
  "mode": "string",
  "articleId": "string | null",
  "articleTitle": "string | null",
  "createdAt": "string",
  "updatedAt": "string"
}
```

**数据库操作**: `INSERT INTO chat_sessions`

---

### 2. 获取会话消息列表

**接口**: `GET /api/chat/sessions/{sessionId}/messages`

**描述**: 获取指定会话的所有消息

**响应**:
```json
{
  "messages": [
    {
      "id": "string",
      "sessionId": "string",
      "role": "user" | "assistant",
      "content": "string",
      "timestamp": "string"
    }
  ]
}
```

**数据库操作**: `SELECT * FROM chat_messages WHERE session_id = ?`

---

### 3. 发送消息（AI对话）

**接口**: `POST /api/chat/sessions/{sessionId}/messages`

**描述**: 发送用户消息并获取AI回复（流式响应）

**请求体**:
```json
{
  "content": "string",
  "modelId": "string"  // 当前选择的模型ID
}
```

**响应**: SSE 流式响应
```
data: {"type": "token", "content": "..."}
data: {"type": "done", "messageId": "string"}
```

**数据库操作**:
- `INSERT INTO chat_messages` (user message)
- `INSERT INTO chat_messages` (assistant message)
- `UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?`

---

### 4. 获取论文详情（用于章节总结）

**接口**: `GET /api/papers/{articleId}`

**描述**: 获取论文详细信息，用于章节总结模式加载论文内容

**响应**:
```json
{
  "id": "string",
  "title": "string",
  "authors": ["string"],
  "abstract": "string",
  "pdfPath": "string | null",
  "pdfUrl": "string | null"
}
```

**数据库操作**: `SELECT * FROM papers WHERE article_id = ?`

---

### 5. 搜索论文（用于AI搜索推荐模式）

**接口**: `POST /api/papers/search`

**描述**: 根据关键词和日期范围搜索论文

**请求体**:
```json
{
  "query": "string",
  "startDate": "string | null",
  "endDate": "string | null",
  "modelId": "string"
}
```

**响应**:
```json
{
  "articles": [
    {
      "id": "string",
      "title": "string",
      "authors": ["string"],
      "source": "string",
      "publishDate": "string",
      "abstract": "string",
      "url": "string",
      "pdfUrl": "string",
      "domains": ["string"],
      "isFavorited": boolean
    }
  ],
  "explanation": "string"  // AI对搜索结果的解释说明
}
```

**数据库操作**:
- 全文搜索 `papers` 表（需配置 FTS）
- 关联 `paper_authors`, `paper_categories`

---

### 6. 删除对话会话

**接口**: `DELETE /api/chat/sessions/{sessionId}`

**描述**: 删除指定会话及其所有消息

**响应**: `204 No Content`

**数据库操作**: `DELETE FROM chat_sessions WHERE session_id = ?`（级联删除 messages）

---

### 7. 获取最近会话列表

**接口**: `GET /api/chat/sessions`

**描述**: 获取用户最近的对话会话列表（用于历史页面跳转）

**查询参数**:
- `mode`: `string | null` - 按模式筛选
- `limit`: `number` - 返回数量，默认 20

**响应**:
```json
{
  "sessions": [
    {
      "id": "string",
      "title": "string",
      "mode": "string",
      "articleId": "string | null",
      "articleTitle": "string | null",
      "createdAt": "string",
      "updatedAt": "string",
      "messageCount": number
    }
  ]
}
```

**数据库操作**:
```sql
SELECT s.*, COUNT(m.message_id) as message_count
FROM chat_sessions s
LEFT JOIN chat_messages m ON s.session_id = m.session_id
GROUP BY s.session_id
ORDER BY s.updated_at DESC
LIMIT ?
```

---

## 补充说明

1. **模型选择**: 前端从 SettingsStore 获取可用模型列表，在发送消息时传递 modelId
2. **流式响应**: AI对话应使用 SSE (Server-Sent Events) 实现流式输出
3. **论文内容加载**: 章节总结模式需要后端读取论文 PDF 内容，拼接为 prompt 发送给 LLM
