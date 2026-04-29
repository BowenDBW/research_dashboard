import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings, ConnectionTestResult, CloudProviderConfig, LocalProviderConfig } from '../types';

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
}

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
      // 真正连通后端，交由 Rust 发起网络请求去验证
      return await invoke<ConnectionTestResult>('test_connection', {
        providerId,
        providerType: type
      });
    } catch (err: any) {
      console.error('Backend connection test failed:', err);
      return { success: false, message: `后端无响应或发生错误: ${err.toString()}` };
    }
  },
}));

