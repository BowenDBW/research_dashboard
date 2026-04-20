# 主页设计

## 1. 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  [AI 对话] [AI 搜索推荐] [文章总结]              [模型选择器] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                       内容区域                                │
│                   (空状态或消息列表)                          │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                    [输入框居中，最大800px]                    │
└──────────────────────────────────────────────────────────────┘
```

## 2. 三种对话模式

### 2.1 模式切换 Tab

```typescript
<Tabs value={activeTab} onChange={handleTabChange}>
  <Tab icon={<ChatIcon />} label="AI 对话" iconPosition="start" />
  <Tab icon={<SearchIcon />} label="AI 搜索推荐" iconPosition="start" />
  <Tab icon={<SummarizeIcon />} label="文章总结" iconPosition="start" />
</Tabs>
```

### 2.2 模式切换逻辑

切换模式时自动创建新会话，不同模式间不共享对话历史：

```typescript
const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
  const newMode = tabToMode[newValue];
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // 如果当前会话有消息或模式不同，创建新会话
  if (currentSession && (messages.length > 0 || currentSession.mode !== newMode)) {
    createSession(newMode);
  }

  setActiveTab(newValue);
};
```

### 2.3 各模式特殊元素

| 模式 | 顶部附加元素 |
|------|-------------|
| AI 对话 | 无 |
| AI 搜索推荐 | 日期范围选择器（开始日期、结束日期） |
| 文章总结 | 文章选择器（Autocomplete） |

## 3. 模型选择器

### 3.1 显示格式

```
[☁ GPT-4o OpenAI ▼]
```

- 云端模型：☁ 云图标（蓝色）
- 本地服务器：🖥 服务器图标（灰色）
- Apple MLX：🍎 Apple 图标（灰色）

### 3.2 下拉选项

```
┌─────────────────────────────┐
│ ☁ GPT-4o          OpenAI   │
│ ☁ Claude 3 Opus   Anthropic│
│ 🖠 Llama 3        Ollama   │
│ 🍎 Mistral-7B     MLX      │
└─────────────────────────────┘
```

### 3.3 无模型时的状态

显示"配置模型"按钮，点击打开设置对话框。

## 4. 空状态设计

每个模式有独立的欢迎界面：

### 4.1 AI 对话

```
        ┌─────────────┐
        │     💬      │
        └─────────────┘
      AI 智能对话

与 AI 助手进行自然语言对话，探索学术问题、
获取研究灵感和深入讨论您感兴趣的话题

[概念解释] [研究灵感] [学术讨论]

试试问："请解释一下 Transformer 的工作原理"
```

### 4.2 AI 搜索推荐

```
        ┌─────────────┐
        │     🔍      │
        └─────────────┘
      AI 论文搜索

用自然语言描述您的研究方向，AI 将为您智能
推荐相关论文，支持多数据源联合检索

[arXiv] [Semantic Scholar] [IEEE] [Springer]

试试搜索："关于大语言模型推理能力的研究"
```

### 4.3 文章总结

```
        ┌─────────────┐
        │     📝      │
        └─────────────┘
      文章逐章总结

选择一篇论文，AI 将为您生成结构化的逐章总结，
帮助您快速把握论文要点

[摘要提取] [要点归纳] [关键发现]

从上方选择文章或从收藏夹中打开论文开始总结
```

## 5. 消息列表

### 5.1 消息渲染

```typescript
messages.map((msg) => (
  <Box sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
    {msg.role === 'assistant' && <Avatar><SmartToyIcon /></Avatar>}
    <Paper sx={{ maxWidth: '70%', bgcolor: msg.role === 'user' ? 'primary.light' : 'background.default' }}>
      <Typography>{msg.content}</Typography>
    </Paper>
    {msg.role === 'user' && <Avatar><PersonIcon /></Avatar>}
  </Box>
));
```

### 5.2 自动滚动

新消息添加后自动滚动到底部：

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

### 5.3 流式输出状态

AI 回复生成中显示骨架屏加载状态：

```typescript
{isStreaming && (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Avatar sx={{ bgcolor: 'primary.main' }}><SmartToyIcon /></Avatar>
    <Paper sx={{ p: 2 }}>
      <Skeleton width={200} />
    </Paper>
  </Box>
)}
```

## 6. 输入区域

### 6.1 布局

居中显示，最大宽度 800px：

```typescript
<Paper sx={{ maxWidth: 800, mx: 'auto', width: '100%' }} elevation={3}>
  <Box sx={{ display: 'flex', gap: 1 }}>
    <TextField multiline maxRows={4} fullWidth size="small" />
    <IconButton color="primary">
      <SendIcon />
    </IconButton>
  </Box>
</Paper>
```

### 6.2 占位符文本

| 模式 | 占位符 |
|------|--------|
| AI 对话 | "输入您的问题..." |
| AI 搜索推荐 | "描述您想要查找的论文..." |
| 文章总结 | "添加额外的总结要求..." |

### 6.3 快捷键

- Enter 发送消息
- Shift + Enter 换行

## 7. 类型定义

```typescript
interface ChatMode = 'chat' | 'paper_search' | 'chapter_summary';

interface ModelOption {
  id: string;
  displayName: string;
  providerName: string;
  type: 'cloud' | 'local';
  localType?: 'server' | 'mlx';
}
```