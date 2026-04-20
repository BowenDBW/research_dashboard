import { create } from 'zustand';
import { FavoriteItem, FolderNode, FavoriteClipboard } from '../types';

// Mock data for prototype
const mockFavoriteItems: FavoriteItem[] = [
  {
    id: 'folder-1',
    type: 'folder',
    name: 'Machine Learning',
    parentId: null,
    createdAt: '2024-01-01',
    children: [
      {
        id: 'file-1',
        type: 'file',
        name: 'Attention Is All You Need',
        parentId: 'folder-1',
        createdAt: '2024-01-02',
        article: {
          id: '1',
          title: 'Attention Is All You Need',
          authors: ['Ashish Vaswani', 'Noam Shazeer'],
          source: 'arXiv',
          sourceType: 'arxiv',
          publishDate: '2023-06-12',
          abstract: 'We propose the Transformer architecture...',
          url: 'https://arxiv.org/abs/1706.03762',
          pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf',
          domains: ['cs.LG', 'cs.AI'],
          isFavorited: true,
          metadata: {},
        },
      },
    ],
  },
  {
    id: 'folder-2',
    type: 'folder',
    name: 'NLP Papers',
    parentId: null,
    createdAt: '2024-01-05',
  },
  {
    id: 'file-2',
    type: 'file',
    name: 'BERT: Pre-training of Deep Bidirectional Transformers',
    parentId: null,
    createdAt: '2024-01-10',
    article: {
      id: '2',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers',
      authors: ['Jacob Devlin', 'Ming-Wei Chang'],
      source: 'arXiv',
      sourceType: 'arxiv',
      publishDate: '2023-05-20',
      abstract: 'We introduce BERT...',
      url: 'https://arxiv.org/abs/1810.04805',
      pdfUrl: 'https://arxiv.org/pdf/1810.04805.pdf',
      domains: ['cs.CL', 'cs.AI'],
      isFavorited: true,
      metadata: {},
    },
  },
];

interface FavoriteStore {
  currentFolderId: string | null;
  folderPath: FolderNode[];
  items: FavoriteItem[];
  clipboard: FavoriteClipboard | null;
  loading: boolean;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<string>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cutFolder: (folderId: string) => void;
  pasteFolder: (targetParentId: string | null) => Promise<void>;
  addFavorite: (article: any, folderId: string | null) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
}

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  currentFolderId: null,
  folderPath: [{ id: null, name: '根目录', parentId: null }],
  items: mockFavoriteItems.filter((item) => item.parentId === null),
  clipboard: null,
  loading: false,

  navigateToFolder: async (folderId) => {
    set({ loading: true, currentFolderId: folderId });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const allItems = mockFavoriteItems;
    let items: FavoriteItem[];
    let folderPath: FolderNode[];

    if (folderId === null) {
      items = allItems.filter((item) => item.parentId === null);
      folderPath = [{ id: null, name: '根目录', parentId: null }];
    } else {
      const folder = allItems.find((item) => item.id === folderId);
      if (folder && folder.children) {
        items = folder.children;
      } else {
        items = allItems.filter((item) => item.parentId === folderId);
      }

      // Build path
      folderPath = [{ id: null, name: '根目录', parentId: null }];
      if (folder) {
        folderPath.push({ id: folder.id, name: folder.name, parentId: folder.parentId });
      }
    }

    set({ items, folderPath, loading: false });
  },

  createFolder: async (name, parentId = null) => {
    const { currentFolderId } = get();
    const targetParentId = parentId !== null ? parentId : currentFolderId;
    const newFolder: FavoriteItem = {
      id: `folder-${Date.now()}`,
      type: 'folder',
      name,
      parentId: targetParentId,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ items: [...state.items, newFolder] }));
    return newFolder.id;
  },

  renameFolder: async (folderId, newName) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === folderId ? { ...item, name: newName } : item
      ),
    }));
  },

  deleteFolder: async (folderId) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== folderId),
    }));
  },

  cutFolder: (folderId) => {
    set({ clipboard: { type: 'cut', folderId } });
  },

  pasteFolder: async (targetParentId) => {
    const { clipboard } = get();
    if (!clipboard) return;

    set((state) => ({
      items: state.items.map((item) =>
        item.id === clipboard.folderId ? { ...item, parentId: targetParentId } : item
      ),
      clipboard: null,
    }));
  },

  addFavorite: async (article, folderId) => {
    const newFavorite: FavoriteItem = {
      id: `file-${Date.now()}`,
      type: 'file',
      name: article.title,
      article,
      parentId: folderId,
      createdAt: new Date().toISOString(),
    };

    if (folderId === null) {
      // 添加到根目录
      set((state) => ({ items: [...state.items, newFavorite] }));
    } else {
      // 添加到指定文件夹
      set((state) => ({
        items: state.items.map((item) => {
          if (item.id === folderId && item.type === 'folder') {
            return {
              ...item,
              children: [...(item.children || []), newFavorite],
            };
          }
          return item;
        }),
      }));
    }
  },

  removeFavorite: async (articleId) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== articleId),
    }));
  },
}));