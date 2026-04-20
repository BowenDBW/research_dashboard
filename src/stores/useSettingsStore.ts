import { create } from 'zustand';
import { AppSettings, ConnectionTestResult } from '../types';

interface SettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  testConnection: () => Promise<ConnectionTestResult>;
}

const defaultSettings: AppSettings = {
  crawlerSources: ['arxiv', 'semantic_scholar'],
  crawlIntervalHours: 4,
  databasePath: '/path/to/database',
  autoLaunch: false,
  llmType: 'cloud',
  cloudLlm: {
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
  },
  localLlm: {
    type: 'huggingface',
    modelName: '',
    modelPath: '',
  },
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

  testConnection: async () => {
    const { settings } = get();
    // Mock test for prototype
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (settings.llmType === 'cloud' && settings.cloudLlm.apiKey) {
      return { success: true, message: '连接成功！API Key 有效。' };
    }
    return { success: false, message: '请输入有效的 API Key' };
  },
}));