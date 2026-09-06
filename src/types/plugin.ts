/** 插件元信息（对应后端 plugin::PluginInfo，camelCase） */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon?: string;
  hasPage: boolean;
  entry?: string;
  /** 插件配置项（plugin.json 一级键 "settings" 下的键值对），设置界面可编辑 */
  settings?: Record<string, unknown>;
  dir: string;
  /** 插件资源 URL 前缀：拼页面/图标等完整 URL（macOS: rdp://<id>，Windows: http://rdp.<id>） */
  urlBase?: string;
  loadError?: string;
}
