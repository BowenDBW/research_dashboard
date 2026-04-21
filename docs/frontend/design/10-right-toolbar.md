# 右侧栏设计

## 1. 整体结构

### 1.1 布局

右侧栏宽度 300px，可通过按钮折叠/展开。

```
┌──────────────────────┐
│ Google 推荐     →    │  第一个模块
├──────────────────────┤
│ 收藏夹          →    │  第二个模块
├──────────────────────┤
│ 历史记录        →    │  第三个模块
│ [阅读] [对话]        │
├──────────────────────┤
│ 订阅设置              │  第四个模块
└──────────────────────┘
```

### 1.2 折叠状态

折叠时仅显示展开按钮，位于屏幕右边缘垂直居中。

### 1.3 滚动处理

使用 `scrollbarGutter: 'stable'` 预留滚动条空间，避免滚动条出现时内容跳动：

```typescript
<Box
  sx={{
    overflow: 'auto',
    overflowX: 'hidden',
    scrollbarGutter: 'stable',
  }}
>
```

## 2. 模块顺序与颜色

### 2.1 模块顺序

| 顺序 | 模块名称 | 功能描述 |
|------|----------|----------|
| 1 | Google 推荐 | 基于 Google Scholar 的每日推荐文章 |
| 2 | 收藏夹 | 三层文件夹结构 |
| 3 | 历史记录 | 阅读历史 + 对话历史 |
| 4 | 订阅设置 | 关键词与作者订阅 |

### 2.2 图标颜色

| 模块 | 标题图标颜色 | 内容图标颜色 |
|------|-------------|-------------|
| Google 推荐 | `#C5E1A5` (淡黄绿) | `#9CCC65` (黄绿) |
| 收藏夹 | `#BBDEFB` (淡蓝) | 文件夹 `#FFA726`，文件 `#42A5F5` |
| 历史记录 | `#FFCDD2` (淡红) | - |
| 订阅设置 | `#B39DDB` (淡紫) | - |

### 2.3 颜色设计原则

- 标题图标使用更淡的版本
- 内容图标使用相对饱和的版本
- 各模块颜色有区分度，便于用户识别

## 3. 手风琴组件

### 3.1 展开收起

使用 MUI Accordion 组件：

```typescript
<Accordion
  expanded={expandedPanels.includes('daily')}
  onChange={() => handlePanelToggle('daily')}
>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    {/* 标题区域 */}
  </AccordionSummary>
  <AccordionDetails>
    {/* 内容区域 */}
  </AccordionDetails>
</Accordion>
```

### 3.2 状态管理

```typescript
const [expandedPanels, setExpandedPanels] = useState<string[]>([]);

const handlePanelToggle = (panel: string) => {
  setExpandedPanels((prev) =>
    prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
  );
};
```

### 3.3 多面板展开

支持同时展开多个面板，不互斥。

## 4. Google 推荐模块

### 4.1 标题栏

```typescript
<AccordionSummary expandIcon={<ExpandMoreIcon />}>
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <NewspaperIcon sx={{ color: '#C5E1A5' }} />
      <Typography variant="subtitle2">Google 推荐</Typography>
    </Box>
    <IconButton onClick={() => navigate('/daily')}>
      <ArrowForwardIcon />
    </IconButton>
  </Box>
</AccordionSummary>
```

### 4.2 内容列表

显示最近 5 条推荐，每条显示日期和文章数量：

```typescript
<AccordionDetails sx={{ maxHeight: 200, overflow: 'auto' }}>
  {recentRecommendations.map((rec) => (
    <Box onClick={() => handleRecommendationClick(rec.id)}>
      <CalendarIcon sx={{ color: '#9CCC65', fontSize: 16 }} />
      <Typography variant="body2">{rec.date}</Typography>
      <Chip label={`${rec.articleCount} 篇`} size="small" />
    </Box>
  ))}
</AccordionDetails>
```

### 4.3 点击行为

点击推荐项打开 DailyRecommendationDialog 弹窗，展示文章卡片列表。

## 5. 收藏夹模块

### 5.1 树形结构渲染

递归渲染最多三层：

```typescript
const FavoriteItemRenderer = ({ items, level = 0 }) => {
  if (level >= 3) return null;

  return items.map((item) => (
    <Box key={item.id} sx={{ pl: level * 1.5 }}>
      <Box onClick={() => handleItemClick(item)}>
        {item.type === 'folder' ? (
          <FolderIcon sx={{ color: '#FFA726' }} />
        ) : (
          <InsertDriveFileIcon sx={{ color: '#42A5F5' }} />
        )}
        <Typography>{item.name}</Typography>
        {item.type === 'folder' && expandedFolders.has(item.id) ? (
          <ExpandLessIcon />
        ) : (
          <ExpandMoreIcon />
        )}
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

### 5.2 文件夹展开

```typescript
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

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

### 5.3 点击行为

| 类型 | 行为 |
|------|------|
| 文件夹 | 展开/收起 |
| 文章 | 打开 AbstractDialog 弹窗 |

## 6. 历史记录模块

### 6.1 类型切换

使用 ToggleButtonGroup 切换阅读/对话历史：

```typescript
<ToggleButtonGroup
  value={historyType}
  exclusive
  onChange={(_, newValue) => setHistoryType(newValue)}
  size="small"
>
  <ToggleButton value="reading">阅读</ToggleButton>
  <ToggleButton value="chat">对话</ToggleButton>
</ToggleButtonGroup>
```

### 6.2 阅读历史

```typescript
{historyType === 'reading' && recentRecords.map((record) => (
  <Box onClick={() => handleArticleClick(record.article)}>
    <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 18 }} />
    <Typography>{record.article.title}</Typography>
  </Box>
))}
```

### 6.3 对话历史

```typescript
{historyType === 'chat' && chatHistory.map((chat) => (
  <Box onClick={() => navigate(`/?sessionId=${chat.id}`)}>
    {chat.mode === 'chat' ? <ChatIcon /> : <InsertDriveFileIcon />}
    <Typography>{chat.title}</Typography>
  </Box>
))}
```

### 6.4 点击行为

| 类型 | 行为 |
|------|------|
| 阅读历史 | 打开 AbstractDialog 弹窗 |
| 对话历史 | 跳转到主页并加载该会话 |

## 7. 订阅设置模块

### 7.1 标题栏

无跳转按钮，仅展示和编辑功能。

### 7.2 内容展示

```typescript
<AccordionDetails>
  <Typography variant="body2" color="text.secondary">
    点击下方按钮管理订阅的关键词和作者
  </Typography>
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    <Chip label="cs.LG" size="small" />
    <Chip label="transformer" size="small" />
  </Box>
  <Box sx={{ mt: 1 }}>
    <Chip label="Yann LeCun" size="small" variant="outlined" />
  </Box>
  <IconButton onClick={() => setSubscriptionDialogOpen(true)}>
    <TuneIcon />
    <Typography>编辑订阅</Typography>
  </IconButton>
</AccordionDetails>
```

### 7.3 编辑订阅

点击"编辑订阅"按钮打开 SubscriptionDialog 弹窗。

## 8. 快速入口按钮

每个模块（除订阅设置外）标题栏右侧有快速入口按钮：

```typescript
<IconButton
  size="small"
  onClick={(e) => {
    e.stopPropagation();  // 阻止展开/收起
    navigate('/daily');
  }}
>
  <ArrowForwardIcon fontSize="small" />
</IconButton>
```

点击后跳转到对应的完整页面。

## 9. 组件文件

```typescript
// src/components/layout/RightToolbar.tsx

interface RightToolbarProps {
  open: boolean;
  onToggle: () => void;
}

export const RightToolbar = ({ open, onToggle }: RightToolbarProps) => {
  // 状态管理
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [historyType, setHistoryType] = useState<'reading' | 'chat'>('reading');

  // ... 渲染逻辑
};
```

## 10. 空状态

各模块在无数据时显示空状态提示：

```typescript
{items.length === 0 && (
  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
    暂无内容
  </Typography>
)}
```