# 共享组件设计

## 1. MarkdownViewer

### 1.1 用途

渲染 Markdown 格式的文本内容，主要用于 Claw 日报详情弹窗。

### 1.2 Props

```typescript
interface MarkdownViewerProps {
  content: string;  // Markdown 文本
}
```

### 1.3 支持的语法

| Markdown 语法 | 渲染方式 |
|--------------|----------|
| `# 标题` | `<Typography variant="h4">` |
| `## 标题` | `<Typography variant="h5">` |
| `### 标题` | `<Typography variant="h6">` |
| `**粗体**` | `<Typography sx={{ fontWeight: 600 }}>` |
| `*斜体*` | `<Typography sx={{ fontStyle: 'italic' }}>` |
| `[链接文字](url)` | `<Link href="url" target="_blank">` |
| `- 列表项` | `<Box component="ul"><Typography component="li">` |
| `1. 列表项` | 有序列表，带序号 |
| `---` | 分割线 `<Box sx={{ borderBottom: 1 }}>` |

### 1.4 实现原理

简单的自定义解析器，无需第三方依赖：

```typescript
export const MarkdownViewer = ({ content }: MarkdownViewerProps) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: string[] = [];

    lines.forEach((line, index) => {
      // 处理列表
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { inList = true; listItems = []; }
        listItems.push(line.substring(2));
        return;
      }

      // 结束列表
      if (inList) {
        elements.push(<ul key={`list-${index}`}>...</ul>);
        inList = false; listItems = [];
      }

      // 处理标题
      if (line.startsWith('# ')) {
        elements.push(<Typography variant="h4">{line.substring(2)}</Typography>);
        return;
      }
      // ... 其他语法处理

      // 普通段落
      elements.push(<Typography>{renderInlineMarkdown(line)}</Typography>);
    });

    return elements;
  };

  return <Box>{renderMarkdown(content)}</Box>;
};
```

### 1.5 内联元素处理

```typescript
const renderInlineMarkdown = (text: string) => {
  // 依次处理粗体、斜体、链接
  // 使用正则匹配，返回 JSX 元素数组
};
```

---

## 2. AbstractDialog

### 2.1 用途

展示文章摘要详情，支持收藏操作。

### 2.2 Props

```typescript
interface AbstractDialogProps {
  open: boolean;
  article: Article | null;
  isFavorited: boolean;
  onClose: () => void;
  onFavoriteChange: (isFavorited: boolean) => void;
}
```

### 2.3 对话框结构

```
┌──────────────────────────────────────────────────────────────┐
│  Attention Is All You Need                            [×]    │
│  ─────────────────────────────────────────────────────────── │
│  Vaswani et al. · arXiv · 2017                              │
│  [cs.LG] [cs.CL]                                            │
│                                                              │
│  摘要                                                        │
│  The dominant sequence transduction models are based on     │
│  complex recurrent or convolutional neural networks...      │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│  [☆ 收藏]  [分享]  [PDF]  [原文]                            │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 操作按钮

| 按钮 | 图标 | 行为 |
|------|------|------|
| 收藏 | StarIcon / StarBorderIcon | 切换收藏状态，调用 `onFavoriteChange` |
| 分享 | ShareIcon | 复制文章链接到剪贴板 |
| PDF | PictureAsPdfIcon | 在新窗口打开 PDF |
| 原文 | OpenInNewIcon | 在新窗口打开原文 |

---

## 3. DailyReportDialog

### 3.1 用途

展示 Claw 日报详情，渲染 Markdown 内容。

### 3.2 Props

```typescript
interface DailyReportDialogProps {
  open: boolean;
  reportId: string | null;
  onClose: () => void;
}
```

### 3.3 数据加载

根据 `reportId` 从 `useDailyStore` 加载日报详情：

```typescript
export const DailyReportDialog = ({ open, reportId, onClose }: DailyReportDialogProps) => {
  const { fetchReportById } = useDailyStore();
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    if (open && reportId) {
      fetchReportById(reportId).then(setReport);
    }
    if (!open) {
      setReport(null);
    }
  }, [open, reportId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* 标题、日期、文章数 */}
      <MarkdownViewer content={report?.content || ''} />
    </Dialog>
  );
};
```

### 3.4 加载状态

加载中显示骨架屏：

```typescript
{loading ? (
  <Box>
    <Skeleton height={30} />
    <Skeleton height={30} />
    <Skeleton height={30} width="80%" />
  </Box>
) : (
  <MarkdownViewer content={report?.content || ''} />
)}
```

---

## 4. SubscriptionDialog

### 4.1 用途

管理订阅的关键词和作者。

### 4.2 Props

```typescript
interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
}
```

### 4.3 对话框结构

```
┌──────────────────────────────────────────────────────────────┐
│  订阅设置                                             [×]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  关键词订阅                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [cs.LG ×] [transformer ×] [attention ×]               │ │
│  │ [添加关键词]___________________________________        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  作者订阅                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Yann LeCun ×] [Geoffrey Hinton ×]                    │ │
│  │ [添加作者]______________________________________       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                        [取消]  [保存]        │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 数据管理

通过 `useSubscriptionStore` 管理订阅数据：

```typescript
interface SubscriptionStore {
  keywords: string[];
  authors: string[];
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;
  addAuthor: (author: string) => void;
  removeAuthor: (author: string) => void;
}
```

### 4.5 Chip 组件

使用 MUI 的 Chip 组件展示订阅项，支持删除：

```typescript
<Chip
  label={keyword}
  onDelete={() => removeKeyword(keyword)}
  size="small"
/>
```

---

## 5. ConfirmDialog

### 5.1 用途

通用确认对话框，用于危险操作前的确认。

### 5.2 Props

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;    // 默认 "确认"
  cancelText?: string;     // 默认 "取消"
  onConfirm: () => void;
  onCancel: () => void;
}
```

### 5.3 对话框结构

```
┌──────────────────────────────────────────────────────────────┐
│  清除历史记录                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  确定要清除所有历史记录吗？此操作不可撤销。                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                              [取消]  [确认]                   │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 使用示例

```typescript
const [confirmOpen, setConfirmOpen] = useState(false);

const handleClearHistory = () => {
  clearHistory();
  setConfirmOpen(false);
};

<ConfirmDialog
  open={confirmOpen}
  title="清除历史记录"
  message="确定要清除所有历史记录吗？此操作不可撤销。"
  onConfirm={handleClearHistory}
  onCancel={() => setConfirmOpen(false)}
/>
```

---

## 6. 组件位置

| 组件 | 文件路径 |
|------|----------|
| MarkdownViewer | `src/components/common/MarkdownViewer.tsx` |
| AbstractDialog | `src/components/article/AbstractDialog.tsx` |
| DailyReportDialog | `src/components/daily/DailyReportDialog.tsx` |
| SubscriptionDialog | `src/components/common/SubscriptionDialog.tsx` |
| ConfirmDialog | `src/components/common/ConfirmDialog.tsx` |