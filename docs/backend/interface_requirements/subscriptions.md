# 订阅系统接口需求文档

## 概述

订阅系统允许用户关注感兴趣的作者、领域和关键词，系统会根据订阅内容筛选推荐论文。三个订阅表相对独立，每个表都需要完整的 CRUD 接口。

## 相关数据表

- `subscribed_authors` - 订阅作者表
- `subscribed_categories` - 订阅领域表
- `subscribed_keywords` - 订阅关键词表

---

## 接口列表

### 1. 获取所有订阅

**接口**: `GET /api/subscriptions`

**描述**: 获取用户的所有订阅内容

**响应**:
```json
{
  "authors": [
    { "id": number, "authorName": "string", "createdAt": "string" }
  ],
  "categories": [
    { "id": number, "category": "string", "createdAt": "string" }
  ],
  "keywords": [
    { "id": number, "keyword": "string", "createdAt": "string" }
  ]
}
```

**数据库操作**:
```sql
SELECT * FROM subscribed_authors ORDER BY created_at DESC;
SELECT * FROM subscribed_categories ORDER BY created_at DESC;
SELECT * FROM subscribed_keywords ORDER BY created_at DESC;
```

---

### 2. 添加订阅作者

**接口**: `POST /api/subscriptions/authors`

**请求体**:
```json
{
  "authorName": "string"
}
```

**响应**:
```json
{
  "id": number,
  "authorName": "string",
  "createdAt": "string"
}
```

**数据库操作**:
```sql
INSERT INTO subscribed_authors (author_name) VALUES (?)
```

---

### 3. 删除订阅作者

**接口**: `DELETE /api/subscriptions/authors/{id}`

**响应**: `204 No Content`

**数据库操作**:
```sql
DELETE FROM subscribed_authors WHERE id = ?
```

---

### 4. 添加订阅领域

**接口**: `POST /api/subscriptions/categories`

**请求体**:
```json
{
  "category": "string"  // e.g., "cs.AI"
}
```

**响应**:
```json
{
  "id": number,
  "category": "string",
  "createdAt": "string"
}
```

**数据库操作**:
```sql
INSERT INTO subscribed_categories (category) VALUES (?)
```

---

### 5. 删除订阅领域

**接口**: `DELETE /api/subscriptions/categories/{id}`

**响应**: `204 No Content`

**数据库操作**:
```sql
DELETE FROM subscribed_categories WHERE id = ?
```

---

### 6. 添加订阅关键词

**接口**: `POST /api/subscriptions/keywords`

**请求体**:
```json
{
  "keyword": "string"
}
```

**响应**:
```json
{
  "id": number,
  "keyword": "string",
  "createdAt": "string"
}
```

**数据库操作**:
```sql
INSERT INTO subscribed_keywords (keyword) VALUES (?)
```

---

### 7. 删除订阅关键词

**接口**: `DELETE /api/subscriptions/keywords/{id}`

**响应**: `204 No Content`

**数据库操作**:
```sql
DELETE FROM subscribed_keywords WHERE id = ?
```

---

## 补充说明

1. **唯一约束**: 三个表都有 UNIQUE 约束，重复添加相同订阅会失败
2. **大小写处理**: 建议关键词存储为小写，方便忽略大小写匹配
3. **批量操作**: 如需批量添加/删除，可扩展批量接口
4. **前端使用**: 订阅数据用于 ArticleListPage 的"仅显示订阅内容"筛选功能

