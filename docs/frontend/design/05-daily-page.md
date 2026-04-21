# Google 推荐页面设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  ← Google 推荐                            [月份选择器 2024-01▼]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 2024-01-15                                    6 篇  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 2024-01-14                                    4 篇  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  每页 [5▼] 条          [1] [2] [3] ... [10]                 │
└──────────────────────────────────────────────────────────────┘
```

## 2. 标题栏设计

### 2.1 布局

左侧返回按钮 + 标题，右侧月份选择器：

```typescript
<Toolbar>
  <IconButton onClick={() => navigate('/')}>
    <ArrowBackIcon />
  </IconButton>
  <Typography variant="h6" sx={{ ml: 2 }}>
    Google 推荐
  </Typography>
  <Box sx={{ flex: 1 }} />
  <DatePicker
    views={['year', 'month']}
    value={searchMonth}
    onChange={handleMonthChange}
    slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
  />
</Toolbar>
```

### 2.2 月份选择器

- 仅选择年份和月份，不选日期
- 选择后自动筛选该月份的推荐
- 可清空选择查看全部推荐

## 3. 推荐卡片

### 3.1 卡片结构

简洁的卡片设计，只显示日期和文章数量：

```typescript
<Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' } }}>
  <CardContent>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarIcon fontSize="small" color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {rec.date}
        </Typography>
      </Box>
      <Chip icon={<ArticleIcon />} label={`${rec.articleCount} 篇`} size="small" variant="outlined" color="primary" />
    </Box>
  </CardContent>
</Card>
```

### 3.2 卡片属性

| 属性 | 说明 |
|------|------|
| date | 推荐日期 (YYYY-MM-DD) |
| articleCount | 推荐文章数量 |

### 3.3 卡片宽度

使用 `maxWidth="sm"` 使卡片较窄，视觉更精致。

## 4. 分页控制

### 4.1 固定底部

分页器固定在页面底部，不随内容滚动：

```typescript
<Box sx={{
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: 1,
  borderColor: 'divider',
  py: 1,
  px: 2,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 2,
}}>
  <FormControl size="small">
    <Select value={pageSize} onChange={handlePageSizeChange}>
      <MenuItem value={5}>5 条</MenuItem>
      <MenuItem value={10}>10 条</MenuItem>
      <MenuItem value={20}>20 条</MenuItem>
    </Select>
  </FormControl>
  <Pagination count={totalPages} page={page} onChange={handlePageChange} />
</Box>
```

### 4.2 每页条数选项

- 5 条（默认）
- 10 条
- 20 条

## 5. 推荐详情弹窗

### 5.1 弹窗结构

点击卡片后打开文章列表弹窗，使用 ArticleCard 展示每篇文章：

```
┌──────────────────────────────────────────────────────────────┐
│  [📅 2024-01-15]  [📄 6 篇]                            [×]   │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Attention Is All You Need               ASK AI         │ │
│  │ Vaswani et al.                                         │ │
│  │ [arXiv] 2017  [cs.LG] [cs.CL]           ☆ ⋮           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ BERT: Pre-training of Deep Bidirectional...  ASK AI    │ │
│  │ Devlin et al.                                          │ │
│  │ [arXiv] 2018  [cs.CL]                   ★ ⋮           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ...                                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 文章卡片渲染

使用 ArticleCard 组件展示每篇推荐文章：

```typescript
<DialogContent dividers>
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {recommendation.articles.map((article) => (
      <ArticleCard key={article.id} article={article} />
    ))}
  </Box>
</DialogContent>
```

### 5.3 弹窗尺寸

```typescript
<Dialog maxWidth="md" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
```

## 6. 数据类型

```typescript
interface DailyRecommendationListItem {
  id: string;
  date: string;           // YYYY-MM-DD
  articleCount: number;   // 推荐文章数量
}

interface DailyRecommendation extends DailyRecommendationListItem {
  articles: Article[];    // 推荐的文章列表
  createdAt: string;
  updatedAt: string;
}
```

## 7. 右侧栏入口

### 7.1 模块位置

Google 推荐是右侧栏 **第一个模块**。

### 7.2 快速入口

显示最近 5 条推荐：

```typescript
{recentRecommendations.map((rec) => (
  <Box onClick={() => handleRecommendationClick(rec.id)}>
    <CalendarIcon sx={{ color: '#9CCC65', fontSize: 16 }} />
    <Typography variant="body2">{rec.date}</Typography>
    <Chip label={`${rec.articleCount} 篇`} size="small" />
  </Box>
))}
```

### 7.3 图标颜色

| 位置 | 颜色 |
|------|------|
| 标题图标 | `#C5E1A5` (淡黄绿) |
| 内容日期图标 | `#9CCC65` (黄绿) |

## 8. 空状态

```typescript
{recommendations.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <Typography color="text.secondary">暂无推荐</Typography>
  </Box>
)}
```
