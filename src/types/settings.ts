export interface AppSettings {
  crawlerSources: string[];
  crawlIntervalHours: number;
  databasePath: string;
  autoLaunch: boolean;
  llmType: 'cloud' | 'local';
  cloudLlm: CloudLlmConfig;
  localLlm: LocalLlmConfig;
}

export interface CloudLlmConfig {
  endpoint: string;
  apiKey: string;
}

export interface LocalLlmConfig {
  type: 'huggingface' | 'path';
  modelName: string;
  modelPath: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}