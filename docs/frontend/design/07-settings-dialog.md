# 设置对话框设计

## 1. 为什么使用对话框而非独立页面

在早期设计中，设置是一个独立页面（`/settings` 路由）。但在实际开发中发现：

- 使用 React Router 的嵌套路由时，从设置页面跳转回其他页面存在导航问题
- URL 变化但页面不刷新

因此将设置改为对话框形式：
- 无需路由跳转
- 通过 `open` 状态控制显示
- 用户体验更流畅

## 2. 对话框结构

```
┌──────────────────────────────────────────────────────────────┐
│  设置                                                  [×]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ 大模型设置                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  云端服务商                                            │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ [☁] OpenAI                              [删除]  │ │ │
│  │  │ 端点: https://api.openai.com/v1                  │ │ │
│  │  │ API Key: sk-****                                 │ │ │
│  │  │ 模型列表:                                         │ │ │
│  │  │   · GPT-4o (gpt-4o)                   [删除]    │ │ │
│  │  │   · GPT-4 Turbo (gpt-4-turbo)         [删除]    │ │ │
│  │  │                              [+ 添加模型]        │ │ │
│  │  │ [测试连接]                                        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                              [+ 添加云端服务商]        │ │
│  │                                                        │ │
│  │  本地模型                                              │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ [🖥] Ollama                             [删除]   │ │ │
│  │  │ 端点: http://localhost:11434                     │ │ │
│  │  │ 模型列表: ...                                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ [🍎] MLX                                [删除]   │ │ │
│  │  │ HuggingFace ID 或本地绝对路径:                    │ │ │
│  │  │ 模型列表: ...                                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                              [+ 添加本地模型]          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ▼ 其他设置                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  爬虫设置...                                          │ │
│  │  数据库路径...                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                        [取消]  [保存]        │
└──────────────────────────────────────────────────────────────┘
```

## 3. 大模型设置

### 3.1 云端服务商配置

```typescript
interface CloudProviderConfig {
  id: string;
  name: string;           // 服务商名称（如 "OpenAI"）
  endpoint: string;       // API 端点
  apiKey: string;         // API Key
  models: ModelConfig[];  // 模型列表
}

interface ModelConfig {
  id: string;
  modelName: string;      // 内部模型名（如 "gpt-4o"）
  displayName: string;    // 显示名称（如 "GPT-4o"）
}
```

### 3.2 本地模型配置

#### 服务器模式 (Ollama 等)

```typescript
interface LocalProviderConfig {
  id: string;
  name: string;
  type: 'server';         // 服务器模式
  endpoint: string;       // 本地服务端点（如 http://localhost:11434）
  models: ModelConfig[];
}
```

#### MLX 模式 (Apple Silicon)

```typescript
interface LocalProviderConfig {
  id: string;
  name: string;
  type: 'mlx';            // MLX 模式
  endpoint: string;       // 留空
  models: ModelConfig[];
}
```

**MLX 特殊处理**：
- 模型路径支持 HuggingFace ID 或本地绝对路径
- 仅在 macOS / iOS / iPadOS 平台显示 MLX 选项
- 模型列表标题显示提示："HuggingFace ID 或本地绝对路径"

### 3.3 图标区分

| 类型 | 图标 | 颜色 |
|------|------|------|
| 云端服务商 | CloudIcon | primary |
| 本地服务器 | DnsIcon | secondary |
| Apple MLX | AppleIcon | `#A3AAAE` |

### 3.4 连接测试

每个服务商配置区域提供"测试连接"按钮：

```typescript
const handleTestConnection = async (provider: CloudProviderConfig) => {
  try {
    const result = await testApiConnection(provider);
    setTestResult({ success: true, message: '连接成功' });
  } catch (error) {
    setTestResult({ success: false, message: '连接失败: ' + error.message });
  }
};
```

## 4. 无限循环问题解决

### 4.1 问题描述

对话框打开时，useEffect 依赖变化导致无限循环更新：

```
Maximum update depth exceeded. This can happen when a component calls
setState inside useEffect, but useEffect either doesn't have a dependency
array, or one of the dependencies changes on every render.
```

### 4.2 解决方案

使用 `useRef` 跟踪初始化状态：

```typescript
const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const { settings, updateSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settings);

  // 使用 ref 防止无限循环
  const initializedRef = useRef(false);

  useEffect(() => {
    if (open && !initializedRef.current) {
      setLocalSettings(settings);
      initializedRef.current = true;
    }
    if (!open) {
      initializedRef.current = false;
    }
  }, [open, settings]);

  // ...
};
```

### 4.3 原理

- `initializedRef` 在组件生命周期内保持不变
- 对话框打开时只初始化一次
- 对话框关闭时重置标志
- 避免每次 render 都触发 setState

## 5. 对话框行为

### 5.1 打开方式

从左侧栏底部设置按钮或主页模型选择器的"配置模型"按钮触发：

```typescript
// AppShell.tsx
const [settingsOpen, setSettingsOpen] = useState(false);

<SideDrawer onOpenSettings={() => setSettingsOpen(true)} />
<HomePage openSettings={() => setSettingsOpen(true)} />
<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

### 5.2 关闭方式

| 方式 | 行为 |
|------|------|
| 点击 × 按钮 | 关闭对话框 |
| 点击取消按钮 | 放弃更改，关闭对话框 |
| 点击保存按钮 | 保存更改，关闭对话框 |
| 点击对话框外部 | 不关闭（防止误操作） |

### 5.3 对话框属性

```typescript
<Dialog
  open={open}
  onClose={onClose}
  maxWidth="md"
  fullWidth
  disableEscapeKeyDown  // 防止 ESC 关闭
  // 注意：不设置 onClickOutside 关闭
>
```

## 6. 数据持久化

设置数据通过 Zustand store 管理，可配合 Tauri 的文件系统 API 实现本地持久化：

```typescript
// useSettingsStore.ts
export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates }
  })),
  // 可添加持久化逻辑
}));
```

## 7. 默认配置

为方便用户快速上手，提供默认 OpenAI 配置：

```typescript
const defaultSettings: AppSettings = {
  cloudProviders: [{
    id: 'openai-default',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    models: [{
      id: 'gpt-4o-default',
      modelName: 'gpt-4o',
      displayName: 'GPT-4o',
    }],
  }],
  localProviders: [],
  selectedModelId: 'gpt-4o-default',
  // ...其他默认设置
};
```