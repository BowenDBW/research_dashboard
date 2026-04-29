# ArticleListPage 接口需求文档

## 界面概述

ArticleListPage 是论文列表浏览和搜索页面，支持：
- **关键词搜索**：按作者/标题搜索
- **日期范围筛选**：按发布日期范围筛选
- **来源筛选**：按会议/期刊筛选（NeurIPS, ICML, ICLR, CVPR, ACL, EMNLP）
- **领域筛选**：按 arXiv 领域筛选
- **订阅筛选**：仅显示已订阅作者/领域的论文
- **分页显示**：支持多种每页数量选项

## 相关数据表

- `papers` - 论文表
- `paper_authors` - 论文作者表
- `paper_categories` - 论文领域表
- `favorite_papers` - 收藏表（用于判断 isFavorited）
- `subscribed_authors` - 订阅作者表
- `subscribed_categories` - 订阅领域表
- `subscribed_keywords` - 订阅关键词表

---

## 接口列表

### 1. 获取论文列表

**接口**: `GET /api/papers`

**描述**: 分页获取论文列表，支持多种筛选条件

**查询参数**:
- `page`: `number` - 页码，默认 1
- `pageSize`: `number` - 每页数量，默认 10
- `query`: `string | null` - 搜索关键词（匹配标题/作者）
- `startDate`: `string | null` - 开始日期
- `endDate`: `string | null` - 结束日期
- `sources`: `string` - 来源筛选，逗号分隔（NeurIPS,ICML,CVPR...）
- `domains`: `string` - 领域筛选，逗号分隔（cs.AI,cs.LG...）
- `subscribedOnly`: `boolean` - 是否仅显示订阅内容

**响应**:
```json
{
  "articles": [
    {
      "id": "string",
      "title": "string",
      "authors": ["string"],
      "source": "string",
      "sourceType": "string",
      "publishDate": "string",
      "abstract": "string",
      "url": "string",
      "pdfUrl": "string",
      "domains": ["string"],
      "isFavorited": boolean,
      "metadata": {}
    }
  ],
  "total": number,
  "page": number,
  "pageSize": number
}
```

**数据库操作**:
```sql
SELECT p.*, GROUP_CONCAT(pa.author_name) as authors, GROUP_CONCAT(pc.category) as domains
FROM papers p
LEFT JOIN paper_authors pa ON p.article_id = pa.article_id
LEFT JOIN paper_categories pc ON p.article_id = pc.article_id
WHERE (? IS NULL OR p.title LIKE ? OR pa.author_name LIKE ?)
  AND (? IS NULL OR p.publish_date >= ?)
  AND (? IS NULL OR p.publish_date <= ?)
  AND (? IS NULL OR p.source IN (?))
  AND (? IS NULL OR pc.category IN (?))
GROUP BY p.article_id
ORDER BY p.publish_date DESC
LIMIT ? OFFSET ?
```

---

### 2. 获取订阅论文列表

**接口**: `GET /api/papers/subscribed`

**描述**: 获取用户订阅的作者/领域/关键词相关的论文

**查询参数**:
- `page`: `number`
- `pageSize`: `number`

**响应**: 与获取论文列表相同

**数据库操作**:
```sql
SELECT DISTINCT p.*
FROM papers p
LEFT JOIN paper_authors pa ON p.article_id = pa.article_id
LEFT JOIN paper_categories pc ON p.article_id = pc.article_id
WHERE pa.author_name IN (SELECT author_name FROM subscribed_authors)
   OR pc.category IN (SELECT category FROM subscribed_categories)
   OR p.title LIKE '%' || (SELECT keyword FROM subscribed_keywords) || '%'
   OR p.abstract LIKE '%' || (SELECT keyword FROM subscribed_keywords) || '%'
ORDER BY p.publish_date DESC
LIMIT ? OFFSET ?
```

---

### 3. 获取论文详情

**接口**: `GET /api/papers/{articleId}`

**描述**: 获取单篇论文详细信息

**响应**:
```json
{
  "id": "string",
  "title": "string",
  "authors": ["string"],
  "source": "string",
  "sourceType": "string",
  "publishDate": "string",
  "abstract": "string",
  "url": "string",
  "pdfUrl": "string",
  "domains": ["string"],
  "isFavorited": boolean,
  "pdfPath": "string | null",
  "metadata": {}
}
```

---

### 4. 获取来源列表

**接口**: `GET /api/papers/sources`

**描述**: 获取所有可选的论文来源（会议/期刊）

**响应**:
```json
{
  "sources": ["string"]
}
```

**数据库操作**:
```sql
SELECT DISTINCT source FROM papers ORDER BY source
```

---

### 5. 获取领域列表

**接口**: `GET /api/papers/domains`

**描述**: 获取所有可选的论文领域

**响应**:
```json
{
  "domains": ["string"]
}
```

**数据库操作**:
```sql
SELECT DISTINCT category FROM paper_categories ORDER BY category
```

---

## 补充说明

1. **全文搜索**: 如果数据量大，建议配置 SQLite FTS5 实现高效全文搜索
2. **订阅筛选**: `subscribedOnly=true` 时需关联订阅表进行筛选
3. **收藏状态**: `isFavorited` 字段需要关联 `favorite_papers` 表判断
4. **来源类型**: `sourceType` 用于区分 arXiv、会议论文等不同类型
5. **分页优化**: 大数据量时考虑使用 cursor-based 分页代替 OFFSET

