export interface ModelConfig {
  id: string;           // Unique identifier
  modelName: string;    // Internal model name (e.g., "gpt-4o", "claude-3-opus")
  displayName: string;  // User-facing display name (must be unique)
  modelPath?: string;   // Model path for MLX models (e.g., "/Users/bowen/models/gemma-4-26b-a4b-it-4bit")
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

// Stats card types with time range
export type StatsCardType =
  | 'view_today' | 'view_week' | 'view_30days' | 'view_month'
  | 'read_today' | 'read_week' | 'read_30days' | 'read_month'
  | 'favorite_week' | 'favorite_30days' | 'favorite_total'
  | 'chat_week' | 'chat_30days' | 'chat_total';

export interface StatsCardItem {
  id: string;
  type: StatsCardType;
  enabled: boolean;
}

export interface StatsCardConfig {
  cards: StatsCardItem[];  // Max 8 cards (4x2 layout)
  sidebarCards: StatsCardItem[];  // Max 2 cards for sidebar
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
  // Stats card configuration
  statsCardConfig?: StatsCardConfig;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}
