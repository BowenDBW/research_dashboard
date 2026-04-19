# 07 — 公共组件

跨页面复用的组件，需要在实现具体页面前先完成。

---

## 7.1 ArticleActions（文章操作按钮组）

该组件在文章列表页、收藏页、阅读历史页、右侧工具栏中复用，统一管理 5 个功能按钮。

**组件接口：**
```typescript
interface ArticleActionsProps {
  article: Article;
  onAbstract: () => void;
  onSource: (url: string) => void;
  onFavorite: (articleId: string) => void;
  onDownload: (url: string) => void;
  onAiSummary: (articleId: string) => void;
  isFavorited?: boolean;
  compact?: boolean;  // 紧凑模式（收藏页/历史页用）
}
```

**使用的 MUI 组件：** `IconButton`, `Tooltip`, `Dialog`（摘要弹窗）, `Snackbar`

**5 个按钮说明：**

| 按钮 | 图标 | 行为 |
|------|------|------|
| 查看摘要 | `Description` | 弹出 `Dialog`，显示完整 abstract |
| 来源网页 | `OpenInNew` | `invoke('open_url', { url })` 在浏览器打开 |
| 收藏 | `Bookmark` / `BookmarkBorder` | `invoke('toggle_favorite')`，切换图标状态 |
| 下载 PDF | `Download` | `invoke('open_url', { url })` 浏览器预览 PDF |
| AI 总结 | `AutoAwesome` | `navigate('/?tab=summary&articleId=xxx')` |

**compact 模式**：收藏页和历史页使用，按钮尺寸更小，无文字标签。

---

## 7.2 ConfirmDialog（确认弹窗）

通用确认弹窗，用于删除文件夹、取消收藏等操作。

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'error' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}
```

**使用的 MUI 组件：** `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Button`, `Typography`, `Alert`（severity 对应颜色）

---

## 7.3 RightToolbar（右侧常驻工具栏）

在所有页面右侧常驻，包含三个折叠区域。

```
┌─────────────────┐
│ RightToolbar     │
│ ┌─────────────┐ │
│ │ 收藏夹文件树│ │  ← 默认折叠，标题右侧 ArrowForward 可跳转收藏页
│ │ (只读)      │ │     展开后显示 TreeView
│ ├─────────────┤ │
│ │ 本周历史    │ │  ← 默认折叠，标题右侧 ArrowForward 可跳转历史页
│ │ · 条目1     │ │     展开后显示最近 7 天记录
│ │ · 条目2     │ │
│ ├─────────────┤ │
│ │ 订阅设置    │ │  ← 点击弹出 SubscriptionDialog
│ └─────────────┘ │
└─────────────────┘
```

**使用的 MUI 组件：**
- `Box` — 工具栏容器
- `Accordion` / `AccordionSummary` / `AccordionDetails` — 三个折叠区域
- `Typography` — 标题
- `IconButton` — 折叠箭头、跳转箭头
- `SimpleTreeView` (from `@mui/x-tree-view`) — 收藏夹文件树
- `TreeItem` — 文件树节点（文件夹可展开，文件节点包含 5 个操作按钮的 `IconButton`）
- `List` / `ListItem` / `ListItemText` — 本周历史列表
- `Chip` — 历史条目的行为标签
- `Dialog` — 订阅设置弹窗

**交互：**
- 收藏夹文件树为只读模式，文件夹节点可点击展开/收起，文件节点 hover 时显示操作按钮（5 个 `IconButton`，同 ArticleActions），不可删除/修改。
- 本周历史条目按时间倒序，最多显示 20 条，点击可跳转至阅读历史页。
- 订阅设置点击后弹出 `SubscriptionDialog`。

**响应式：**
- `md` 以上：常驻展开，固定宽度 280px。
- `md` 以下：自动折叠为图标栏，点击图标通过 `Popover` 弹出内容。

---

## 7.4 SubscriptionDialog（订阅子对话框）

```typescript
interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
}
```

**布局：**
```
┌──────────────────────────────────────┐
│ 订阅设置                      [×]   │
├──────────────────────────────────────┤
│ 关键词                               │
│ ┌──────────────────────────────────┐│
│ │ [cs.LG ×] [transformer ×] [+添加]││
│ │ Autocomplete (freeSolo, multiple)││
│ └──────────────────────────────────┘│
│                                      │
│ 订阅作者                             │
│ ┌──────────────────────────────────┐│
│ │ [Yann LeCun ×] [+添加]          ││
│ │ Autocomplete (freeSolo, multiple)││
│ └──────────────────────────────────┘│
│                                      │
│            [保存]  [取消]            │
└──────────────────────────────────────┘
```

**使用的 MUI 组件：** `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Autocomplete` (multiple, freeSolo), `Chip` (已选项，可删除), `TextField`, `Button`

**交互：**
- 关键词和作者均使用 `Autocomplete` 多选自由输入模式，输入后回车添加为 `Chip`。
- 点击 `Chip` 的删除图标移除。
- 保存后数据同步到 `useSubscriptionStore`，同时作为文章列表页筛选的默认值。

---

## 7.5 ContextMenu（右键菜单）

自定义右键菜单组件，封装 `Menu` 组件，监听 `contextmenu` 事件定位。

```typescript
interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}
```

**使用的 MUI 组件：** `Menu`, `MenuItem`, `ListItemIcon`, `ListItemText`, `Divider`

**实现要点：**
- 监听 `children` 的 `onContextMenu` 事件，调用 `event.preventDefault()` 阻止默认菜单。
- 将鼠标坐标传给 `Menu` 的 `anchorPosition` 属性，设置 `anchorReference="anchorPosition"`。
- 点击菜单项后自动关闭。

---

## 7.6 MUI 组件使用汇总

| 组件 | 使用位置 |
|------|---------|
| `IconButton` | ArticleActions、RightToolbar、各页面 |
| `Tooltip` | ArticleActions、各页面按钮 |
| `Dialog` / `DialogTitle` / `DialogContent` / `DialogActions` | ArticleActions（摘要）、ConfirmDialog、SubscriptionDialog |
| `Snackbar` | ArticleActions（操作反馈） |
| `Accordion` / `AccordionSummary` / `AccordionDetails` | RightToolbar 三个折叠区 |
| `SimpleTreeView` / `TreeItem` | RightToolbar 收藏夹文件树 |
| `List` / `ListItem` / `ListItemText` | RightToolbar 本周历史 |
| `Chip` | SubscriptionDialog、RightToolbar |
| `Autocomplete` | SubscriptionDialog |
| `Menu` / `MenuItem` | ContextMenu |
| `Popover` | RightToolbar（窄屏模式） |
