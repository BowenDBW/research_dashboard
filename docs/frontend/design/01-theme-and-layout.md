# 主题与布局设计

## 1. 主题配置

### 1.1 MUI 主题

使用 MUI 的 `createTheme` 创建自定义主题：

```typescript
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    secondary: { main: '#ce93d8' },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});
```

### 1.2 主题切换

通过 `ThemeProvider` 和自定义 Hook 实现主题切换：

```typescript
// ThemeProvider.tsx
export const useThemeMode = () => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { mode, toggleMode };
};
```

主题切换按钮位于左侧栏底部，展开时显示图标+文字，折叠时仅显示图标。

## 2. 三栏布局

### 2.1 布局结构

```
┌────────────────────────────────────────────────────────────────┐
│                        AppShell                                 │
├─────────────┬───────────────────────────┬─────────────────────┤
│  SideDrawer │        Outlet             │    RightToolbar     │
│   280px     │       flex: 1             │      300px          │
│   可折叠     │                           │      可折叠          │
│   72px      │                           │                     │
│   (折叠)    │                           │                     │
└─────────────┴───────────────────────────┴─────────────────────┘
```

### 2.2 AppShell 组件

```typescript
// AppShell.tsx
const AppShell = () => {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightToolbarOpen, setRightToolbarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SideDrawer
        open={leftDrawerOpen}
        onToggle={() => setLeftDrawerOpen(!leftDrawerOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Outlet context={{ openSettings: () => setSettingsOpen(true) }} />
      </Box>
      <RightToolbar
        open={rightToolbarOpen}
        onToggle={() => setRightToolbarOpen(!rightToolbarOpen)}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Box>
  );
};
```

### 2.3 左侧栏 (SideDrawer)

**展开状态 (280px)**：
```
┌──────────────────────┐
│ 文章检索  →          │
│ 最后爬取: 2024-01-10 │
│ 文章总量: 1,234 篇   │
├──────────────────────┤
│ [新对话]             │
├──────────────────────┤
│ 会话列表...          │
│                      │
├──────────────────────┤
│   🌙深色  ⚙设置     │
│       v0.1.0         │
└──────────────────────┘
```

**折叠状态 (72px)**：
```
┌────────┐
│   📄   │
├────────┤
│   +    │
├────────┤
│   💬   │
│   🔍   │
│   📝   │
│   ...  │
├────────┤
│   🌙   │
│   ⚙    │
└────────┘
```

### 2.4 右侧栏 (RightToolbar)

**展开状态 (300px)**：
```
┌──────────────────────┐
│ 📰 Claw 日报    →    │
│   2024-01-15 深度... │
│   2024-01-14 大语... │
├──────────────────────┤
│ 🔖 收藏夹       →    │
│   📁 机器学习        │
│     📁 Transformer   │
│       📄 Attention.. │
├──────────────────────┤
│ 🕐 历史记录 [阅读|对话] →│
│   📄 Transformer...  │
│   💬 关于...         │
├──────────────────────┤
│ ⚙ 订阅设置           │
│   cs.LG transformer  │
│   Yann LeCun         │
│   [编辑订阅]         │
└──────────────────────┘
```

**折叠状态**：
仅显示展开按钮，位于屏幕右边缘垂直居中。

## 3. 滚动条处理

### 3.1 防止布局跳动

使用 `scrollbarGutter: 'stable'` 预留滚动条空间：

```typescript
<Box
  sx={{
    overflow: 'auto',
    overflowX: 'hidden',
    scrollbarGutter: 'stable',  // 预留滚动条空间
  }}
>
```

### 3.2 各区域滚动行为

| 区域 | 滚动方式 |
|------|----------|
| 左侧栏会话列表 | 区域内滚动 |
| 右侧栏各模块 | 模块内滚动 (maxHeight: 200px) |
| 中间内容区 | 区域内滚动 |
| 主页消息区 | 区域内滚动，新消息自动滚到底部 |

## 4. 响应式设计

当前为桌面端优先设计，窗口最小宽度建议 1200px。

折叠行为：
- 窗口较窄时，默认折叠左右侧栏
- 用户手动展开/折叠的状态应持久化