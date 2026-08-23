# 插件开发手册

插件 = 插件目录里的一个子文件夹。app 启动/重扫时读每个子文件夹的 `plugin.json`，
加载成功才显示；失败只在设置里标红、弹几秒提示，**不影响 app 运行**。
插件安装 = 手动把文件夹放进插件目录（默认 `~/.research_dashboard/plugins/`），点设置里的「重新扫描」。

**入口/显示位置**：插件缩略信息显示在**右边栏**（可拖拽排序、可隐藏）；设置界面左侧导引的
「插件」板块下，每个插件是一个**二级子项**，点它就跳转到该插件的页面（`hasPage` 时）。
主界面左侧导航栏只放对话记录，不放插件。

## 目录结构

```
<pluginsDir>/<pluginId>/
├── plugin.json          # 必填：插件元信息（名称/版本/作者/描述…）
├── icon.svg             # 可选：缩略图标（在右边栏/设置里显示）
├── page/                # 可选：插件前端（多文件，相对路径互相引用）
│   ├── index.html       #     入口页（hasPage=true 时必填）
│   ├── app.js           #     逻辑，可拆任意多个 js/css/图片
│   └── …
└── data/                # 可选：插件自己的数据，只经 RdPlugin.data.* 读写，app 自动创建
```

**最少需要 2 个文件**：`plugin.json` + （`page/index.html`，如果 `hasPage` 为 true）。
不带页面、只在右边栏显示信息的插件：只 1 个 `plugin.json`。

## plugin.json（配置文件名就叫这个，字段全小写）

```json
{
  "id": "demo",                // 必填：唯一 id，= 文件夹名（会用作 url /plugins/<id>）
  "name": "Demo Plugin",       // 必填：显示名
  "version": "1.0.0",          // 可选：版本号
  "author": "your name",       // 可选
  "description": "一句话描述",   // 可选：右边栏/设置里显示
  "icon": "icon.svg",          // 可选：插件目录内图标文件名
  "hasPage": true,             // 可选：false 则右边栏只有信息、没有可点击页面
  "entry": "page/index.html"   // 可选：页面入口，缺省 "page/index.html"
}
```

`hasPage: true` 时 app 会校验 `entry` 指向的文件存在，不存在 → 该插件加载失败（标红，不影响 app）。

## 页面怎么写（前端）

入口页必须引入内置桥，然后直接用 `window.RdPlugin`：

```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <h1>我的插件</h1>
  <script src="rdp://core/bridge.js"></script>
  <script src="./app.js"></script>   <!-- 相对路径即可，多文件互相引用 -->
</body></html>
```

页面在独立 iframe 里运行，**与 app 隔离**：页面崩了不影响 app；也碰不到 app 的
其它文件/窗口。页面可自行 `fetch` 外部 API（跨域受限时用 `RdPlugin.http`）。

## 可用接口（RdPlugin）

| 接口 | 说明 |
|---|---|
| `RdPlugin.db.query(sql, params?)` | 执行 SELECT，返回行数组 `[{列名:值}, …]`。**全库所有表可查** |
| `RdPlugin.db.exec(sql, params?)` | 执行 INSERT/UPDATE/DELETE/DDL，返回 `{rowsAffected, lastInsertId}` |
| `RdPlugin.data.read(path)` | 读插件 `data/` 下文本文件（相对路径） |
| `RdPlugin.data.write(path, content)` | 写插件 `data/` 下文本文件（自动建父目录） |
| `RdPlugin.http.get(url, headers?)` | 服务端代发 GET，返回 `{status, headers, body}`（绕 CORS） |
| `RdPlugin.http.post(url, body?, headers?)` | 服务端代发 POST |
| `RdPlugin.theme` | 当前主题：`'light'` / `'dark'`（app 明暗主题，随切换实时更新） |
| `RdPlugin.lang` | 当前语言：`'zh'` / `'en'` |
| `RdPlugin.onContext(fn)` | 订阅主题/语言变化：`fn({theme, lang})`，切换时回调 |

参数：`params` 为数组，元素支持 null/数字/字符串/布尔。返回的 blob 值形如 `"blob:<base64>"`。

## 适配明暗主题 / 多语言

app 把当前主题与语言通过 `rdp-context` 消息推送给插件页面（iframe 加载后及每次切换时）。
- **主题**：`<html>` 上会有 `data-theme="light|dark"`，直接写 CSS：
  ```css
  html[data-theme="dark"] body { background: #121212; color: #e0e0e0; }
  ```
  或读 `RdPlugin.theme` / `RdPlugin.onContext(fn)` 动态处理。
- **多语言**：`RdPlugin.lang` 给出当前语言；语言文件放**自己文件夹里**（如 `i18n/zh.json`、`i18n/en.json`），
  用相对 `fetch('i18n/' + RdPlugin.lang + '.json')` 加载，按 lang 渲染。i18n 资源不依赖 app、不占用 app 文件。

## 插件配置项（settings）

`plugin.json` 一级键 `settings` 下的键值对就是该插件在**设置界面里的配置项**：
```json
"settings": { "highlightColor": "#1976d2", "maxItems": 5, "showCounts": true }
```
- 设置 → 插件 → 左侧导引的插件二级子项 → 跳到该插件的设置块，编辑后保存会**写回 `plugin.json` 的 `settings`**。
- 没有 `settings`（或为空对象）的插件不显示子项、不显示编辑块。
- 插件运行时读配置：直接 `fetch('../plugin.json')` 取 `settings`（相对路径，文件就在自己文件夹里）。

## 数据都在插件文件夹内

- 配置：`plugin.json` 的 `settings`（设置界面改的就是它）。
- 运行数据：`data/`，经 `RdPlugin.data.*`（相对路径，越界被拒）。
- 页面/语言/图标等资源：插件文件夹内，`rdp://<id>/…` 任意文件按需取。
- 唯一在 app 层保存的是**右边栏面板位置/隐藏状态**（`layout.json`，属于 UI 布局而非插件数据，内置面板也存这里）。

**权限边界**：
- 数据库：**完整 CRUD**，所有表都可读写（按要求不做鉴权），请自行谨慎使用。
- 文件：只能读写**自己插件目录下的 `data/`**，经 `RdPlugin.data.*` 访问；
  `..` 逃逸会被拒绝。**拿不到 app 的任何其它文件。**
- 页面：只能拿自己插件目录内的文件（`rdp://<id>/…`），碰不到 app 资源。

## 出错不炸

- `plugin.json` 缺失/解析失败/缺必填字段/入口文件不存在 → 该插件标红，其它插件照常。
- 页面运行时抛错 → 只在 iframe 内，不影响 app。
- `RdPlugin.*` 调用失败 → Promise reject（`err.message` 有原因），页内自行处理。

## 最小示例（2 个文件）

`demo/plugin.json`：
```json
{ "id": "hello", "name": "Hello", "version": "0.1.0", "hasPage": true }
```

`demo/page/index.html`：
```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script src="rdp://core/bridge.js"></script>
  <script>
    RdPlugin.db.query('SELECT COUNT(*) AS total FROM papers')
      .then(r => document.body.innerText = '文章总数: ' + r[0].total)
      .catch(e => document.body.innerText = '失败: ' + e.message);
  </script>
</body></html>
```

详见真实示例：`~/.research_dashboard/plugins/demo/`。
