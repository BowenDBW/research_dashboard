import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings, ConnectionTestResult, CloudProviderConfig, LocalProviderConfig, StatsCardConfig } from '../types';

interface SettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  addCloudProvider: (provider: CloudProviderConfig) => Promise<void>;
  updateCloudProvider: (id: string, provider: Partial<CloudProviderConfig>) => Promise<void>;
  removeCloudProvider: (id: string) => Promise<void>;
  addLocalProvider: (provider: LocalProviderConfig) => Promise<void>;
  updateLocalProvider: (id: string, provider: Partial<LocalProviderConfig>) => Promise<void>;
  removeLocalProvider: (id: string) => Promise<void>;
  setSelectedModel: (modelId: string | null) => Promise<void>;
  testConnection: (providerId: string, type: 'cloud' | 'local') => Promise<ConnectionTestResult>;
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
  cloudProviders: [],
  localProviders: [],
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
    set((state) => {
      const newSettings = { ...state.settings, ...partial };
      // 异步通过 Rust 写入磁盘
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  addCloudProvider: async (provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        cloudProviders: [...state.settings.cloudProviders, provider],
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  updateCloudProvider: async (id, provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        cloudProviders: state.settings.cloudProviders.map((p) =>
          p.id === id ? { ...p, ...provider } : p
        ),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  removeCloudProvider: async (id) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        cloudProviders: state.settings.cloudProviders.filter((p) => p.id !== id),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  addLocalProvider: async (provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        localProviders: [...state.settings.localProviders, provider],
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  updateLocalProvider: async (id, provider) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        localProviders: state.settings.localProviders.map((p) =>
          p.id === id ? { ...p, ...provider } : p
        ),
      };
      invoke('save_settings', { settings: newSettings }).catch(console.error);
      return { settings: newSettings };
    });
  },

  removeLocalProvider: async (id) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        localProviders: state.settings.localProviders.filter((p) => p.id !== id),
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

