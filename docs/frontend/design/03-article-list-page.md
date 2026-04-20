# 文章列表页设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  ← 文章检索                                                   │
├──────────────────────────────────────────────────────────────┤
│  [搜索框]                                      [筛选按钮]     │
│  开始日期: [________]  结束日期: [________]  数据源: [全部 ▼] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📄 Attention Is All You Need                    [☆]   │ │
│  │ Vaswani et al. · arXiv · 2017                          │ │
│  │ The dominant sequence transduction models...           │ │
│  │ [cs.LG] [cs.CL]                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📄 BERT: Pre-training of Deep Bidirectional...  [★]   │ │
│  │ Devlin et al. · arXiv · 2018                          │ │
│  │ We introduce a new language representation...          │ │
│  │ [cs.CL]                                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                        [1] [2] [3] ... [10]                  │
└──────────────────────────────────────────────────────────────┘
```

## 2. 顶部搜索栏

### 2.1 搜索框

```typescript
<TextField
  fullWidth
  size="small"
  placeholder="搜索论文标题、作者、关键词..."
  value={searchQuery}
  onChange={handleSearchChange}
  InputProps={{
    startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
  }}
/>
```

### 2.2 筛选条件

| 筛选项 | 组件 | 说明 |
|--------|------|------|
| 开始日期 | DatePicker | 筛选发布日期范围 |
| 结束日期 | DatePicker | 筛选发布日期范围 |
| 数据源 | Select | arXiv / Semantic Scholar / IEEE / Springer / 全部 |

## 3. 文章卡片

### 3.1 卡片布局

```typescript
<Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: 4 } }}>
  <CardContent>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="h6" noWrap>{article.title}</Typography>
      <IconButton onClick={() => toggleFavorite(article.id)}>
        {article.isFavorited ? <StarIcon color="warning" /> : <StarBorderIcon />}
      </IconButton>
    </Box>
    <Typography variant="body2" color="text.secondary">
      {article.authors.join(', ')} · {article.source} · {article.publishDate}
    </Typography>
    <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
      {article.abstract.slice(0, 150)}...
    </Typography>
    <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
      {article.domains.map(d => <Chip key={d} label={d} size="small" />)}
    </Box>
  </CardContent>
</Card>
```

### 3.2 卡片交互

| 操作 | 行为 |
|------|------|
| 点击卡片 | 打开文章详情弹窗 |
| 点击收藏按钮 | 切换收藏状态 |
| 悬停 | 卡片阴影加深、微上浮 |

### 3.3 文章属性

```typescript
interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;           // 数据源名称
  sourceType: string;       // arxiv, semantic_scholar, etc.
  publishDate: string;
  abstract: string;
  url: string;              // 原文链接
  pdfUrl: string;           // PDF 链接
  domains: string[];        // 研究领域标签
  isFavorited: boolean;
  metadata: Record<string, any>;
}
```

## 4. 文章详情弹窗

### 4.1 弹窗结构

```
┌──────────────────────────────────────────────────────────────┐
│  Attention Is All You Need                            [×]    │
│  ─────────────────────────────────────────────────────────── │
│  Vaswani et al. · arXiv · 2017                              │
│  [cs.LG] [cs.CL]                                            │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  摘要                                                        │
│  The dominant sequence transduction models are based on     │
│  complex recurrent or convolutional neural networks...      │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [☆ 收藏]  [分享]  [PDF]  [原文]                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 操作按钮

| 按钮 | 功能 |
|------|------|
| 收藏 | 切换收藏状态 |
| 分享 | 复制文章链接 |
| PDF | 在新窗口打开 PDF |
| 原文 | 在新窗口打开原文 |

## 5. 分页控制

### 5.1 分页器

```typescript
<Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
  <Pagination
    count={totalPages}
    page={page}
    onChange={handlePageChange}
    color="primary"
    shape="rounded"
  />
</Box>
```

### 5.2 分页参数

```typescript
const PAGE_SIZE = 20;
const totalPages = Math.ceil(totalArticles / PAGE_SIZE);
```

## 6. 加载与空状态

### 6.1 加载骨架屏

```typescript
{loading && Array.from({ length: 5 }).map((_, i) => (
  <Card key={i}>
    <CardContent>
      <Skeleton width="60%" />
      <Skeleton width="40%" />
      <Skeleton width="80%" />
    </CardContent>
  </Card>
))}
```

### 6.2 空状态

```typescript
{!loading && articles.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <Typography color="text.secondary">未找到相关文章</Typography>
  </Box>
)}
```

## 7. 数据源显示

不同数据源使用不同图标：

| 数据源 | 图标 | 颜色 |
|--------|------|------|
| arXiv | ArticleIcon | 橙色 |
| Semantic Scholar | ArticleIcon | 蓝色 |
| IEEE | ArticleIcon | 绿色 |
| Springer | ArticleIcon | 紫色 |