import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { AppSettings, ConnectionTestResult, PortProviderConfig, ModelConfig, StatsCardConfig } from '../types';

interface SettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  addPortProvider: (provider: PortProviderConfig) => Promise<void>;
  updatePortProvider: (id: string, provider: Partial<PortProviderConfig>) => Promise<void>;
  removePortProvider: (id: string) => Promise<void>;
  addMlxModel: (model: ModelConfig) => Promise<void>;
  updateMlxModel: (id: string, model: Partial<ModelConfig>) => Promise<void>;
  removeMlxModel: (id: string) => Promise<void>;
  setSelectedModel: (modelId: string | null) => Promise<void>;
  testConnection: (providerId: string, type: 'mlx' | 'port') => Promise<ConnectionTestResult>;
  updateStatsCardConfig: (config: StatsCardConfig) => Promise<void>;
}

const DEFAULT_STATS_CARD_CONFIG: StatsCardConfig = {
  cards: [
    { id: 'view-today-1', type: 'view_today', enabled: true },
    { id: 'read-today-1', type: 'read_today', enabled: true },
    { id: 'view-week-1', type: 'view_week', enabled: true },
    { id: 'read-week-1', type: 'read_week', enabled: true },
  ],
  sidebarCards: [
    { id: 'sidebar-view-today-1', type: 'view_today', enabled: true },
    { id: 'sidebar-favorite-total-1', type: 'favorite_total', enabled: true },
  ],
};

// 仅保留一个空壳占位符，防止在 Rust 数据返回前 React 渲染报错（不要再在这里手写假数据了！）
const emptyState: AppSettings = {
  crawlerCategories: [],
  crawlIntervalHours: 4,
  lastCrawlTime: undefined,
  pdfStoragePath: '',
  autoLaunch: false,
  closeBehavior: null,
  mlxModels: [],
  portProviders: [],
  selectedModelId: null,
  statsCardConfig: DEFAULT_STATS_CARD_CONFIG,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: emptyState,
  loading: true,

  loadSettings: async () => {
    set({ loading: true });

    try {
      // 100% 依赖 Tauri/Rust 返回真实数据，没有兜底逻辑和假合并了
      const savedSettings = await invoke<AppSettings>('get_settings');
      set({ settings: savedSettings });
    } catch (err) {
      console.error('Failed to load settings from Rust backend', err);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    // Await the disk write so callers (e.g. before authorize/sync) can rely on persistence
    try {
      await invoke('save_settings', { settings: newSettings });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },

  addPortProvider: async (provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        portProviders: [...state.settings.portProviders, provider],
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  updatePortProvider: async (id, provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        portProviders: state.settings.portProviders.map((p) =>
          p.id === id ? { ...p, ...provider } : p
        ),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  removePortProvider: async (id) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        portProviders: state.settings.portProviders.filter((p) => p.id !== id),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  addMlxModel: async (model) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        mlxModels: [...state.settings.mlxModels, model],
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  updateMlxModel: async (id, model) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        mlxModels: state.settings.mlxModels.map((m) =>
          m.id === id ? { ...m, ...model } : m
        ),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  removeMlxModel: async (id) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        mlxModels: state.settings.mlxModels.filter((m) => m.id !== id),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  setSelectedModel: async (modelId) => {
    set((state) => {
      const newSettings = { ...state.settings, selectedModelId: modelId };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  testConnection: async (providerId, type) => {
    try {
      // Pass current settings to backend for connection test
      const { settings } = get();
      return await invoke<ConnectionTestResult>('test_connection', {
        providerId,
        providerType: type,
        settings,
      });
    } catch (err: any) {
      console.error('Backend connection test failed:', err);
      return { success: false, message: `后端无响应或发生错误: ${err.toString()}` };
    }
  },

  updateStatsCardConfig: async (config) => {
    set((state) => {
      const newSettings = { ...state.settings, statsCardConfig: config };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },
}));

// 监听后端事件，刷新设置
let crawlerFinishedListener: UnlistenFn | null = null;
let settingsChangedListener: UnlistenFn | null = null;

export async function initSettingsEventListeners() {
  if (crawlerFinishedListener || settingsChangedListener) return; // Already initialized

  // 后端爬取完成事件：刷新设置（让 lastCrawlTime 显示最新值，无论手动还是定时爬取）
  crawlerFinishedListener = await listen('crawler-finished', () => {
    useSettingsStore.getState().loadSettings();
  });

  // 后端直接修改设置文件（如点 X 选择关闭行为后）时通知前端刷新，
  // 避免前端 store 中的旧值在打开设置界面时覆盖磁盘上的新值
  settingsChangedListener = await listen('settings-changed', () => {
    useSettingsStore.getState().loadSettings();
  });
}
