import { create } from 'zustand';
import { HistoryRecord, HistoryFilters, StatsData, HeatmapCell, WeeklyHourData, DailyHourData, DomainDistribution, KeywordItem } from '../types';

// Helper to generate random dates within a range
const randomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate mock history records with more data for stats
const generateMockHistoryRecords = (): HistoryRecord[] => {
  const actions: HistoryRecord['action'][] = ['view_abstract', 'view_source', 'favorite', 'chat'];
  const articles = [
    { title: 'Attention Is All You Need', authors: ['Ashish Vaswani', 'Noam Shazeer'], domains: ['cs.LG', 'cs.AI'] },
    { title: 'BERT: Pre-training of Deep Bidirectional Transformers', authors: ['Jacob Devlin'], domains: ['cs.CL'] },
    { title: 'GPT-4 Technical Report', authors: ['OpenAI'], domains: ['cs.AI', 'cs.CL'] },
    { title: 'Language Models are Few-Shot Learners', authors: ['Tom Brown', 'Benjamin Mann'], domains: ['cs.LG', 'cs.CL'] },
    { title: 'Deep Residual Learning for Image Recognition', authors: ['Kaiming He', 'Xiangyu Zhang'], domains: ['cs.CV'] },
    { title: 'Generative Adversarial Networks', authors: ['Ian Goodfellow'], domains: ['cs.LG', 'cs.CV'] },
    { title: 'Adam: A Method for Stochastic Optimization', authors: ['Diederik Kingma', 'Jimmy Ba'], domains: ['cs.LG'] },
    { title: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting', authors: ['Nitish Srivastava'], domains: ['cs.LG', 'cs.NE'] },
    { title: 'Batch Normalization: Accelerating Deep Network Training', authors: ['Sergey Ioffe', 'Christian Szegedy'], domains: ['cs.LG'] },
    { title: 'U-Net: Convolutional Networks for Biomedical Image Segmentation', authors: ['Olaf Ronneberger'], domains: ['cs.CV'] },
    { title: 'Transformer-XL: Attentive Language Models Beyond a Fixed-Length Context', authors: ['Zihang Dai'], domains: ['cs.CL', 'cs.LG'] },
    { title: 'RoBERTa: A Robustly Optimized BERT Pretraining Approach', authors: ['Yinhan Liu'], domains: ['cs.CL'] },
    { title: 'XLNet: Generalized Autoregressive Pretraining', authors: ['Zhilin Yang'], domains: ['cs.CL', 'cs.LG'] },
    { title: 'ALBERT: A Lite BERT for Self-supervised Learning', authors: ['Zhenzhong Lan'], domains: ['cs.CL'] },
    { title: 'ELECTRA: Pre-training Text Encoders as Discriminators', authors: ['Kevin Clark'], domains: ['cs.CL', 'cs.LG'] },
    { title: 'T5: Exploring the Limits of Transfer Learning', authors: ['Colin Raffel'], domains: ['cs.CL', 'cs.LG'] },
    { title: 'BART: Denoising Sequence-to-Sequence Pre-training', authors: ['Mike Lewis'], domains: ['cs.CL'] },
    { title: 'Vision Transformer (ViT)', authors: ['Alexey Dosovitskiy'], domains: ['cs.CV', 'cs.LG'] },
    { title: 'Swin Transformer: Hierarchical Vision Transformer', authors: ['Ze Liu'], domains: ['cs.CV'] },
    { title: 'DALL-E: Creating Images from Text', authors: ['OpenAI'], domains: ['cs.CV', 'cs.AI'] },
  ];

  const records: HistoryRecord[] = [];
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Generate records for the past 30 days
  for (let i = 0; i < 85; i++) {
    const article = articles[Math.floor(Math.random() * articles.length)];
    const timestamp = randomDate(monthAgo, now);
    const id = `history-${i}`;

    records.push({
      id,
      articleId: `${i}`,
      article: {
        id: `${i}`,
        title: article.title,
        authors: article.authors,
        source: 'arXiv',
        sourceType: 'arxiv',
        publishDate: '2023-06-12',
        abstract: `This is the abstract for ${article.title}. We propose a novel approach to...`,
        url: `https://arxiv.org/abs/${1000 + i}`,
        pdfUrl: `https://arxiv.org/pdf/${1000 + i}.pdf`,
        domains: article.domains,
        isFavorited: Math.random() > 0.7,
        metadata: {},
      },
      action: actions[Math.floor(Math.random() * actions.length)],
      timestamp: timestamp.toISOString(),
    });
  }

  // Sort by timestamp descending
  return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const mockHistoryRecords = generateMockHistoryRecords();

interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  filters: HistoryFilters;
  loading: boolean;
  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  getStatsData: (dateRange?: { start: Date; end: Date }) => StatsData;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  records: mockHistoryRecords,
  totalCount: mockHistoryRecords.length,
  page: 1,
  filters: {
    dateRange: [null, null],
    actions: [],
  },
  loading: false,

  fetchRecords: async () => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ loading: false });
  },

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  getStatsData: (dateRange?: { start: Date; end: Date }) => {
    const records = get().records;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Use provided date range or default to last 30 days
    const startDate = dateRange?.start ?? new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end ?? today;
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter records by date range
    const rangeRecords = records.filter(r => {
      const rDate = new Date(r.timestamp);
      return rDate >= startDate && rDate <= new Date(endDate.getTime() + 23 * 60 * 60 * 1000);
    });

    // Calculate basic stats
    const todayRecords = records.filter(r => new Date(r.timestamp) >= today);
    const weekRecords = records.filter(r => new Date(r.timestamp) >= weekAgo);
    const rangeCount = rangeRecords.length;

    const todayCount = todayRecords.length;
    const weekCount = weekRecords.length;
    const rangeFavorites = rangeRecords.filter(r => r.action === 'favorite').length;
    const rangeChats = rangeRecords.filter(r => r.action === 'chat').length;
    const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const avgDailyCount = Math.round(rangeCount / daysInRange * 10) / 10;

    // Hourly distribution (24 hours)
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: rangeRecords.filter(r => new Date(r.timestamp).getHours() === hour).length,
    }));

    // Weekly hour data (7 days x 24 hours)
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weeklyHourData: WeeklyHourData[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let hour = 0; hour < 24; hour++) {
        const count = rangeRecords.filter(r => {
          const date = new Date(r.timestamp);
          return date.getDay() === dayIndex && date.getHours() === hour;
        }).length;
        weeklyHourData.push({
          day: dayNames[dayIndex],
          dayIndex,
          hour,
          count,
        });
      }
    }

    // Domain distribution
    const domainCounts: Record<string, number> = {};
    rangeRecords.forEach(r => {
      r.article.domains.forEach(domain => {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
    });
    const domainDistribution: DomainDistribution[] = Object.entries(domainCounts)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: rangeRecords.length > 0 ? Math.round(count / rangeRecords.length * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Keywords from titles
    const stopWords = new Set(['a', 'an', 'the', 'for', 'of', 'and', 'to', 'in', 'on', 'with', 'from', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but', 'if', 'or', 'as', 'until', 'while', 'at', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);

    const wordCounts: Record<string, number> = {};
    rangeRecords.forEach(r => {
      const words = r.article.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      words.forEach(word => {
        if (word.length > 2 && !stopWords.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    const keywords: KeywordItem[] = Object.entries(wordCounts)
      .filter(([_, count]) => count >= 2)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    // Heatmap data for the selected date range
    const heatmapData: HeatmapCell[] = [];
    const totalDays = daysInRange;
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = records.filter(r => {
        const rDate = new Date(r.timestamp);
        return rDate.getFullYear() === date.getFullYear() &&
               rDate.getMonth() === date.getMonth() &&
               rDate.getDate() === date.getDate();
      }).length;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
      heatmapData.push({ date: dateStr, count, level });
    }

    // Daily hour data (30 days x 24 hours)
    const dailyHourData: DailyHourData[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      for (let hour = 0; hour < 24; hour++) {
        const count = rangeRecords.filter(r => {
          const rDate = new Date(r.timestamp);
          return rDate.getFullYear() === date.getFullYear() &&
                 rDate.getMonth() === date.getMonth() &&
                 rDate.getDate() === date.getDate() &&
                 rDate.getHours() === hour;
        }).length;
        dailyHourData.push({ date: dateStr, hour, count });
      }
    }

    return {
      readingStats: {
        todayCount,
        weekCount,
        monthCount: rangeCount,
        totalFavorites: rangeFavorites,
        totalChats: rangeChats,
        avgDailyCount,
      },
      hourlyDistribution,
      weeklyHourData,
      dailyHourData,
      domainDistribution,
      keywords,
      heatmapData,
    };
  },
}));
