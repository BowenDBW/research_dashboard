# 09 — 扩展性设计

## 9.1 数据源扩展

当前爬虫来源为 Arxiv 和 Semantic Scholar，扩展新数据源需：

1. **后端**：新增爬虫模块，实现统一 `CrawlerTrait`。
2. **前端**：设置页的"爬取来源" `Checkbox` 组通过 `invoke('get_crawler_sources')` 动态获取，无需前端硬编码。
3. **文章数据模型**：`Article` 类型预留 `metadata: Record<string, unknown>` 字段，不同来源的特有字段存入此字段。

```typescript
interface Article {
  id: string;
  title: string;
  authors: string[];
  source: string;           // 期刊/会议名
  sourceType: string;       // 'arxiv' | 'semantic_scholar' | ...
  publishDate: string;
  abstract: string;
  url: string;
  pdfUrl: string;
  domains: string[];        // cs.LG, cs.AI 等
  metadata: Record<string, unknown>;  // 扩展字段
}
```

**扩展示例**：新增 IEEE Xplore 数据源
- 后端新增 `IeeeCrawler` 实现 `CrawlerTrait`
- 前端自动在设置页显示新来源选项（无需改动）
- IEEE 特有字段（如 DOI、会议地点）存入 `metadata`

## 9.2 AI 功能扩展

三种 AI 模式（Chat / Search / Summary）通过 `mode` 枚举区分，扩展新模式只需：

1. 在 `ChatMode` 枚举中添加新值。
2. 新增对应的 `Panel` 组件（如 `TranslationPanel`）。
3. 在主页 `Tabs` 中注册新 Tab。
4. 后端新增对应的 prompt 构建逻辑。

```typescript
type ChatMode = 'chat' | 'paper_search' | 'chapter_summary';
// 扩展示例: | 'translation' | 'literature_review' | 'related_work'
```

**扩展示例**：新增"文献综述"模式
- `ChatMode` 添加 `'literature_review'`
- 新增 `LiteratureReviewPanel` 组件
- 主页 Tabs 注册新 Tab
- 后端实现 literature_review prompt 构建

## 9.3 组件扩展

### ArticleActions 扩展

`ArticleActions` 组件可通过 `actions` 属性控制显示哪些按钮，新功能按钮可灵活添加：

```typescript
// 扩展后的接口
interface ArticleActionsProps {
  article: Article;
  actions?: ActionConfig[];  // 默认为全部 5 个，可自定义
  // ...原有属性
}

interface ActionConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: (article: Article) => void;
  visible?: boolean;
}
```

**扩展示例**：添加"导出 BibTeX"按钮
- 新增 `ActionConfig { key: 'bibtex', icon: <FileCopy />, label: '导出 BibTeX', ... }`
- 无需修改已有页面代码

### RightToolbar 扩展

右侧工具栏的折叠区域通过配置数组动态渲染，新增工具面板只需添加配置项：

```typescript
const toolbarPanels = [
  { key: 'favorites', title: '收藏夹', icon: <Bookmark />, component: <FavoritesTree /> },
  { key: 'history', title: '本周历史', icon: <History />, component: <WeeklyHistory /> },
  { key: 'subscriptions', title: '订阅设置', icon: <Subscriptions />, component: <SubscriptionTrigger /> },
  // 扩展示例:
  // { key: 'notes', title: '笔记', icon: <Note />, component: <QuickNotes /> },
];
```

### 订阅系统扩展

当前支持关键词和作者，可扩展为支持领域、机构等维度：

```typescript
// 扩展后的订阅类型
interface Subscriptions {
  keywords: string[];
  authors: string[];
  domains?: string[];      // 新增：领域订阅
  institutions?: string[]; // 新增：机构订阅
}
```

`SubscriptionDialog` 的 `Autocomplete` 列表通过配置驱动，新增维度只需添加配置项。

## 9.4 插件化架构预留

### LLM Provider 抽象

大模型接口抽象为 `LLMProvider`，后端通过 trait 实现多 provider 切换，前端只需切换设置：

```rust
// Rust 侧 trait
trait LlmProvider {
    async fn chat(&self, messages: Vec<Message>, mode: ChatMode) -> Stream<String>;
    async fn test_connection(&self) -> Result<(), String>;
}

// 实现
struct OpenAIProvider { endpoint: String, api_key: String }
struct LocalProvider { model_path: String }
struct HuggingFaceProvider { model_name: String }
```

前端无需感知具体实现，统一通过 `invoke('chat_send')` 和 `invoke('test_llm_connection')` 调用。

### 文章操作插件化

文章操作按钮抽象为 `ActionPlugin`，后续可支持"导出 BibTeX""生成引用""分享链接"等：

```typescript
// 插件注册机制（预留）
interface ActionPlugin {
  key: string;
  label: string;
  icon: React.ReactNode;
  execute: (article: Article) => void | Promise<void>;
  applicable: (article: Article) => boolean;  // 是否适用于该文章
}

// 全局注册表
const actionRegistry: ActionPlugin[] = [];

function registerAction(plugin: ActionPlugin) {
  actionRegistry.push(plugin);
}
```

### 未来可能的功能扩展点

| 扩展方向 | 说明 | 前端改动 |
|----------|------|---------|
| 多语言支持 | i18n 国际化 | 引入 `react-i18next`，MUI `ThemeProvider` 配置 `direction` |
| 主题市场 | 用户自定义主题色 | 新增主题编辑/导入功能 |
| 协作功能 | 多人共享收藏夹 | 新增分享链接 UI、权限管理 |
| PDF 内置阅读器 | 不跳转浏览器，内置预览 | 新增 PDF 阅读器页面 |
| 知识图谱 | 文章关联可视化 | 新增 D3.js 可视化页面 |
| 快捷键系统 | 全局键盘操作 | 新增快捷键配置界面 |
