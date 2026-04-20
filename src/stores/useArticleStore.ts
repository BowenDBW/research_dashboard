import { create } from 'zustand';
import { Article, ArticleFilters, PaginatedArticles } from '../types';

// Mock data for prototype
const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2023-06-12',
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    url: 'https://arxiv.org/abs/1706.03762',
    pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf',
    domains: ['cs.LG', 'cs.AI'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2023-05-20',
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations by jointly conditioning on both left and right context in all layers.',
    url: 'https://arxiv.org/abs/1810.04805',
    pdfUrl: 'https://arxiv.org/pdf/1810.04805.pdf',
    domains: ['cs.CL', 'cs.AI'],
    isFavorited: true,
    metadata: {},
  },
  {
    id: '3',
    title: 'GPT-4 Technical Report',
    authors: ['OpenAI'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2023-04-15',
    abstract: 'We report the development of GPT-4, a large-scale, multimodal model which can accept image and text inputs and produce text outputs. While less capable than humans in many real-world scenarios, GPT-4 exhibits human-level performance on various professional and academic benchmarks.',
    url: 'https://arxiv.org/abs/2303.08774',
    pdfUrl: 'https://arxiv.org/pdf/2303.08774.pdf',
    domains: ['cs.AI', 'cs.LG'],
    isFavorited: false,
    metadata: {},
  },
];

interface ArticleStore {
  articles: Article[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: ArticleFilters;
  loading: boolean;
  setFilters: (filters: Partial<ArticleFilters>) => void;
  fetchArticles: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const useArticleStore = create<ArticleStore>((set, get) => ({
  articles: mockArticles,
  totalCount: mockArticles.length,
  page: 1,
  pageSize: 10,
  filters: {
    dateRange: [null, null],
    sources: [],
    author: '',
    domains: [],
  },
  loading: false,

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  fetchArticles: async () => {
    set({ loading: true });
    // Mock delay for prototype
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { filters } = get();
    let filtered = mockArticles;

    if (filters.author) {
      filtered = filtered.filter((a) =>
        a.authors.some((author) => author.toLowerCase().includes(filters.author.toLowerCase()))
      );
    }
    if (filters.sources.length > 0) {
      filtered = filtered.filter((a) => filters.sources.includes(a.source));
    }
    if (filters.domains.length > 0) {
      filtered = filtered.filter((a) => a.domains.some((d) => filters.domains.includes(d)));
    }

    set({ articles: filtered, totalCount: filtered.length, loading: false });
  },

  setPage: (page) => set({ page }),
  setPageSize: (size) => set({ pageSize: size, page: 1 }),
}));