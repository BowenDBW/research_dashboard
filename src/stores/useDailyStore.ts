import { create } from 'zustand';
import { DailyRecommendation, DailyRecommendationListItem } from '../types';
import { Article } from '../types';

interface DailyStore {
  recommendations: DailyRecommendationListItem[];
  currentRecommendation: DailyRecommendation | null;
  loading: boolean;
  totalRecommendations: number;

  // Actions
  fetchRecommendations: (page: number, pageSize: number, searchMonth?: string) => Promise<void>;
  fetchRecommendationById: (id: string) => Promise<DailyRecommendation | null>;
  getRecentRecommendations: () => DailyRecommendationListItem[];
}

// Mock articles for recommendations
const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2017',
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    url: 'https://arxiv.org/abs/1706.03762',
    pdfUrl: 'https://arxiv.org/pdf/1706.03762',
    domains: ['cs.LG', 'cs.CL'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Devlin et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2018',
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text.',
    url: 'https://arxiv.org/abs/1810.04805',
    pdfUrl: 'https://arxiv.org/pdf/1810.04805',
    domains: ['cs.CL'],
    isFavorited: true,
    metadata: {},
  },
  {
    id: '3',
    title: 'GPT-4 Technical Report',
    authors: ['OpenAI'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2023',
    abstract: 'We report the development of GPT-4, a large-scale, multimodal model which can accept image and text inputs and produce text outputs. While less capable than humans in many real-world scenarios, GPT-4 exhibits human-level performance on various professional and academic benchmarks.',
    url: 'https://arxiv.org/abs/2303.08774',
    pdfUrl: 'https://arxiv.org/pdf/2303.08774',
    domains: ['cs.AI', 'cs.CL'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '4',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: ['Hu et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2021',
    abstract: 'We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks.',
    url: 'https://arxiv.org/abs/2106.09685',
    pdfUrl: 'https://arxiv.org/pdf/2106.09685',
    domains: ['cs.LG', 'cs.CL'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '5',
    title: 'Chain-of-Thought Prompting Elicits Reasoning',
    authors: ['Wei et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2022',
    abstract: 'We explore how generating a chain of thought—a series of intermediate reasoning steps—significantly improves the ability of large language models to perform complex reasoning. We show that chain-of-thought prompting improves performance on a range of arithmetic, commonsense, and symbolic reasoning tasks.',
    url: 'https://arxiv.org/abs/2201.11903',
    pdfUrl: 'https://arxiv.org/pdf/2201.11903',
    domains: ['cs.AI', 'cs.CL'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '6',
    title: 'Constitutional AI: Harmlessness from AI Feedback',
    authors: ['Bai et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2022',
    abstract: 'As AI systems become more capable, we would like to enlist their help to supervise other AI agents. We explore methods for training AI systems to be helpful and harmless through a process called Constitutional AI.',
    url: 'https://arxiv.org/abs/2212.08073',
    pdfUrl: 'https://arxiv.org/pdf/2212.08073',
    domains: ['cs.AI', 'cs.LG'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '7',
    title: 'Vision Transformer: An Image is Worth 16x16 Words',
    authors: ['Dosovitskiy et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2020',
    abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. In vision, attention is either applied in conjunction with convolutional networks, or used to replace certain components of convolutional networks while keeping their overall structure in place. We show that this reliance on CNNs is not necessary and a pure transformer applied directly to sequences of image patches can perform very well on image classification tasks.',
    url: 'https://arxiv.org/abs/2010.11929',
    pdfUrl: 'https://arxiv.org/pdf/2010.11929',
    domains: ['cs.CV', 'cs.LG'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '8',
    title: 'DALL-E: Zero-Shot Text-to-Image Generation',
    authors: ['Ramesh et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2021',
    abstract: 'Text-to-image generation has traditionally focused on finding better modeling assumptions for training on a fixed dataset. We present DALL·E, a transformer that generates images from text tokens, achieving zero-shot performance competitive with state-of-the-art models.',
    url: 'https://arxiv.org/abs/2102.12092',
    pdfUrl: 'https://arxiv.org/pdf/2102.12092',
    domains: ['cs.CV', 'cs.LG'],
    isFavorited: false,
    metadata: {},
  },
];

// Helper to get random subset of articles
const getRandomArticles = (count: number): Article[] => {
  const shuffled = [...mockArticles].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Mock data for prototype
const mockRecommendations: DailyRecommendationListItem[] = [
  { id: 'rec-2024-01-15', date: '2024-01-15', articleCount: 6 },
  { id: 'rec-2024-01-14', date: '2024-01-14', articleCount: 4 },
  { id: 'rec-2024-01-13', date: '2024-01-13', articleCount: 8 },
  { id: 'rec-2024-01-12', date: '2024-01-12', articleCount: 5 },
  { id: 'rec-2024-01-11', date: '2024-01-11', articleCount: 7 },
  { id: 'rec-2024-01-10', date: '2024-01-10', articleCount: 6 },
  { id: 'rec-2024-01-09', date: '2024-01-09', articleCount: 4 },
  { id: 'rec-2024-01-08', date: '2024-01-08', articleCount: 5 },
];

export const useDailyStore = create<DailyStore>((set) => ({
  recommendations: mockRecommendations,
  currentRecommendation: null,
  loading: false,
  totalRecommendations: mockRecommendations.length,

  fetchRecommendations: async (page: number, pageSize: number, searchMonth?: string) => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = mockRecommendations;
    if (searchMonth) {
      // Filter by month prefix (YYYY-MM)
      filtered = mockRecommendations.filter((r) => r.date.startsWith(searchMonth));
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    set({
      recommendations: paginated,
      totalRecommendations: filtered.length,
      loading: false,
    });
  },

  fetchRecommendationById: async (id: string) => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const recItem = mockRecommendations.find((r) => r.id === id);
    if (!recItem) {
      set({ loading: false, currentRecommendation: null });
      return null;
    }

    const recommendation: DailyRecommendation = {
      ...recItem,
      articles: getRandomArticles(recItem.articleCount),
      createdAt: `${recItem.date}T00:00:00`,
      updatedAt: `${recItem.date}T00:00:00`,
    };

    set({ currentRecommendation: recommendation, loading: false });
    return recommendation;
  },

  getRecentRecommendations: () => {
    return mockRecommendations.slice(0, 5);
  },
}));