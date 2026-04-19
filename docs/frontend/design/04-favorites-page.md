# 04 — 收藏文章列表页（FavoritesPage）

## 页面概述

收藏页以文件管理器风格展示用户收藏的文章，支持文件夹层级结构。页面顶部包含面包屑导航、新建文件夹和返回按钮；下方是混合的文件夹和文件列表。支持丰富的右键菜单操作（新建文件夹、修改/删除/剪贴文件夹、取消收藏文件、粘贴文件夹）。

## 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ FavoritesPage                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AppBar: [← 返回] [新建文件夹]  [↑ 上一级]             │ │
│ │ Breadcrumb: 根目录 > 文件夹A > 子文件夹B              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ List Area                                               │ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ 📁 文件夹A                      [右键→修改/删除/剪贴]│ │
│ │ ├─────────────────────────────────────────────────────┤│ │
│ │ │ 📁 文件夹B                      [右键→修改/删除/剪贴]│ │
│ │ ├─────────────────────────────────────────────────────┤│ │
│ │ │ 📄 文章标题1        [▶展开]                        ││ │
│ │ │   └ 展开详情: 标题/作者/来源                        ││ │
│ │ │     [摘要][链接][收藏][下载][AI]                    ││ │
│ │ ├─────────────────────────────────────────────────────┤│ │
│ │ │ 📄 文章标题2        [▶展开]  [右键→取消收藏]       ││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────┘ │
│ 右键空白处: [新建文件夹] [粘贴文件夹]                       │
└─────────────────────────────────────────────────────────────┘
```

## 使用的 MUI 组件

| 组件 | 用途 |
|------|------|
| `AppBar` + `Toolbar` | 顶部操作栏 |
| `Button` / `IconButton` | 新建文件夹、上一级、返回主页 |
| `Breadcrumbs` | 文件夹路径导航，每一级可点击回退 |
| `Link` | 面包屑中每一级路径项 |
| `List` / `ListItem` / `ListItemButton` | 文件/文件夹列表 |
| `ListItemIcon` | 文件夹/文件图标 |
| `ListItemText` | 文件夹名/文章标题 |
| `IconButton` | 展开文章详情、功能按钮 |
| `Collapse` | 文章详情展开/收起动画 |
| `Menu` / `MenuItem` | 右键上下文菜单 |
| `Dialog` / `DialogTitle` / `DialogContent` / `DialogActions` | 确认删除/取消收藏弹窗、新建文件夹弹窗、修改文件夹名弹窗 |
| `TextField` | 弹窗内输入文件夹名 |
| `Button` | 弹窗确认/取消 |
| `Typography` | 展开后的文章详情文字 |
| `Chip` | 文章来源标签 |
| `Tooltip` | 按钮提示 |
| `Snackbar` | 操作反馈 |
| `Divider` | 列表分隔线 |
| `Folder` / `InsertDriveFile` / `Edit` / `Delete` / `ContentCut` / `ContentPaste` (Icon) | 各操作图标 |

## 交互逻辑

### 顶部操作栏

- **返回主页**：`IconButton`（`ArrowBack`），`navigate('/')`。
- **新建文件夹**：`Button`，弹出 `Dialog`，含 `TextField` 输入文件夹名，确认后调用 `invoke('create_folder', { parentId, name })`。
- **上一级**：`IconButton`（`ArrowUpward`），根据面包屑路径回退一级。若已在根目录则 `disabled`。
- **面包屑**：`Breadcrumbs`，每一级为 `Link`，点击跳转至对应文件夹。

### 文件夹列表项

- 单击进入文件夹，`navigate(`/favorites/${folderId}`)`。
- 右键弹出 `Menu`，包含：
  - **修改文件夹**：弹出 `Dialog`，含 `TextField` 修改文件夹名。
  - **删除文件夹**：弹出确认 `Dialog`（"确认删除文件夹及其全部内容？"），确认后调用 `invoke('delete_folder', { folderId })`。
  - **剪贴文件夹**：将 folderId 存入剪贴板状态 `useFavoriteStore.clipboard`，类型为 `cut`。

### 文件列表项

- 点击展开按钮（`IconButton` + `ExpandMore` 图标），`Collapse` 展开文章详情（标题、作者、来源）。
- 展开后显示 5 个功能 `IconButton`（摘要、链接、收藏、下载、AI 总结），与文章列表页一致。
- 右键弹出 `Menu`，包含：
  - **取消收藏**：弹出确认 `Dialog`（"确认取消收藏该文章？"），确认后调用 `invoke('remove_favorite', { articleId })`。

### 空白处右键

- 通过 `ClickAwayListener` + `Popover` 或自定义 `ContextMenu` 组件实现。
- 菜单项：
  - **新建文件夹**：同顶部新建按钮逻辑。
  - **粘贴文件夹**：检查 `useFavoriteStore.clipboard` 是否有内容，有则调用 `invoke('move_folder', { folderId, targetParentId })`，完成后清空剪贴板。

## 状态管理

```typescript
// stores/useFavoriteStore.ts
interface FavoriteStore {
  currentFolderId: string | null;
  folderPath: FolderNode[];          // 面包屑路径
  items: FavoriteItem[];             // 当前文件夹内容（混合文件夹+文件）
  clipboard: { type: 'cut'; folderId: string } | null;
  loading: boolean;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cutFolder: (folderId: string) => void;
  pasteFolder: (targetParentId: string) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
}
```

## 组件树

```
FavoritesPage
├── AppBar + Toolbar
│   ├── IconButton (返回 ArrowBack)
│   ├── Button (新建文件夹)
│   └── IconButton (上一级 ArrowUpward)
├── Breadcrumbs
│   └── Link × N (路径层级)
├── List (混合列表)
│   ├── FolderItem × N
│   │   ├── ListItemIcon (Folder 图标)
│   │   ├── ListItemText (文件夹名)
│   │   └── ContextMenu [修改/删除/剪贴]
│   └── FavoriteFileItem × N
│       ├── ListItemButton
│       ├── ListItemIcon (InsertDriveFile 图标)
│       ├── ListItemText (文章标题)
│       ├── IconButton (展开 ExpandMore)
│       ├── Collapse (详情)
│       │   ├── Typography (标题)
│       │   ├── Typography (作者)
│       │   ├── Chip (来源)
│       │   └── ArticleActions (5 按钮，见 07-shared-components.md)
│       └── ContextMenu [取消收藏]
└── ContextMenu (空白处) [新建文件夹/粘贴]
```
