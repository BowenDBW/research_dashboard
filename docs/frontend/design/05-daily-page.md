# Claw 日报页面设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  ← Claw 日报                              [月份选择器 2024-01▼]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 2024-01-15                                   12 篇  │ │
│  │ 深度学习优化方法新进展                                  │ │
│  │ 今日收录 12 篇论文，涵盖优化器改进、学习率调度...        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 2024-01-14                                    8 篇  │ │
│  │ 大语言模型推理加速技术                                  │ │
│  │ 今日收录 8 篇论文，包括量化、剪枝、知识蒸馏...          │ │
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
    Claw 日报
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
- 选择后自动筛选该月份的日报
- 可清空选择查看全部日报

## 3. 日报卡片

### 3.1 卡片结构

```typescript
<Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' } }}>
  <CardContent>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarIcon fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary">{report.date}</Typography>
      </Box>
      <Chip icon={<ArticleIcon />} label={`${report.articleCount} 篇`} size="small" variant="outlined" />
    </Box>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{report.title}</Typography>
    <Typography variant="body2" color="text.secondary">{report.summary}</Typography>
  </CardContent>
</Card>
```

### 3.2 卡片属性

| 属性 | 说明 |
|------|------|
| date | 日报日期 (YYYY-MM-DD) |
| title | 日报标题 |
| summary | 简短摘要（第二行） |
| articleCount | 收录论文数量 |

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

## 5. 日报详情弹窗

### 5.1 弹窗结构

```
┌──────────────────────────────────────────────────────────────┐
│  深度学习优化方法新进展                                [×]    │
│  ─────────────────────────────────────────────────────────── │
│  [📅 2024-01-15]  [📄 12 篇论文]                             │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  # 深度学习优化方法新进展                                    │
│                                                              │
│  **日期**: 2024-01-15                                        │
│                                                              │
│  ## 概述                                                     │
│  今日 Claw 共收录 **12 篇** 与深度学习优化相关的...          │
│                                                              │
│  ## 重点论文推荐                                             │
│  ### 1. AdamW 的收敛性分析与改进                            │
│  [arXiv:2401.01234](https://arxiv.org/abs/2401.01234)       │
│                                                              │
│  ...                                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Markdown 渲染

使用自定义 MarkdownViewer 组件渲染日报内容：

```typescript
<MarkdownViewer content={report.content} />
```

### 5.3 弹窗尺寸

```typescript
<Dialog maxWidth="md" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
```

## 6. MarkdownViewer 组件

### 6.1 支持的 Markdown 语法

| 语法 | 渲染方式 |
|------|----------|
| `# H1` | Typography variant="h4" |
| `## H2` | Typography variant="h5" |
| `### H3` | Typography variant="h6" |
| `**bold**` | fontWeight: 600 |
| `*italic*` | fontStyle: 'italic' |
| `[text](url)` | MUI Link 组件 |
| `- item` | 无序列表 |
| `1. item` | 有序列表 |
| `---` | 分割线 |

### 6.2 实现

简单的自定义 Markdown 解析器，无需第三方库：

```typescript
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  // 逐行解析，支持标题、列表、粗体、斜体、链接等
  return elements;
};
```

## 7. 数据类型

```typescript
interface DailyReportListItem {
  id: string;
  date: string;           // YYYY-MM-DD
  title: string;
  summary: string;
  articleCount: number;
}

interface DailyReport extends DailyReportListItem {
  content: string;        // Markdown 内容
  createdAt: string;
  updatedAt: string;
}
```

## 8. 右侧栏入口

### 8.1 模块位置

Claw 日报是右侧栏 **第一个模块**。

### 8.2 快速入口

显示最近 5 条日报：

```typescript
{recentReports.map((report) => (
  <Box onClick={() => handleDailyClick(report.id)}>
    <CalendarIcon sx={{ color: '#9CCC65', fontSize: 16 }} />
    <Typography variant="caption">{report.date}</Typography>
    <Typography variant="body2">{report.title}</Typography>
  </Box>
))}
```

### 8.3 图标颜色

| 位置 | 颜色 |
|------|------|
| 标题图标 | `#C5E1A5` (淡黄绿) |
| 内容日期图标 | `#9CCC65` (黄绿) |

## 9. 空状态

```typescript
{reports.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <Typography color="text.secondary">暂无日报</Typography>
  </Box>
)}
```