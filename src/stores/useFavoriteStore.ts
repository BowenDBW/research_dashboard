import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { FavoriteItem, FolderNode, FavoriteClipboard } from '../types';
import { Article } from '../types/article';

// Backend response types (match Rust models)
interface BackendFavoriteFolder {
  folder_id: number;
  parent_id: number | null;
  folder_name: string;
  created_at: string | null;
}

interface BackendFavoritePaper {
  article_id: number;
  folder_id: number | null;
  created_at: string | null;
  article: BackendPaper | null;
}

interface BackendPaper {
  article_id: number;
  title: string;
  abstract_text: string | null;
  publication_date: string | null;
  preprint_number: string | null;
  publication_venue: string | null;
  publication_link: string | null;
  pdf_link: string | null;
  pdf_path: string | null;
  authors: string[] | null;
  categories: string[] | null;
  is_favorited: boolean | null;
}

interface BackendBreadcrumbItem {
  id: number | null;
  name: string;
}

interface BackendFolderContents {
  folders: BackendFavoriteFolder[];
  papers: BackendFavoritePaper[];
  path: BackendBreadcrumbItem[];
}

// Convert backend paper to frontend Article
function paperToArticle(paper: BackendPaper): Article {
  return {
    id: String(paper.article_id),
    title: paper.title,
    authors: paper.authors || [],
    source: paper.publication_venue || 'arXiv',
    sourceType: paper.publication_venue?.toLowerCase() || 'arxiv',
    publishDate: paper.publication_date || '',
    abstract: paper.abstract_text || '',
    url: paper.publication_link || '',
    pdfUrl: paper.pdf_link || '',
    domains: paper.categories || [],
    isFavorited: true,
    metadata: {},
  };
}

// Convert backend folder to frontend FavoriteItem
function folderToItem(folder: BackendFavoriteFolder): FavoriteItem {
  return {
    id: String(folder.folder_id),
    type: 'folder',
    name: folder.folder_name,
    parentId: folder.parent_id ? String(folder.parent_id) : null,
    createdAt: folder.created_at || new Date().toISOString(),
    children: [],
  };
}

// Convert backend favorite paper to frontend FavoriteItem
function paperToItem(fav: BackendFavoritePaper): FavoriteItem {
  return {
    id: String(fav.article_id),
    type: 'file',
    name: fav.article?.title || 'Unknown',
    article: fav.article ? paperToArticle(fav.article) : undefined,
    parentId: fav.folder_id ? String(fav.folder_id) : null,
    createdAt: fav.created_at || new Date().toISOString(),
  };
}

// Convert backend breadcrumb to frontend FolderNode
function breadcrumbToNode(item: BackendBreadcrumbItem): FolderNode {
  return {
    id: item.id ? String(item.id) : null,
    name: item.name,
    parentId: null,
  };
}

interface FavoriteStore {
  currentFolderId: string | null;
  folderPath: FolderNode[];
  items: FavoriteItem[];
  clipboard: FavoriteClipboard | null;
  loading: boolean;

  // Navigation
  navigateToFolder: (folderId: string | null) => Promise<void>;

  // Folder operations
  createFolder: (name: string, parentId?: string | null) => Promise<string>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cutFolder: (folderId: string) => void;
  pasteFolder: (targetParentId: string | null) => Promise<void>;

  // Paper operations
  addFavorite: (article: Article, folderId?: string | null) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
  movePaper: (articleId: string, newFolderId: string | null) => Promise<void>;

  // Get folder path
  getFolderPath: (folderId: string | null) => Promise<FolderNode[]>;
}

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  currentFolderId: null,
  folderPath: [{ id: null, name: '根目录', parentId: null }],
  items: [],
  clipboard: null,
  loading: false,

  navigateToFolder: async (folderId: string | null) => {
    set({ loading: true, currentFolderId: folderId });
    try {
      const response = await invoke<BackendFolderContents>('favorites_contents', {
        folderId: folderId ? parseInt(folderId) : null,
      });

      const folders = response.folders.map(folderToItem);
      const papers = response.papers.map(paperToItem);
      const path = response.path.map(breadcrumbToNode);

      set({
        items: [...folders, ...papers],
        folderPath: path,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to navigate to folder:', error);
      set({ items: [], loading: false });
    }
  },

  createFolder: async (name: string, parentId?: string | null) => {
    try {
      const { currentFolderId } = get();
      const targetParentId = parentId !== undefined ? parentId : currentFolderId;

      const response = await invoke<BackendFavoriteFolder>('favorites_create_folder', {
        name,
        parentId: targetParentId ? parseInt(targetParentId) : null,
      });

      const newFolder = folderToItem(response);
      set((state) => ({ items: [...state.items, newFolder] }));

      return newFolder.id;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  renameFolder: async (folderId: string, newName: string) => {
    try {
      await invoke('favorites_rename_folder', {
        folderId: parseInt(folderId),
        name: newName,
      });

      set((state) => ({
        items: state.items.map((item) =>
          item.id === folderId ? { ...item, name: newName } : item
        ),
      }));
    } catch (error) {
      console.error('Failed to rename folder:', error);
      throw error;
    }
  },

  deleteFolder: async (folderId: string) => {
    try {
      await invoke('favorites_delete_folder', {
        folderId: parseInt(folderId),
      });

      set((state) => ({
        items: state.items.filter((item) => item.id !== folderId),
      }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  },

  cutFolder: (folderId: string) => {
    set({ clipboard: { type: 'cut', folderId } });
  },

  pasteFolder: async (targetParentId: string | null) => {
    const { clipboard } = get();
    if (!clipboard) return;

    try {
      await invoke('favorites_move_folder', {
        folderId: parseInt(clipboard.folderId),
        newParentId: targetParentId ? parseInt(targetParentId) : null,
      });

      // Refresh current folder contents
      const { currentFolderId } = get();
      await get().navigateToFolder(currentFolderId);

      set({ clipboard: null });
    } catch (error) {
      console.error('Failed to paste folder:', error);
      throw error;
    }
  },

  addFavorite: async (article: Article, folderId?: string | null) => {
    try {
      const { currentFolderId } = get();
      const targetFolderId = folderId !== undefined ? folderId : currentFolderId;

      await invoke('favorites_add', {
        articleId: parseInt(article.id),
        folderId: targetFolderId ? parseInt(targetFolderId) : null,
      });

      // Add to local state
      const newItem: FavoriteItem = {
        id: article.id,
        type: 'file',
        name: article.title,
        article,
        parentId: targetFolderId,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({ items: [...state.items, newItem] }));
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  },

  removeFavorite: async (articleId: string) => {
    try {
      await invoke('favorites_remove', {
        articleId: parseInt(articleId),
      });

      set((state) => ({
        items: state.items.filter((item) => item.id !== articleId),
      }));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  },

  movePaper: async (articleId: string, newFolderId: string | null) => {
    try {
      await invoke('favorites_move_paper', {
        articleId: parseInt(articleId),
        newFolderId: newFolderId ? parseInt(newFolderId) : null,
      });

      // Refresh current folder contents
      const { currentFolderId } = get();
      await get().navigateToFolder(currentFolderId);
    } catch (error) {
      console.error('Failed to move paper:', error);
      throw error;
    }
  },

  getFolderPath: async (folderId: string | null) => {
    try {
      const response = await invoke<BackendBreadcrumbItem[]>('favorites_path', {
        folderId: folderId ? parseInt(folderId) : null,
      });

      return response.map(breadcrumbToNode);
    } catch (error) {
      console.error('Failed to get folder path:', error);
      return [{ id: null, name: '根目录', parentId: null }];
    }
  },
}));