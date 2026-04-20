import { create } from 'zustand';
import { HistoryRecord, HistoryFilters } from '../types';

// Mock data for prototype
const mockHistoryRecords: HistoryRecord[] = [
  {
    id: 'history-1',
    articleId: '1',
    article: {
      id: '1',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      source: 'arXiv',
      sourceType: 'arxiv',
      publishDate: '2023-06-12',
      abstract: 'We propose the Transformer...',
      url: 'https://arxiv.org/abs/1706.03762',
      pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf',
      domains: ['cs.LG', 'cs.AI'],
      isFavorited: true,
      metadata: {},
    },
    action: 'view_abstract',
    timestamp: '2024-01-10T14:30:00',
  },
  {
    id: 'history-2',
    articleId: '2',
    article: {
      id: '2',
      title: 'BERT: Pre-training',
      authors: ['Jacob Devlin'],
      source: 'arXiv',
      sourceType: 'arxiv',
      publishDate: '2023-05-20',
      abstract: 'BERT introduction...',
      url: 'https://arxiv.org/abs/1810.04805',
      pdfUrl: 'https://arxiv.org/pdf/1810.04805.pdf',
      domains: ['cs.CL'],
      isFavorited: false,
      metadata: {},
    },
    action: 'favorite',
    timestamp: '2024-01-10T10:15:00',
  },
  {
    id: 'history-3',
    articleId: '3',
    article: {
      id: '3',
      title: 'GPT-4 Technical Report',
      authors: ['OpenAI'],
      source: 'arXiv',
      sourceType: 'arxiv',
      publishDate: '2023-04-15',
      abstract: 'GPT-4 report...',
      url: 'https://arxiv.org/abs/2303.08774',
      pdfUrl: 'https://arxiv.org/pdf/2303.08774.pdf',
      domains: ['cs.AI'],
      isFavorited: false,
      metadata: {},
    },
    action: 'download',
    timestamp: '2024-01-09T16:00:00',
  },
];

interface HistoryStore {
  records: HistoryRecord[];
  totalCount: number;
  page: number;
  filters: HistoryFilters;
  loading: boolean;
  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
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
}));