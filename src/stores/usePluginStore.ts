import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { PluginInfo } from '../types/plugin';

interface PluginStore {
  plugins: PluginInfo[];
  loading: boolean;
  /** 首次 loadPlugins 完成后为 true（用于延迟加载依赖插件列表的布局等） */
  loaded: boolean;
  loadPlugins: () => Promise<void>;
  reloadPlugins: () => Promise<void>;
}

export const usePluginStore = create<PluginStore>((set) => ({
  plugins: [],
  loading: false,
  loaded: false,

  loadPlugins: async () => {
    try {
      const plugins = await invoke<PluginInfo[]>('plugins_list');
      set({ plugins, loading: false, loaded: true });
    } catch (err) {
      console.error('加载插件列表失败:', err);
      set({ loading: false, loaded: true });
    }
  },

  reloadPlugins: async () => {
    set({ loading: true });
    try {
      const plugins = await invoke<PluginInfo[]>('plugins_reload');
      set({ plugins, loading: false, loaded: true });
    } catch (err) {
      console.error('重新扫描插件失败:', err);
      set({ loading: false, loaded: true });
    }
  },
}));

// 后端扫描完成（启动 / 目录转移 / 手动重扫）后刷新插件列表
let pluginsChangedListener: UnlistenFn | null = null;

export async function initPluginEventListeners() {
  if (pluginsChangedListener) return;
  pluginsChangedListener = await listen('plugins-changed', () => {
    usePluginStore.getState().loadPlugins();
  });
}
