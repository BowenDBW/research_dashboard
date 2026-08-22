import { GmailConfig } from './gmail';

export interface ModelConfig {
  id: string;           // Unique identifier
  modelName: string;    // 端口服务：发给 OpenAI 兼容 API 的模型名（如 "gpt-4o"）；MLX：模型路径
  displayName: string;  // User-facing display name (must be unique)
}

// OpenAI 兼容端口服务（Ollama / 云端 API 通用，不区分本地或云端）
export interface PortProviderConfig {
  id: string;           // Unique identifier
  name: string;         // Service name (e.g., "Ollama", "DeepSeek")
  endpoint: string;     // Base URL，例如 "http://127.0.0.1:11434" 或 "https://api.openai.com/v1"
  apiKey: string;       // API key（Ollama 等本地服务可留空）
  models: ModelConfig[]; // List of models for this service
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
  dbPath?: string; // Custom database file path (empty = default ~/.research_dashboard/research_dashboard.db)
  autoLaunch: boolean;
  // 点 X 关闭窗口时的行为: 'exit' 直接退出 / 'minimize' 最小化到托盘 / null 每次询问
  closeBehavior?: 'exit' | 'minimize' | null;
  // LLM 两类配置：MLX 本地模型 + OpenAI 兼容端口服务（Ollama / 云端 API 通用）
  mlxModels: ModelConfig[];           // Apple MLX 模型列表（modelName 存模型路径）
  portProviders: PortProviderConfig[]; // OpenAI 兼容端口服务
  // Currently selected model
  selectedModelId: string | null;
  // Stats card configuration
  statsCardConfig?: StatsCardConfig;
  // Gmail configuration
  gmail?: GmailConfig;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}
