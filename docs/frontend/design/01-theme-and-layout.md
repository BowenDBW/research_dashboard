# 01 — 主题定制与全局布局

## 1. 主题定制

### 1.1 调色板（Palette）

```typescript
// app/ThemeProvider.tsx
const theme = createTheme({
  palette: {
    mode: 'light',  // 默认浅色，支持切换
    primary: {
      main: '#1565C0',       // 深蓝 — 学术/科研调性
      light: '#1E88E5',
      dark: '#0D47A1',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00897B',       // 青绿 — 辅助强调色
      light: '#4DB6AC',
      dark: '#00695C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    error: {
      main: '#D32F2F',
    },
    warning: {
      main: '#F57C00',
    },
    info: {
      main: '#1976D2',
    },
    success: {
      main: '#388E3C',
    },
  },
});
```

### 1.2 暗黑模式

通过 `CssBaseline` 和 `useMediaQuery` 实现系统偏好检测，配合用户手动切换。主题模式持久化至 Tauri 本地存储。

```typescript
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#42A5F5' },
    secondary: { main: '#4DB6AC' },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
  },
});
```

色彩系统可视化：

```
Light Mode:
┌─────────────────────────────────────────────────┐
│ Primary:   ██████ #1565C0 (深蓝)                │
│ Secondary: ██████ #00897B (青绿)                │
│ Background:██████ #F5F5F5 (浅灰)                │
│ Paper:     ██████ #FFFFFF (白色)                 │
│ Text:      ██████ #212121 (深灰)                │
│ Caption:   ██████ #757575 (中灰)                │
│ Divider:   ██████ #E0E0E0 (分割线)              │
└─────────────────────────────────────────────────┘

Dark Mode:
┌─────────────────────────────────────────────────┐
│ Primary:   ██████ #42A5F5 (亮蓝)                │
│ Secondary: ██████ #4DB6AC (亮青)                │
│ Background:██████ #121212 (深黑)                │
│ Paper:     ██████ #1E1E1E (深灰)                │
│ Text:      ██████ #FFFFFF (白色)                 │
│ Caption:   ██████ #9E9E9E (灰色)                │
│ Divider:   ██████ #424242 (暗分割线)            │
└─────────────────────────────────────────────────┘
```

### 1.3 字体排版（Typography）

```typescript
typography: {
  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
  h4: { fontWeight: 600, letterSpacing: '0.02em' },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
  body1: { fontSize: '0.875rem', lineHeight: 1.6 },
  body2: { fontSize: '0.75rem', lineHeight: 1.5 },
  caption: { fontSize: '0.6875rem', color: '#757575' },
},
```

### 1.4 Spacing 与 Shape

```typescript
spacing: 8,   // 基础间距单位 8px
shape: {
  borderRadius: 8,
},
components: {
  MuiButton: {
    styleOverrides: {
      root: { borderRadius: 8, textTransform: 'none' },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: { borderRadius: 12 },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { borderRadius: 8 },
    },
  },
},
```

### 1.5 Breakpoints

| 名称 | 值 | 用途 |
|------|-----|------|
| `xs` | 0px | 最小窗口（Tauri 窗口缩小极限） |
| `sm` | 600px | 窄窗口 |
| `md` | 960px | 中等窗口（默认 Tauri 窗口宽度） |
| `lg` | 1280px | 标准桌面 |
| `xl` | 1920px | 大屏桌面 |

默认 Tauri 窗口初始尺寸设为 1280×800，通过 `tauri.conf.json` 配置。

---

## 2. 全局布局壳（AppShell）

全局采用 **三栏布局**：左侧 Drawer + 中间内容区 + 右侧工具栏。

```
┌─────────────────────────────────────────────────────────────┐
│                      AppShell                                │
│ ┌──────────┐ ┌─────────────────────────┐ ┌───────────────┐ │
│ │          │ │                         │ │               │ │
│ │  Side    │ │     Main Content        │ │  Right        │ │
│ │  Drawer  │ │     (Route Outlet)      │ │  Toolbar      │ │
│ │  (可折叠) │ │                         │ │  (常驻)       │ │
│ │          │ │                         │ │               │ │
│ │          │ │                         │ │               │ │
│ └──────────┘ └─────────────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**使用的 MUI 组件：**
- `Box` — 三栏 flex 容器
- `Drawer` — 左侧可折叠导航
- `CssBaseline` — 全局样式基线
- `Container` / `Grid` — 内容区布局

**左侧 Drawer（SideDrawer）** 仅在主页显示时默认展开，在其他页面通过 `IconButton` 控制展开/收起。收起后仅显示图标。

**右侧工具栏（RightToolbar）** 在所有页面常驻，宽度固定 280px，可通过 `IconButton` 折叠至仅图标模式。

---

## 3. 路由配置

```typescript
// app/Router.tsx
const routes = [
  { path: '/',           element: <HomePage /> },
  { path: '/articles',   element: <ArticleListPage /> },
  { path: '/favorites',  element: <FavoritesPage /> },
  { path: '/favorites/:folderId', element: <FavoritesPage /> },
  { path: '/settings',   element: <SettingsPage /> },
  { path: '/history',    element: <HistoryPage /> },
];
```

使用 `HashRouter` 以兼容 Tauri 的文件协议加载方式。页面跳转通过 `useNavigate()` 实现。

---

## 4. 响应式设计

### 4.1 设计策略

以桌面端为主（Tauri 桌面应用），但需适配不同窗口大小：

| 断点 | 窗口宽度 | 布局调整 |
|------|---------|---------|
| `xl` (≥1920px) | 大屏桌面 | 三栏全展开，内容区最大宽度约束 |
| `lg` (1280-1919px) | 标准桌面 | 三栏全展开，默认布局 |
| `md` (960-1279px) | 中等窗口 | 右侧工具栏自动折叠为图标栏 |
| `sm` (600-959px) | 窄窗口 | 左侧 Drawer 变为临时抽屉（`variant="temporary"`），右侧工具栏折叠 |
| `xs` (<600px) | 最小窗口 | 仅显示内容区，Drawer/Toolbar 通过浮动按钮唤出 |

### 4.2 实现方式

```typescript
// hooks/useResponsiveLayout.ts
const useResponsiveLayout = () => {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));

  return {
    drawerVariant: isSm ? 'persistent' : 'temporary',
    rightToolbarCollapsed: !isMd,
    showFloatingToolbar: !isSm,
  };
};
```

关键响应式规则：
- **Grid 布局**：筛选栏在 `md` 以上使用 4 列 Grid，`sm` 以下折叠为 2 列。
- **Drawer**：`sm` 以上使用 `variant="persistent"`（可折叠侧栏），`xs` 使用 `variant="temporary"`（覆盖式抽屉）。
- **右侧工具栏**：`md` 以上常驻展开，`md` 以下自动折叠为图标栏，点击图标 `Popover` 弹出内容。
- **文章卡片**：`md` 以上横向排列信息，`sm` 以下垂直堆叠。
- **Tabs**：`sm` 以下 Tabs 文字隐藏，仅显示图标。

### 4.3 Tauri 窗口配置

```json
// tauri.conf.json
{
  "app": {
    "windows": [{
      "title": "Research Dashboard",
      "width": 1280,
      "height": 800,
      "minWidth": 600,
      "minHeight": 400,
      "resizable": true
    }]
  }
}
```
