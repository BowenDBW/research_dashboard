# 历史记录页面设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  ← 历史记录                                                  │
├──────────────────────────────────────────────────────────────┤
│  [阅读历史] [对话历史]                      [清除历史]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  今天                                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📄 Attention Is All You Need           10:30          │ │
│  │ Vaswani et al. · arXiv                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💬 关于 Transformer 架构的讨论         09:15          │ │
│  │ AI 对话                                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  昨天                                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📄 BERT: Pre-training of...           18:45           │ │
│  │ Devlin et al. · arXiv                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 2. 历史类型切换

### 2.1 Tab 切换

```typescript
<Tabs value={historyType} onChange={handleTypeChange}>
  <Tab icon={<ArticleIcon />} label="阅读历史" iconPosition="start" />
  <Tab icon={<ChatIcon />} label="对话历史" iconPosition="start" />
</Tabs>
```

### 2.2 类型说明

| 类型 | 内容 | 图标 |
|------|------|------|
| 阅读历史 | 浏览过的文章列表 | ArticleIcon |
| 对话历史 | AI 对话会话列表 | ChatIcon |

## 3. 阅读历史

### 3.1 数据结构

```typescript
interface HistoryRecord {
  id: string;
  article: Article;
  viewedAt: string;    // ISO 时间戳
}
```

### 3.2 列表项渲染

```typescript
<ListItem>
  <ListItemButton onClick={() => handleArticleClick(record.article)}>
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: 'primary.light' }}>
        <ArticleIcon />
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      primary={record.article.title}
      secondary={`${record.article.authors.join(', ')} · ${record.article.source}`}
    />
    <Typography variant="caption" color="text.secondary">
      {formatTime(record.viewedAt)}
    </Typography>
  </ListItemButton>
</ListItem>
```

### 3.3 点击行为

点击历史记录项时，打开文章摘要弹窗。

## 4. 对话历史

### 4.1 数据结构

```typescript
interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;      // 'chat' | 'paper_search' | 'chapter_summary'
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 列表项渲染

```typescript
<ListItem>
  <ListItemButton onClick={() => handleSessionClick(session.id)}>
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: 'secondary.light' }}>
        {session.mode === 'chat' ? <ChatIcon /> :
         session.mode === 'paper_search' ? <SearchIcon /> : <SummarizeIcon />}
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      primary={session.title}
      secondary={getModeLabel(session.mode)}
    />
    <Typography variant="caption" color="text.secondary">
      {formatTime(session.updatedAt)}
    </Typography>
  </ListItemButton>
</ListItem>
```

### 4.3 点击行为

点击历史会话项时：
1. 切换到该会话
2. 跳转到主页

```typescript
const handleSessionClick = (sessionId: string) => {
  switchSession(sessionId);
  navigate('/');
};
```

## 5. 时间分组

### 5.1 分组逻辑

按时间分组显示：

| 分组 | 条件 |
|------|------|
| 今天 | viewedAt/updatedAt 为今天 |
| 昨天 | viewedAt/updatedAt 为昨天 |
| 本周 | viewedAt/updatedAt 在本周内 |
| 更早 | 其他 |

### 5.2 分组标题

```typescript
<Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
  今天
</Typography>
```

## 6. 清除历史

### 6.1 清除按钮

```typescript
<Button
  color="error"
  startIcon={<DeleteIcon />}
  onClick={() => setConfirmDialogOpen(true)}
>
  清除历史
</Button>
```

### 6.2 确认对话框

```typescript
<ConfirmDialog
  open={confirmDialogOpen}
  title="清除历史记录"
  message="确定要清除所有历史记录吗？此操作不可撤销。"
  onConfirm={handleClearHistory}
  onCancel={() => setConfirmDialogOpen(false)}
/>
```

## 7. 右侧栏历史模块

### 7.1 模块位置

历史记录是右侧栏 **第三个模块**。

### 7.2 类型切换

使用 ToggleButton 切换阅读/对话历史：

```typescript
<ToggleButtonGroup value={historyType} exclusive onChange={handleTypeChange}>
  <ToggleButton value="reading">阅读</ToggleButton>
  <ToggleButton value="chat">对话</ToggleButton>
</ToggleButtonGroup>
```

### 7.3 快速入口

显示最近 5 条历史记录：

```typescript
{historyType === 'reading' ? (
  recentRecords.map((record) => (
    <Box onClick={() => handleArticleClick(record.article)}>
      <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 18 }} />
      <Typography>{record.article.title}</Typography>
    </Box>
  ))
) : (
  chatHistory.map((chat) => (
    <Box onClick={() => navigate(`/?sessionId=${chat.id}`)}>
      {getChatModeIcon(chat.mode)}
      <Typography>{chat.title}</Typography>
    </Box>
  ))
)}
```

### 7.4 图标颜色

标题图标颜色：`#FFCDD2`（淡红色）

## 8. 空状态

```typescript
{records.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
    <Typography color="text.secondary">暂无历史记录</Typography>
  </Box>
)}
```

## 9. 数据存储

### 9.1 阅读历史

- 记录用户浏览过的文章
- 自动去重（同一文章只记录最新浏览时间）
- 最多保留 100 条记录

### 9.2 对话历史

- 对话会话存储在 useChatStore
- 历史页面从 useChatStore 读取会话列表
- 按 updatedAt 排序