# 收藏夹页面设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  ← 收藏夹                                                    │
├──────────────────────────────────────────────────────────────┤
│  全部收藏 > 机器学习 > Transformer                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 📁 NLP       │  │ 📁 CV        │  │ 📄 Attention │       │
│  │   3 篇       │  │   5 篇       │  │   Is All...  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 📄 BERT      │  │ 📄 GPT-4     │  │ 📄 ViT       │       │
│  │ Pre-train... │  │ Technical... │  │ Vision Tr... │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 2. 文件夹导航

### 2.1 面包屑导航

```typescript
<Breadcrumbs>
  <Link onClick={() => navigate('/favorites')}>全部收藏</Link>
  {folderPath.map((folder, index) => (
    <Link key={folder.id} onClick={() => navigate(`/favorites/${folder.id}`)}>
      {folder.name}
    </Link>
  ))}
</Breadcrumbs>
```

### 2.2 文件夹路径

通过 URL 参数传递当前文件夹 ID：

```
/favorites           # 根目录
/favorites/folder-1  # folder-1 文件夹
/favorites/folder-2  # folder-2 文件夹
```

## 3. 收藏项展示

### 3.1 文件夹卡片

```typescript
<Card sx={{ cursor: 'pointer' }}>
  <CardContent sx={{ textAlign: 'center' }}>
    <FolderIcon sx={{ fontSize: 48, color: '#FFA726' }} />
    <Typography variant="subtitle1">{folder.name}</Typography>
    <Typography variant="body2" color="text.secondary">
      {folder.children?.length || 0} 项
    </Typography>
  </CardContent>
</Card>
```

### 3.2 文章卡片

```typescript
<Card sx={{ cursor: 'pointer' }}>
  <CardContent sx={{ textAlign: 'center' }}>
    <InsertDriveFileIcon sx={{ fontSize: 48, color: '#42A5F5' }} />
    <Typography variant="subtitle1" noWrap>{article.title}</Typography>
    <Typography variant="body2" color="text.secondary">
      {article.authors?.join(', ')}
    </Typography>
  </CardContent>
</Card>
```

### 3.3 网格布局

```typescript
<Box sx={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 2,
}}>
  {items.map((item) => (
    item.type === 'folder' ? <FolderCard /> : <ArticleCard />
  ))}
</Box>
```

## 4. 文件夹结构

### 4.1 数据结构

```typescript
interface FavoriteItem {
  id: string;
  name: string;
  type: 'folder' | 'article';
  article?: Article;        // 仅当 type === 'article' 时有值
  children?: FavoriteItem[]; // 仅当 type === 'folder' 时有值
}
```

### 4.2 层级限制

- 最多支持 **三层** 文件夹嵌套
- 第四层及以下不予显示

### 4.3 示例数据

```typescript
const favoriteItems: FavoriteItem[] = [
  {
    id: 'folder-1',
    name: '机器学习',
    type: 'folder',
    children: [
      {
        id: 'folder-1-1',
        name: 'Transformer',
        type: 'folder',
        children: [
          { id: 'article-1', name: 'Attention...', type: 'article', article: {...} },
        ],
      },
    ],
  },
  { id: 'article-2', name: 'BERT...', type: 'article', article: {...} },
];
```

## 5. 交互行为

### 5.1 文件夹操作

| 操作 | 行为 |
|------|------|
| 单击文件夹 | 进入该文件夹 |
| 右键文件夹 | 显示上下文菜单（重命名、删除） |
| 拖拽文件夹 | 移动到其他文件夹（可选功能） |

### 5.2 文章操作

| 操作 | 行为 |
|------|------|
| 单击文章 | 打开文章摘要弹窗 |
| 右键文章 | 显示上下文菜单（移动、移除） |

### 5.3 新建文件夹

可通过页面右上角按钮或上下文菜单创建新文件夹。

## 6. 右侧栏收藏夹模块

### 6.1 树形展示

在右侧栏以树形结构展示收藏夹：

```
├─ 📁 机器学习
│  ├─ 📁 Transformer
│  │  └─ 📄 Attention Is All You Need
│  └─ 📄 BERT
└─ 📁 计算机视觉
   └─ 📄 ViT
```

### 6.2 展开/收起

点击文件夹图标展开/收起子项：

```typescript
const toggleFolder = (folderId: string) => {
  setExpandedFolders((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(folderId)) {
      newSet.delete(folderId);
    } else {
      newSet.add(folderId);
    }
    return newSet;
  });
};
```

### 6.3 递归渲染

```typescript
const FavoriteItemRenderer = ({ items, level = 0 }) => {
  if (level >= 3) return null;  // 最多三层

  return items.map((item) => (
    <Box key={item.id}>
      <Box sx={{ pl: level * 1.5 }} onClick={() => handleItemClick(item)}>
        {item.type === 'folder' ? <FolderIcon /> : <InsertDriveFileIcon />}
        <Typography>{item.name}</Typography>
      </Box>
      {item.type === 'folder' && item.children && (
        <Collapse in={expandedFolders.has(item.id)}>
          <FavoriteItemRenderer items={item.children} level={level + 1} />
        </Collapse>
      )}
    </Box>
  ));
};
```

## 7. 图标颜色

| 类型 | 图标 | 颜色 |
|------|------|------|
| 文件夹 | FolderIcon | `#FFA726` (橙色) |
| 文章 | InsertDriveFileIcon | `#42A5F5` (蓝色) |

## 8. 空状态

当文件夹为空或无收藏时：

```typescript
{items.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <FolderIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
    <Typography color="text.secondary">暂无收藏内容</Typography>
  </Box>
)}
```