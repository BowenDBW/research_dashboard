export interface ModelConfig {
  id: string;           // Unique identifier
  modelName: string;    // Internal model name (e.g., "gpt-4o", "claude-3-opus")
  displayName: string;  // User-facing display name (must be unique)
}

export interface CloudProviderConfig {
  id: string;           // Unique identifier
  name: string;         // Provider name (e.g., "OpenAI", "Anthropic")
  endpoint: string;     // API endpoint URL
  apiKey: string;       // API key
  models: ModelConfig[]; // List of models for this provider
}

export type LocalProviderType = 'server' | 'mlx';

export interface LocalProviderConfig {
  id: string;           // Unique identifier
  name: string;         // Provider name (e.g., "Ollama", "MLX")
  type: LocalProviderType;  // 'server' for Ollama-style, 'mlx' for Apple MLX
  endpoint: string;     // Local server endpoint (e.g., "http://localhost:11434") - empty for MLX
  models: ModelConfig[]; // List of models available locally
}

export interface AppSettings {
  crawlerCategories: string[]; // Arxiv category codes (e.g., "cs.AI", "cs.LG")
  crawlIntervalHours: number;
  lastCrawlTime?: string; // Add last crawl time
  pdfStoragePath: string; // Path for storing downloaded PDFs
  autoLaunch: boolean;
  // Cloud and local providers - both can be configured simultaneously
  cloudProviders: CloudProviderConfig[];
  localProviders: LocalProviderConfig[];
  // Currently selected model
  selectedModelId: string | null;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}
