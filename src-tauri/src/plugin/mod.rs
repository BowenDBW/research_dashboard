// Plugin module
// 插件系统后端：
// - 插件目录扫描与注册表（plugin.json 解析，加载失败只记录不中断启动）
// - 数据库全量 CRUD 接口（plugin_db_query / plugin_db_exec）
// - 插件自己的 data 目录读写（路径校验，杜绝越出插件目录）
// - 服务端 HTTP 抓取（plugin_http，绕开 iframe CORS）
// - rdp:// 自定义协议：给插件 iframe 提供页面文件 + 内置 bridge.js
//
// 插件「后端」能力全部由本模块提供；插件自身逻辑运行在其前端 JS 里。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl};
use crate::AppState;
use crate::settings::get_plugins_dir;

/// 插件元信息（plugin.json 解析结果 + 加载状态）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub icon: Option<String>,
    pub has_page: bool,
    pub entry: Option<String>,
    /// 可选：后台 worker 入口（相对插件目录的 HTML），app 会为它建隐藏窗口常驻后台
    pub worker: Option<String>,
    /// 插件配置项（plugin.json 的一级键 "settings" 下的键值对），设置界面可编辑
    pub settings: Option<serde_json::Value>,
    pub dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub load_error: Option<String>,
}

impl PluginInfo {
    /// 插件页面入口文件（相对插件目录）；缺省 page/index.html。
    pub fn page_entry(&self) -> String {
        self.entry.clone().unwrap_or_else(|| "page/index.html".to_string())
    }
    /// 插件后台 worker 入口（相对插件目录）；无 worker 返回 None。
    pub fn worker_entry(&self) -> Option<String> {
        self.worker.clone()
    }
}

/// plugin.json 清单（字段均按 camelCase 解析，容错缺失字段）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginManifest {
    id: String,
    name: String,
    version: Option<String>,
    author: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    #[serde(default)]
    has_page: bool,
    entry: Option<String>,
    #[serde(default)]
    worker: Option<String>,
    #[serde(default)]
    settings: Option<serde_json::Value>,
}

/// 扫描单个插件目录；任何失败只写入 load_error，绝不让 app 启动失败。
fn scan_plugin(dir: &Path) -> PluginInfo {
    let dir_str = dir.to_string_lossy().to_string();
    let fallback_id = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

    let build = || -> Result<PluginInfo, String> {
        let config_path = dir.join("plugin.json");
        if !config_path.exists() {
            return Err("缺少 plugin.json".to_string());
        }
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取 plugin.json 失败: {}", e))?;
        let meta: PluginManifest = serde_json::from_str(&content)
            .map_err(|e| format!("plugin.json 解析失败: {}", e))?;

        let id = if meta.id.trim().is_empty() { fallback_id.clone() } else { meta.id.trim().to_string() };
        if id.is_empty() {
            return Err("plugin.json 缺少 id".to_string());
        }
        if meta.name.trim().is_empty() {
            return Err("plugin.json 缺少 name".to_string());
        }
        if meta.has_page {
            let entry = meta.entry.clone().unwrap_or_else(|| "page/index.html".to_string());
            if !dir.join(&entry).exists() {
                return Err(format!("入口文件 {} 不存在", entry));
            }
        }
        if let Some(worker) = meta.worker.as_ref() {
            if !dir.join(worker).exists() {
                return Err(format!("worker 入口文件 {} 不存在", worker));
            }
        }
        Ok(PluginInfo {
            id,
            name: meta.name,
            version: meta.version.unwrap_or_default(),
            author: meta.author.unwrap_or_default(),
            description: meta.description.unwrap_or_default(),
            icon: meta.icon,
            has_page: meta.has_page,
            entry: meta.entry,
            worker: meta.worker,
            settings: meta.settings,
            dir: dir_str.clone(),
            load_error: None,
        })
    };

    match build() {
        Ok(info) => info,
        Err(e) => PluginInfo {
            id: fallback_id.clone(),
            name: fallback_id,
            version: String::new(),
            author: String::new(),
            description: String::new(),
            icon: None,
            has_page: false,
            entry: None,
            worker: None,
            settings: None,
            dir: dir_str,
            load_error: Some(e),
        },
    }
}

/// 扫描插件目录，返回插件列表（加载失败的排最后）。
pub fn scan_plugins_dir(plugins_dir: &Path) -> Vec<PluginInfo> {
    let mut plugins = Vec::new();
    if let Ok(entries) = fs::read_dir(plugins_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                plugins.push(scan_plugin(&entry.path()));
            }
        }
    }
    plugins.sort_by(|a, b| {
        let (ae, be) = (a.load_error.is_some(), b.load_error.is_some());
        (ae, a.name.to_lowercase()).cmp(&(be, b.name.to_lowercase()))
    });
    plugins
}

/// 全局插件注册表（AppState.plugins）。
#[derive(Default)]
pub struct PluginRegistry {
    inner: Mutex<Vec<PluginInfo>>,
}

impl PluginRegistry {
    pub fn set(&self, plugins: Vec<PluginInfo>) {
        if let Ok(mut inner) = self.inner.lock() {
            *inner = plugins;
        }
    }
    pub fn list(&self) -> Vec<PluginInfo> {
        self.inner.lock().map(|inner| inner.clone()).unwrap_or_default()
    }
    pub fn get(&self, id: &str) -> Option<PluginInfo> {
        self.inner.lock().ok().and_then(|inner| inner.iter().find(|p| p.id == id).cloned())
    }
}

/// 重新扫描插件目录、写入注册表并广播 plugins-changed。
pub fn reload_plugins(app: &AppHandle) {
    let plugins = match get_plugins_dir() {
        Ok(dir) => scan_plugins_dir(&dir),
        Err(e) => {
            eprintln!("[插件] 读取插件目录失败: {}", e);
            Vec::new()
        }
    };
    let err_count = plugins.iter().filter(|p| p.load_error.is_some()).count();
    println!("[插件] 扫描完成: {} 个插件 ({} 个加载失败)", plugins.len(), err_count);
    if let Some(state) = app.try_state::<Arc<AppState>>() {
        state.plugins.set(plugins.clone());
    }
    let _ = app.emit("plugins-changed", serde_json::json!({
        "count": plugins.len(),
        "errors": err_count,
    }));
}

// ==========================================
// 命令
// ==========================================

/// 返回当前已加载插件列表（含 load_error）。
#[tauri::command]
pub fn plugins_list(state: State<'_, Arc<AppState>>) -> Result<Vec<PluginInfo>, String> {
    Ok(state.plugins.list())
}

/// 保存插件配置：把 settings 写回该插件 plugin.json 的一级键 "settings"（保留其余字段），并重扫。
#[tauri::command]
pub fn plugin_update_settings(app: AppHandle, plugin_id: String, settings: serde_json::Value) -> Result<(), String> {
    let dir = get_plugins_dir()?;
    let config_path = dir.join(&plugin_id).join("plugin.json");
    if !config_path.exists() {
        return Err("插件不存在".to_string());
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 plugin.json 失败: {}", e))?;
    let mut manifest: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 plugin.json 失败: {}", e))?;
    if let Some(obj) = manifest.as_object_mut() {
        obj.insert("settings".to_string(), settings);
    } else {
        return Err("plugin.json 不是合法对象".to_string());
    }
    let out = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&config_path, out).map_err(|e| format!("写入 plugin.json 失败: {}", e))?;
    reload_plugins(&app);
    Ok(())
}

/// 重新扫描插件目录并返回最新列表。
#[tauri::command]
pub fn plugins_reload(app: AppHandle) -> Result<Vec<PluginInfo>, String> {
    reload_plugins(&app);
    Ok(app.try_state::<Arc<AppState>>().map(|s| s.plugins.list()).unwrap_or_default())
}

/// 更改插件存放目录：把现有插件子目录搬过去，更新 settings.pluginsDir，并重扫。
#[tauri::command]
pub fn change_plugins_dir(app: AppHandle, new_path: String) -> Result<String, String> {
    let new_dir = PathBuf::from(&new_path);
    if !new_dir.exists() {
        fs::create_dir_all(&new_dir).map_err(|e| format!("创建插件目录失败: {}", e))?;
    }
    let old_dir = get_plugins_dir()?;
    if old_dir != new_dir && old_dir.exists() {
        for entry in fs::read_dir(&old_dir).map_err(|e| format!("读取旧插件目录失败: {}", e))? {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name();
                let dest = new_dir.join(&name);
                fs::rename(entry.path(), &dest)
                    .or_else(|_| fs::copy(entry.path(), &dest).and_then(|_| fs::remove_dir_all(entry.path())))
                    .map_err(|e| format!("移动插件目录失败: {}", e))?;
            }
        }
    }

    let mut settings = crate::settings::ensure_settings()?;
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("pluginsDir".to_string(), serde_json::Value::String(new_dir.to_string_lossy().to_string()));
    }
    crate::settings::write_settings_to_disk(settings)?;

    reload_plugins(&app);
    Ok(new_dir.to_string_lossy().to_string())
}

// ==========================================
// 后台 worker 与通知（给插件提供后台执行 + app 顶层提醒）
//
// - 插件 plugin.json 里声明 "worker": "worker.html" 后，app 启动/定时器会为它建一个
//   隐藏 WebviewWindow（label: plugin-worker-<id>），加载 rdp://<id>/worker.html，
//   页面内用 rdp://core/worker-bridge.js（直接走 __TAURI_INTERNALS__，不经 React 转发）。
// - Rust 侧 start_plugin_scheduler 每 20 分钟（及启动后不久）向 worker 窗口 emit
//   "plugin-tick"，worker 自行判断是否到爬取间隔（读自身 data/ 下的 lastCrawl）。
// - worker 调 RdPlugin.notify(payload) → plugin_notify 命令 → emit "plugin-notification"
//   事件到主窗口，由前端 PluginNotificationCenter 弹 app 顶层对话窗/气泡。
// ==========================================

/// 插件日志：把 worker/页面里的 console 消息转发到 app 标准输出（便于排障）。
#[tauri::command]
pub fn plugin_log(app: AppHandle, plugin_id: String, message: String, level: Option<String>) -> Result<(), String> {
    let lv = level.unwrap_or_else(|| "info".to_string());
    println!("[插件 {}][{}] {}", plugin_id, lv, message);
    Ok(())
}

/// 通用 app 气泡提醒：给后台任务（arXiv 爬虫、Gmail 同步等）完成时弹顶层气泡。
/// 复用 "plugin-notification" 事件通道；payload 不带 pluginId（前端按 route 跳转、或不跳转）。
pub fn emit_app_bubble(app: &AppHandle, title: &str, body: &str, route: Option<&str>) {
    let mut obj = serde_json::Map::new();
    obj.insert("kind".to_string(), serde_json::json!("bubble"));
    obj.insert("title".to_string(), serde_json::json!(title));
    obj.insert("body".to_string(), serde_json::json!(body));
    if let Some(r) = route {
        obj.insert("route".to_string(), serde_json::json!(r));
    }
    println!("[通知] 气泡: {} | {}", title, body);
    let _ = app.emit("plugin-notification", serde_json::Value::Object(obj));
}

/// 插件通知：把 payload 以 "plugin-notification" 事件发到主窗口。
/// payload 形如 { title, body, kind: "dialog"|"bubble", level?, subject? }，
/// 由 worker 拼好、前端渲染。插件 plugin.json settings.notifyEnabled 显式为 false 时忽略。
#[tauri::command]
pub fn plugin_notify(app: AppHandle, plugin_id: String, payload: serde_json::Value) -> Result<(), String> {
    // 校验插件存在
    let plugin = match app.try_state::<Arc<AppState>>() {
        Some(s) => s.plugins.get(&plugin_id),
        None => None,
    };
    let plugin = plugin.ok_or_else(|| format!("插件不存在: {}", plugin_id))?;

    // 通知总开关：plugin.json settings.notifyEnabled = false 时静默忽略
    if let Some(settings) = plugin.settings.as_ref() {
        if settings.get("notifyEnabled").and_then(|v| v.as_bool()) == Some(false) {
            return Ok(());
        }
    }

    let mut obj = match payload {
        serde_json::Value::Object(o) => o,
        _ => return Err("payload 必须是 JSON 对象".to_string()),
    };
    if obj.get("kind").and_then(|v| v.as_str()).map(|k| k != "dialog" && k != "bubble").unwrap_or(false) {
        return Err("kind 只支持 dialog 或 bubble".to_string());
    }
    obj.insert("pluginId".to_string(), serde_json::json!(plugin_id));
    obj.insert("pluginName".to_string(), serde_json::json!(plugin.name));
    if !obj.contains_key("ts") {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        obj.insert("ts".to_string(), serde_json::json!(ts));
    }
    let kind = obj.get("kind").and_then(|v| v.as_str()).unwrap_or("?");
    let title = obj.get("title").and_then(|v| v.as_str()).unwrap_or("");
    println!("[插件] {} 发送提醒 (kind={}): {}", plugin_id, kind, title);
    let _ = app.emit("plugin-notification", serde_json::Value::Object(obj));
    Ok(())
}

/// 用系统默认浏览器/应用打开外部链接（插件页面里点会议官网/DBLP 用；走 app 已注册的 opener 插件）。
#[tauri::command]
pub fn plugin_open_url(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| format!("打开链接失败: {}", e))
}

/// 为指定插件启动隐藏 worker 窗口（label: plugin-worker-<id>，加载 rdp://<id>/worker 入口）。
/// 必须在主线程调用（Tauri/WKWebView 要求窗口创建在主线程）。
pub fn spawn_plugin_worker(app: &AppHandle, plugin_id: &str) -> Result<(), String> {
    let plugin = match app.try_state::<Arc<AppState>>() {
        Some(s) => s.plugins.get(plugin_id),
        None => None,
    };
    let plugin = plugin.ok_or_else(|| format!("插件不存在: {}", plugin_id))?;
    let worker_entry = plugin.worker_entry().ok_or_else(|| format!("插件 {} 没有 worker 入口", plugin_id))?;

    let label = format!("plugin-worker-{}", plugin_id);
    if app.get_webview_window(&label).is_some() {
        return Ok(()); // 已存在
    }

    let url: tauri::Url = format!("rdp://{}/{}", plugin_id, worker_entry)
        .parse()
        .map_err(|_| "worker URL 无效".to_string())?;
    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(format!("{} (worker)", plugin.name))
        .visible(false)
        .skip_taskbar(true)
        .focused(false)
        .build()
        .map_err(|e| format!("创建 worker 窗口失败: {}", e))?;
    println!("[插件] 已启动 {} 的后台 worker", plugin_id);
    Ok(())
}

/// 为所有声明了 worker 的插件拉起隐藏 worker 窗口（在 setup 主线程调用）。
pub fn spawn_all_workers(app: &AppHandle) {
    let plugins = match app.try_state::<Arc<AppState>>() {
        Some(s) => s.plugins.list(),
        None => return,
    };
    for plugin in plugins {
        if plugin.worker.is_some() && plugin.load_error.is_none() {
            if let Err(e) = spawn_plugin_worker(app, &plugin.id) {
                eprintln!("[插件] 拉起 worker 失败 ({}): {}", plugin.id, e);
            }
        }
    }
}

/// 后台调度：对每个声明了 worker 的插件，确保隐藏窗口存活并 emit "plugin-tick"。
/// 是否真正爬取由 worker 自己按间隔决定（读自身 data/ 下的 lastCrawl）。
fn tick_plugins(app: &AppHandle) {
    let plugins = match app.try_state::<Arc<AppState>>() {
        Some(s) => s.plugins.list(),
        None => return,
    };
    let worker_plugins: Vec<PluginInfo> = plugins
        .into_iter()
        .filter(|p| p.worker.is_some() && p.load_error.is_none())
        .collect();
    for plugin in worker_plugins {
        let id = plugin.id.clone();
        let app_for_closure = app.clone();
        // 窗口创建必须发生在主线程；用 run_on_main_thread 排队，成功后再发 tick
        let _ = app.run_on_main_thread(move || {
            if let Err(e) = spawn_plugin_worker(&app_for_closure, &id) {
                eprintln!("[插件调度] 启动 worker 失败 ({}): {}", id, e);
                return;
            }
            let label = format!("plugin-worker-{}", id);
            if let Some(win) = app_for_closure.get_webview_window(&label) {
                let _ = win.emit("plugin-tick", serde_json::json!({ "ts": 0 }));
            }
        });
    }
}

/// 启动插件后台调度器（独立 OS 线程 + 独立 Tokio runtime，与 crawler/gmail 调度器同款模式）。
/// 启动后 ~5 秒先 tick 一轮（首次爬取/worker 拉起），之后每 ~20 分钟一轮。
pub fn start_plugin_scheduler(app: AppHandle) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create plugin scheduler runtime");
        rt.block_on(async move {
            // 等 app 完全启动后再拉起 worker / 首轮 tick
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            tick_plugins(&app);
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(20 * 60)).await;
                tick_plugins(&app);
            }
        });
    });
}

// ==========================================
// 数据库 CRUD 接口（插件核心能力，全库全表、不鉴权）
// ==========================================

/// 把 serde_json 参数转成 rusqlite 值（只支持 null/bool/number/string）。
fn json_to_sql_values(params: Option<Vec<serde_json::Value>>) -> Result<Vec<rusqlite::types::Value>, String> {
    let mut out = Vec::new();
    for v in params.unwrap_or_default() {
        out.push(match v {
            serde_json::Value::Null => rusqlite::types::Value::Null,
            serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if b { 1 } else { 0 }),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    rusqlite::types::Value::Integer(i)
                } else {
                    rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
                }
            }
            serde_json::Value::String(s) => rusqlite::types::Value::Text(s),
            other => return Err(format!("不支持的参数类型: {}", other)),
        });
    }
    Ok(out)
}

/// 把 rusqlite 单值转成 serde_json。
fn sql_value_to_json(v: rusqlite::types::ValueRef) -> Result<serde_json::Value, String> {
    use rusqlite::types::ValueRef;
    Ok(match v {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(i) => serde_json::json!(i),
        ValueRef::Real(r) => serde_json::json!(r),
        ValueRef::Text(t) => serde_json::Value::String(String::from_utf8_lossy(t).to_string()),
        ValueRef::Blob(b) => {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(b);
            serde_json::Value::String(format!("blob:{}", b64))
        }
    })
}

/// 插件执行 SELECT 查询，返回行数组（列名 -> 值）。
#[tauri::command]
pub fn plugin_db_query(
    state: State<'_, Arc<AppState>>,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db_pool.get().map_err(|e| format!("获取数据库连接失败: {}", e))?;
    let values = json_to_sql_values(params)?;

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL 语法错误: {}", e))?;
    let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt
        .query(rusqlite::params_from_iter(values.iter()))
        .map_err(|e| format!("查询失败: {}", e))?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().map_err(|e| format!("读取行失败: {}", e))? {
        let mut obj = serde_json::Map::new();
        for (i, col) in cols.iter().enumerate() {
            let val = row.get_ref(i).map_err(|e| format!("读取列失败: {}", e))?;
            obj.insert(col.clone(), sql_value_to_json(val)?);
        }
        result.push(serde_json::Value::Object(obj));
    }
    Ok(result)
}

/// 插件执行 INSERT/UPDATE/DELETE（以及 DDL），返回受影响行数与 last insert id。
#[tauri::command]
pub fn plugin_db_exec(
    state: State<'_, Arc<AppState>>,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let conn = state.db_pool.get().map_err(|e| format!("获取数据库连接失败: {}", e))?;
    let values = json_to_sql_values(params)?;
    let rows_affected = conn
        .execute(&sql, rusqlite::params_from_iter(values.iter()))
        .map_err(|e| format!("执行失败: {}", e))?;
    let last_insert_id = conn.last_insert_rowid();
    Ok(serde_json::json!({ "rowsAffected": rows_affected, "lastInsertId": last_insert_id }))
}

// ==========================================
// 插件自己的 data 目录读写（仅限本插件 data/，杜绝越界）
// ==========================================

fn plugin_data_dir(plugin_id: &str) -> Result<PathBuf, String> {
    let dir = get_plugins_dir()?.join(plugin_id).join("data");
    fs::create_dir_all(&dir).map_err(|e| format!("创建插件数据目录失败: {}", e))?;
    Ok(dir)
}

/// 把相对路径解析到 base 目录内，规范化后校验前缀，防止 `..` 逃逸。
fn resolve_within(base: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("路径必须为相对路径".to_string());
    }
    let candidate = base.join(rel_path);
    let base_canon = base.canonicalize().map_err(|e| format!("读取插件数据目录失败: {}", e))?;
    let cand_canon = if candidate.exists() {
        candidate.canonicalize().map_err(|e| format!("解析路径失败: {}", e))?
    } else {
        let parent = candidate.parent().ok_or("无效路径")?;
        let parent_canon = parent.canonicalize().map_err(|e| format!("解析路径失败: {}", e))?;
        parent_canon.join(candidate.file_name().ok_or("无效路径")?)
    };
    if !cand_canon.starts_with(&base_canon) {
        return Err("路径越出插件数据目录".to_string());
    }
    Ok(cand_canon)
}

/// 读取插件 data 目录下的文本文件。
#[tauri::command]
pub fn plugin_read_file(plugin_id: String, path: String) -> Result<String, String> {
    let base = plugin_data_dir(&plugin_id)?;
    let file = resolve_within(&base, &path)?;
    fs::read_to_string(&file).map_err(|e| format!("读取失败: {}", e))
}

/// 写入插件 data 目录下的文本文件（自动建父目录）。
#[tauri::command]
pub fn plugin_write_file(plugin_id: String, path: String, content: String) -> Result<(), String> {
    let base = plugin_data_dir(&plugin_id)?;
    let file = resolve_within(&base, &path)?;
    if let Some(parent) = file.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    fs::write(&file, content).map_err(|e| format!("写入失败: {}", e))
}

// ==========================================
// 服务端 HTTP 抓取（绕开 iframe CORS）
// ==========================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginHttpResult {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

#[tauri::command]
pub async fn plugin_http(
    method: String,
    url: String,
    headers: Option<serde_json::Value>,
    body: Option<String>,
) -> Result<PluginHttpResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let m = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|_| format!("不支持的请求方法: {}", method))?;
    let mut req = client.request(m, &url);

    if let Some(h) = headers.and_then(|v| v.as_object().cloned()) {
        for (k, v) in h {
            if let Some(s) = v.as_str() {
                req = req.header(k, s);
            }
        }
    }
    if let Some(b) = body {
        req = req.body(b);
    }

    let resp = req.send().await.map_err(|e| format!("请求失败: {}", e))?;
    let status = resp.status().as_u16();
    let headers: Vec<(String, String)> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let text = resp.text().await.unwrap_or_default();
    Ok(PluginHttpResult { status, headers, body: text })
}

// ==========================================
// rdp:// 自定义协议：给插件 iframe 提供页面文件 + 内置 bridge.js
// ==========================================

/// 读取插件目录内文件；path 必须解析在插件目录内，防 `..` 逃逸。
fn read_plugin_file(plugin_id: &str, rel: &str) -> Result<Vec<u8>, ()> {
    let dir = get_plugins_dir().map_err(|_| ())?;
    let base = dir.join(plugin_id).canonicalize().map_err(|_| ())?;
    let candidate = base.join(rel);
    let canon = candidate.canonicalize().map_err(|_| ())?;
    if !canon.starts_with(&base) {
        return Err(());
    }
    fs::read(&canon).map_err(|_| ())
}

fn mime_for(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "wasm" => "application/wasm",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// rdp://<pluginId>/<path> 请求处理（rdp://core/bridge.js 返回内置桥）。
pub fn handle_rdp_request(request: tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let uri = request.uri().to_string();
    let rest = uri.strip_prefix("rdp://").unwrap_or(&uri);
    let (plugin_id, path) = match rest.split_once('/') {
        Some((id, p)) => (id.to_string(), p.to_string()),
        None => (rest.to_string(), "index.html".to_string()),
    };
    let path = if path.is_empty() { "index.html".to_string() } else { path };

    let bytes = if plugin_id == "core" && path == "bridge.js" {
        BRIDGE_JS.as_bytes().to_vec()
    } else if plugin_id == "core" && path == "worker-bridge.js" {
        WORKER_BRIDGE_JS.as_bytes().to_vec()
    } else if plugin_id == "core" {
        return tauri::http::Response::builder()
            .status(404).body(Vec::new()).unwrap_or_default();
    } else {
        match read_plugin_file(&plugin_id, &path) {
            Ok(b) => b,
            Err(_) => {
                return tauri::http::Response::builder()
                    .status(404).body(Vec::new()).unwrap_or_default();
            }
        }
    };

    tauri::http::Response::builder()
        .header("content-type", mime_for(&path))
        .header("access-control-allow-origin", "*")
        .body(bytes)
        .unwrap_or_default()
}

/// 内置桥：给插件 iframe 提供 window.RdPlugin（postMessage 调用 app 受控插件 API）。
pub const BRIDGE_JS: &str = r#"
(function () {
  if (window.RdPlugin) return;
  var pending = {};
  var seq = 0;
  // 插件 id：rdp://<pluginId>/... 的 host
  var PLUGIN_ID = (window.location && window.location.host) || '';
  // app 主题/语言上下文（由 app 通过 rdp-context 消息推送，供插件适配明暗主题与 i18n）
  var _ctx = { theme: 'light', lang: 'zh' };
  var _ctxListeners = [];
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.type === 'rdp-context') {
      if (e.data.theme) _ctx.theme = e.data.theme;
      if (e.data.lang) _ctx.lang = e.data.lang;
      document.documentElement.setAttribute('data-theme', _ctx.theme);
      document.documentElement.setAttribute('data-lang', _ctx.lang);
      _ctxListeners.forEach(function (fn) { try { fn(_ctx); } catch (err) {} });
      return;
    }
    if (e.data.type !== 'rdp-response') return;
    var p = pending[e.data.id];
    if (!p) return;
    delete pending[e.data.id];
    if (e.data.ok) p.resolve(e.data.data);
    else p.reject(new Error(e.data.error || 'unknown error'));
  });
  function invoke(cmd, args) {
    return new Promise(function (resolve, reject) {
      var id = 'm' + (++seq);
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({ type: 'rdp-request', id: id, cmd: cmd, args: args || {} }, '*');
      setTimeout(function () {
        if (pending[id]) { delete pending[id]; reject(new Error('插件调用超时: ' + cmd)); }
      }, 60000);
    });
  }
  window.RdPlugin = {
    db: {
      query: function (sql, params) { return invoke('plugin_db_query', { sql: sql, params: params || [] }); },
      exec: function (sql, params) { return invoke('plugin_db_exec', { sql: sql, params: params || [] }); }
    },
    data: {
      read: function (path) { return invoke('plugin_read_file', { pluginId: PLUGIN_ID, path: path }); },
      write: function (path, content) { return invoke('plugin_write_file', { pluginId: PLUGIN_ID, path: path, content: content }); }
    },
    http: {
      get: function (url, headers) { return invoke('plugin_http', { method: 'GET', url: url, headers: headers || {}, body: null }); },
      post: function (url, body, headers) { return invoke('plugin_http', { method: 'POST', url: url, headers: headers || {}, body: body || null }); }
    },
    open: function (url) { return invoke('plugin_open_url', { url: url }); },
    updateSettings: function (settings) { return invoke('plugin_update_settings', { pluginId: PLUGIN_ID, settings: settings || {} }); },
    get pluginId() { return PLUGIN_ID; },
    get theme() { return _ctx.theme; },           // 'light' | 'dark'
    get lang() { return _ctx.lang; },             // 'zh' | 'en'（app 当前语言）
    onContext: function (fn) { if (typeof fn === 'function') _ctxListeners.push(fn); }
  };
})();
"#;

/// worker 专用桥：给后台 worker 页面提供 window.RdPlugin。
/// worker 运行在隐藏 WebviewWindow 的顶层页（rdp://<pluginId>/worker.html），
/// 直接有 __TAURI_INTERNALS__，invoke 不再经 React postMessage 转发。
/// 额外提供 RdPlugin.notify（app 顶层提醒）与 RdPlugin.onTick（订阅 Rust 调度 tick）。
pub const WORKER_BRIDGE_JS: &str = r#"
(function () {
  if (window.RdPlugin) return;
  var inv = window.__TAURI_INTERNALS__;
  if (!inv || typeof inv.invoke !== 'function') {
    console.error('[worker-bridge] 缺少 __TAURI_INTERNALS__，后台 worker 无法调用 app 接口');
    return;
  }
  // rdp://<pluginId>/... 的 host 就是插件 id
  var PLUGIN_ID = window.__RDP_PLUGIN_ID__ || (window.location && window.location.host) || '';
  window.__RDP_PLUGIN_ID__ = PLUGIN_ID;

  function invoke(cmd, args) {
    return inv.invoke(cmd, args || {});
  }

  window.RdPlugin = {
    db: {
      query: function (sql, params) { return invoke('plugin_db_query', { sql: sql, params: params || [] }); },
      exec: function (sql, params) { return invoke('plugin_db_exec', { sql: sql, params: params || [] }); }
    },
    data: {
      read: function (path) { return invoke('plugin_read_file', { pluginId: PLUGIN_ID, path: path }); },
      write: function (path, content) { return invoke('plugin_write_file', { pluginId: PLUGIN_ID, path: path, content: content }); }
    },
    http: {
      get: function (url, headers) { return invoke('plugin_http', { method: 'GET', url: url, headers: headers || {}, body: null }); },
      post: function (url, body, headers) { return invoke('plugin_http', { method: 'POST', url: url, headers: headers || {}, body: body || null }); }
    },
    open: function (url) { return invoke('plugin_open_url', { url: url }); },
    // 把 worker 里的日志转发到 app 标准输出
    log: function (msg, level) { return invoke('plugin_log', { pluginId: PLUGIN_ID, message: String(msg), level: level || 'info' }); },
    // 发 app 顶层提醒：payload = { title, body, kind: 'dialog'|'bubble', level?, subject? }
    notify: function (payload) {
      return invoke('plugin_notify', { pluginId: PLUGIN_ID, payload: payload || {} });
    },
    // 订阅 Rust 调度器 tick（后台 worker 用它触发爬取）
    onTick: function (fn) {
      if (typeof fn !== 'function') return;
      if (inv.event && typeof inv.event.listen === 'function') {
        inv.event.listen('plugin-tick', function () {
          try { fn(); } catch (err) { console.error('[worker] tick 回调出错:', err); }
        });
      }
    },
    get pluginId() { return PLUGIN_ID; }
  };
})();
"#;

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rd_plugin_test_{}_{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn scans_valid_and_broken_plugins() {
        let dir = tmp_dir("scan");
        // 有效插件
        let good = dir.join("good");
        fs::create_dir_all(good.join("page")).unwrap();
        fs::write(good.join("plugin.json"), r#"{"id":"good","name":"Good Plugin","version":"1.0.0","hasPage":true}"#).unwrap();
        fs::write(good.join("page/index.html"), "<h1>hi</h1>").unwrap();
        // 缺 plugin.json
        let broken = dir.join("broken");
        fs::create_dir_all(&broken).unwrap();

        let plugins = scan_plugins_dir(&dir);
        assert_eq!(plugins.len(), 2);
        let good_p = plugins.iter().find(|p| p.id == "good").unwrap();
        assert!(good_p.load_error.is_none());
        assert_eq!(good_p.page_entry(), "page/index.html");
        let broken_p = plugins.iter().find(|p| p.id == "broken").unwrap();
        assert!(broken_p.load_error.is_some(), "缺 plugin.json 应记 load_error");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reject_path_traversal_outside_data_dir() {
        let dir = tmp_dir("escape");
        let data = dir.join("data");
        fs::create_dir_all(&data).unwrap();
        fs::write(dir.join("secret.txt"), "secret").unwrap();

        // 正常文件
        fs::write(data.join("a.txt"), "ok").unwrap();
        assert!(resolve_within(&data, "a.txt").is_ok());
        // 越界
        assert!(resolve_within(&data, "../secret.txt").is_err());
        assert!(resolve_within(&data, "sub/../../secret.txt").is_err());
        assert!(resolve_within(&data, "/etc/passwd").is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn db_crud_roundtrip() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE t(id INTEGER PRIMARY KEY, name TEXT)").unwrap();

        let params = json_to_sql_values(Some(vec![serde_json::json!("a"), serde_json::json!(1)])).unwrap();
        conn.execute("INSERT INTO t(name, id) VALUES (?, ?)", rusqlite::params_from_iter(params.iter())).unwrap();

        let rows: Vec<serde_json::Value> = {
            let mut stmt = conn.prepare("SELECT id, name FROM t").unwrap();
            let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
            let mut out = Vec::new();
            let mut q = stmt.query([]).unwrap();
            while let Some(row) = q.next().unwrap() {
                let mut obj = serde_json::Map::new();
                for (i, c) in cols.iter().enumerate() {
                    obj.insert(c.clone(), sql_value_to_json(row.get_ref(i).unwrap()).unwrap());
                }
                out.push(serde_json::Value::Object(obj));
            }
            out
        };
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["name"], "a");
        assert_eq!(rows[0]["id"], 1);
    }
}
