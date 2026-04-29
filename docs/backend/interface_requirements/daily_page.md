# DailyPage 接口需求文档

## 界面概述

DailyPage 展示每日推荐论文列表，支持：
- 按月份筛选推荐
- 分页显示推荐列表
- 点击查看推荐详情（弹窗展示论文列表）

## 相关数据表

- `daily_recommendations` - 每日推荐表
- `papers` - 论文表
- `paper_authors` - 论文作者表
- `paper_categories` - 论文领域表
- `favorite_papers` - 收藏表（用于判断 isFavorited）

---

## 接口列表

### 1. 获取每日推荐列表

**接口**: `GET /api/daily-recommendations`

**描述**: 分页获取每日推荐列表

**查询参数**:
- `page`: `number` - 页码，默认 1
- `pageSize`: `number` - 每页数量，默认 5
- `month`: `string | null` - 按月份筛选，格式 `YYYY-MM`

**响应**:
```json
{
  "items": [
    {
      "id": "string",
      "date": "string",  // YYYY-MM-DD
      "articleCount": number
    }
  ],
  "total": number,
  "page": number,
  "pageSize": number
}
```

**数据库操作**:
```sql
SELECT
  id,
  DATE(created_at) as date,
  COUNT(*) as article_count
FROM daily_recommendations
WHERE source = 'google'
  AND (? IS NULL OR strftime('%Y-%m', created_at) = ?)
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT ? OFFSET ?
```

---

### 2. 获取推荐详情

**接口**: `GET /api/daily-recommendations/{recommendationId}`

**描述**: 获取指定日期的推荐论文详情

**响应**:
```json
{
  "id": "string",
  "date": "string",
  "articleCount": number,
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
  "createdAt": "string",
  "updatedAt": "string"
}
```

**数据库操作**:
```sql
-- 获取推荐中的论文
SELECT p.*, GROUP_CONCAT(pa.author_name) as authors, GROUP_CONCAT(pc.category) as domains
FROM daily_recommendations dr
JOIN papers p ON dr.article_id = p.article_id
LEFT JOIN paper_authors pa ON p.article_id = pa.article_id
LEFT JOIN paper_categories pc ON p.article_id = pc.article_id
WHERE dr.id = ?
GROUP BY p.article_id
```

---

### 3. 获取最近推荐（用于右侧工具栏）

**接口**: `GET /api/daily-recommendations/recent`

**描述**: 获取最近几天的推荐摘要，用于首页右侧工具栏展示

**查询参数**:
- `limit`: `number` - 返回数量，默认 5

**响应**:
```json
{
  "items": [
    {
      "id": "string",
      "date": "string",
      "articleCount": number
    }
  ]
}
```

**数据库操作**:
```sql
SELECT id, DATE(created_at) as date, COUNT(*) as article_count
FROM daily_recommendations
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT ?
```

---

## 补充说明

1. **数据来源**: 每日推荐由爬虫系统自动抓取入库，此界面只做展示
2. **收藏状态**: `isFavorited` 需要关联 `favorite_papers` 表判断
3. **来源区分**: 当前默认 `source = 'google'`，未来可扩展支持 arXiv 等其他来源
