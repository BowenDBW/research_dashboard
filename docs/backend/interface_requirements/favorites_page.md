# FavoritesPage 接口需求文档

## 界面概述

FavoritesPage 是收藏夹管理界面，支持：
- 树形文件夹结构浏览
- 文件夹 CRUD（创建、重命名、删除）
- 文件夹剪切/粘贴操作
- 收藏论文的查看和取消收藏
- 面包屑导航

## 相关数据表

- `favorite_folders` - 收藏文件夹表（树形结构）
- `favorite_papers` - 收藏论文表
- `papers` - 论文表
- `paper_authors` - 论文作者表
- `paper_categories` - 论文领域表

---

## 接口列表

### 1. 获取文件夹内容

**接口**: `GET /api/favorites/folders/{folderId}/contents`

**描述**: 获取指定文件夹下的子文件夹和收藏论文

**路径参数**:
- `folderId`: 文件夹ID，`root` 表示根目录

**响应**:
```json
{
  "folders": [
    {
      "id": "string",
      "name": "string",
      "parentId": "string | null",
      "createdAt": "string"
    }
  ],
  "papers": [
    {
      "id": "string",
      "favoriteId": "string",
      "article": {
        "id": "string",
        "title": "string",
        "authors": ["string"],
        "source": "string",
        "publishDate": "string",
        "abstract": "string",
        "url": "string",
        "pdfUrl": "string",
        "domains": ["string"],
        "isFavorited": true
      },
      "createdAt": "string"
    }
  ],
  "path": [
    { "id": null, "name": "根目录" },
    { "id": "string", "name": "文件夹名" }
  ]
}
```

**数据库操作**:
```sql
-- 获取子文件夹
SELECT folder_id as id, folder_name as name, parent_id, created_at
FROM favorite_folders
WHERE parent_id IS ? OR (? IS NULL AND parent_id IS NULL)

-- 获取收藏论文
SELECT fp.article_id, fp.folder_id, p.*, GROUP_CONCAT(pa.author_name) as authors
FROM favorite_papers fp
JOIN papers p ON fp.article_id = p.article_id
LEFT JOIN paper_authors pa ON p.article_id = pa.article_id
WHERE fp.folder_id IS ? OR (? IS NULL AND fp.folder_id IS NULL)
GROUP BY p.article_id
```

---

### 2. 创建文件夹

**接口**: `POST /api/favorites/folders`

**描述**: 在指定位置创建新文件夹

**请求体**:
```json
{
  "name": "string",
  "parentId": "string | null"  // null 表示根目录
}
```

**响应**:
```json
{
  "id": "string",
  "name": "string",
  "parentId": "string | null",
  "createdAt": "string"
}
```

**数据库操作**:
```sql
INSERT INTO favorite_folders (parent_id, folder_name)
VALUES (?, ?)
```

---

### 3. 重命名文件夹

**接口**: `PATCH /api/favorites/folders/{folderId}`

**描述**: 重命名文件夹

**请求体**:
```json
{
  "name": "string"
}
```

**响应**: `200 OK`

**数据库操作**:
```sql
UPDATE favorite_folders SET folder_name = ? WHERE folder_id = ?
```

---

### 4. 删除文件夹

**接口**: `DELETE /api/favorites/folders/{folderId}`

**描述**: 删除文件夹及其所有子内容（级联删除）

**响应**: `204 No Content`

**数据库操作**:
```sql
DELETE FROM favorite_folders WHERE folder_id = ?
-- 外键 ON DELETE CASCADE 会自动删除子文件夹和收藏
```

---

### 5. 移动文件夹（剪切/粘贴）

**接口**: `PATCH /api/favorites/folders/{folderId}/move`

**描述**: 将文件夹移动到新位置

**请求体**:
```json
{
  "newParentId": "string | null"  // null 表示移动到根目录
}
```

**响应**: `200 OK`

**数据库操作**:
```sql
UPDATE favorite_folders SET parent_id = ? WHERE folder_id = ?
```

---

### 6. 添加收藏

**接口**: `POST /api/favorites/papers`

**描述**: 收藏一篇论文

**请求体**:
```json
{
  "articleId": "string",
  "folderId": "string | null"  // null 表示收藏到根目录
}
```

**响应**:
```json
{
  "id": "string",
  "articleId": "string",
  "folderId": "string | null",
  "createdAt": "string"
}
```

**数据库操作**:
```sql
INSERT INTO favorite_papers (article_id, folder_id)
VALUES (?, ?)
```

---

### 7. 取消收藏

**接口**: `DELETE /api/favorites/papers/{articleId}`

**描述**: 取消收藏指定论文

**响应**: `204 No Content`

**数据库操作**:
```sql
DELETE FROM favorite_papers WHERE article_id = ?
```

---

### 8. 移动收藏（剪切/粘贴）

**接口**: `PATCH /api/favorites/papers/{articleId}/move`

**描述**: 将收藏的论文移动到另一个文件夹

**请求体**:
```json
{
  "newFolderId": "string | null"
}
```

**响应**: `200 OK`

**数据库操作**:
```sql
UPDATE favorite_papers SET folder_id = ? WHERE article_id = ?
```

---

### 9. 获取文件夹路径（面包屑）

**接口**: `GET /api/favorites/folders/{folderId}/path`

**描述**: 获取从根目录到指定文件夹的路径，用于面包屑导航

**响应**:
```json
{
  "path": [
    { "id": null, "name": "根目录" },
    { "id": "string", "name": "父文件夹" },
    { "id": "string", "name": "当前文件夹" }
  ]
}
```

**数据库操作**: 递归查询父文件夹链
```sql
WITH RECURSIVE path AS (
  SELECT folder_id, folder_name, parent_id
  FROM favorite_folders
  WHERE folder_id = ?
  UNION ALL
  SELECT f.folder_id, f.folder_name, f.parent_id
  FROM favorite_folders f
  JOIN path p ON f.folder_id = p.parent_id
)
SELECT * FROM path ORDER BY folder_id
```

---

## 补充说明

1. **树形结构**: 使用 `parent_id` 实现邻接表模型，支持无限层级
2. **级联删除**: 数据库外键已配置 `ON DELETE CASCADE`，删除文件夹时自动删除子文件夹和收藏
3. **唯一约束**: `favorite_papers` 表以 `article_id` 为主键，一篇论文只能收藏在一个位置
4. **剪切/粘贴**: 前端通过状态管理实现剪贴板，调用移动接口完成粘贴
