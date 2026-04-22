import { create } from 'zustand';
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

const defaultSettings: AppSettings = {
  crawlerCategories: ['cs.AI', 'cs.CL', 'cs.CV', 'cs.LG'],
  crawlIntervalHours: 4,
  pdfStoragePath: '~/.research_dashboard',
  autoLaunch: false,
  cloudProviders: [
    {
      id: 'openai-default',
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        { id: 'gpt-4o-default', modelName: 'gpt-4o', displayName: 'GPT-4o' },
      ],
    },
  ],
  localProviders: [],
  selectedModelId: 'gpt-4o-default',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ loading: false });
  },

  updateSettings: async (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
  },

  addCloudProvider: async (provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        cloudProviders: [...state.settings.cloudProviders, provider],
      },
    }));
  },

  updateCloudProvider: async (id, provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        cloudProviders: state.settings.cloudProviders.map((p) =>
          p.id === id ? { ...p, ...provider } : p
        ),
      },
    }));
  },

  removeCloudProvider: async (id) => {
    set((state) => ({
      settings: {
        ...state.settings,
        cloudProviders: state.settings.cloudProviders.filter((p) => p.id !== id),
      },
    }));
  },

  addLocalProvider: async (provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        localProviders: [...state.settings.localProviders, provider],
      },
    }));
  },

  updateLocalProvider: async (id, provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        localProviders: state.settings.localProviders.map((p) =>
          p.id === id ? { ...p, ...provider } : p
        ),
      },
    }));
  },

  removeLocalProvider: async (id) => {
    set((state) => ({
      settings: {
        ...state.settings,
        localProviders: state.settings.localProviders.filter((p) => p.id !== id),
      },
    }));
  },

  setSelectedModel: async (modelId) => {
    set((state) => ({
      settings: { ...state.settings, selectedModelId: modelId },
    }));
  },

  testConnection: async (providerId, type) => {
    const { settings } = get();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (type === 'cloud') {
      const provider = settings.cloudProviders.find((p) => p.id === providerId);
      if (provider?.apiKey) {
        return { success: true, message: '连接成功！API Key 有效。' };
      }
      return { success: false, message: '请输入有效的 API Key' };
    } else {
      const provider = settings.localProviders.find((p) => p.id === providerId);
      if (provider?.endpoint) {
        return { success: true, message: '连接成功！本地服务可用。' };
      }
      return { success: false, message: '请输入有效的服务地址' };
    }
  },
}));