# StatsPage 接口需求文档

## 界面概述

StatsPage 展示用户阅读统计分析数据，包含：
- **统计卡片**：今日阅读数、本月阅读数、收藏总数、对话总数
- **月度热力图**：按日期展示阅读活跃度
- **阅读时间分布**：按星期×小时的二维热力图
- **领域分布图**：论文领域占比饼图
- **关键词云**：从论文标题提取高频词

支持按"最近30天"或"按月选择"两种模式筛选日期范围。

## 相关数据表

- `user_action_logs` - 用户操作日志表（主要数据源）
- `papers` - 论文表
- `paper_categories` - 论文领域表
- `favorite_papers` - 收藏表
- `chat_sessions` - 对话会话表

---

## 接口列表

### 1. 获取统计数据

**接口**: `GET /api/stats`

**描述**: 根据日期范围获取完整的统计数据

**查询参数**:
- `startDate`: `string` - 开始日期，格式 `YYYY-MM-DD`
- `endDate`: `string` - 结束日期，格式 `YYYY-MM-DD`

**响应**:
```json
{
  "readingStats": {
    "todayCount": number,
    "weekCount": number,
    "monthCount": number,
    "totalFavorites": number,
    "totalChats": number,
    "avgDailyCount": number
  },
  "hourlyDistribution": [
    { "hour": number, "count": number }
  ],
  "weeklyHourData": [
    { "day": "string", "dayIndex": number, "hour": number, "count": number }
  ],
  "dailyHourData": [
    { "date": "string", "hour": number, "count": number }
  ],
  "domainDistribution": [
    { "domain": "string", "count": number, "percentage": number }
  ],
  "keywords": [
    { "text": "string", "value": number }
  ],
  "heatmapData": [
    { "date": "string", "count": number, "level": number }
  ]
}
```

**数据库操作**:
```sql
-- 基础统计
SELECT COUNT(*) as today_count
FROM user_action_logs
WHERE DATE(created_at) = DATE('now');

SELECT COUNT(*) as week_count
FROM user_action_logs
WHERE created_at >= DATE('now', '-7 days');

SELECT COUNT(*) as month_count
FROM user_action_logs
WHERE created_at >= ? AND created_at <= ?;

SELECT COUNT(*) as total_favorites FROM favorite_papers;
SELECT COUNT(*) as total_chats FROM chat_sessions;

-- 热力图数据
SELECT DATE(created_at) as date, COUNT(*) as count
FROM user_action_logs
WHERE created_at >= ? AND created_at <= ?
GROUP BY DATE(created_at)
ORDER BY date;

-- 小时分布
SELECT strftime('%H', created_at) as hour, COUNT(*) as count
FROM user_action_logs
WHERE created_at >= ? AND created_at <= ?
GROUP BY hour;

-- 星期×小时分布
SELECT strftime('%w', created_at) as day_of_week,
       strftime('%H', created_at) as hour,
       COUNT(*) as count
FROM user_action_logs
WHERE created_at >= ? AND created_at <= ?
GROUP BY day_of_week, hour;

-- 领域分布
SELECT pc.category as domain, COUNT(*) as count
FROM user_action_logs l
JOIN papers p ON l.article_id = p.article_id
JOIN paper_categories pc ON p.article_id = pc.article_id
WHERE l.created_at >= ? AND l.created_at <= ?
GROUP BY pc.category
ORDER BY count DESC
LIMIT 10;

-- 关键词（从论文标题提取）
SELECT p.title
FROM user_action_logs l
JOIN papers p ON l.article_id = p.article_id
WHERE l.created_at >= ? AND l.created_at <= ?;
```

---

### 2. 获取今日统计

**接口**: `GET /api/stats/today`

**描述**: 快速获取今日统计数据，用于首页右侧工具栏

**响应**:
```json
{
  "todayCount": number,
  "favoriteCount": number,
  "chatCount": number
}
```

**数据库操作**:
```sql
SELECT COUNT(*) as today_count
FROM user_action_logs
WHERE DATE(created_at) = DATE('now');
```

---

### 3. 获取阅读趋势

**接口**: `GET /api/stats/trend`

**描述**: 获取最近N天的阅读趋势数据

**查询参数**:
- `days`: `number` - 天数，默认 30

**响应**:
```json
{
  "trend": [
    { "date": "string", "count": number }
  ]
}
```

**数据库操作**:
```sql
SELECT DATE(created_at) as date, COUNT(*) as count
FROM user_action_logs
WHERE created_at >= DATE('now', ? || ' days')
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## 补充说明

1. **计算逻辑**: 统计数据基于 `user_action_logs` 表，前端目前使用 mock 数据在客户端计算，后端应改为服务端计算
2. **关键词提取**: 后端需实现停用词过滤和词频统计，可考虑使用 SQLite FTS 或外部分词库
3. **level 字段**: 热力图的 `level` 字段(0-4)用于颜色等级，后端可根据 count 计算：`count=0→0, count≤2→1, count≤4→2, count≤6→3, count>6→4`
4. **性能优化**: 多个聚合查询可合并为单个接口返回，减少网络请求
5. **缓存策略**: 统计数据可适当缓存，因为历史数据的统计结果不会变化

