import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { FavoriteItem, FolderNode, Article } from '../types';

// 后端返回的类型（没有 type 字段）
interface BackendFolder {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
}

interface BackendPaper {
  id: string;
  folderId: string | null;
  name: string;
  article: Article | null;
  createdAt: string;
}

interface BackendBreadcrumb {
  id: string | null;
  name: string;
}

interface FolderContentsResponse {
  folders: BackendFolder[];
  papers: BackendPaper[];
  path: BackendBreadcrumb[];
}

interface FavoriteClipboard {
  action: 'cut';
  itemType: 'folder' | 'paper';
  itemId: string;
}

interface FavoritesStore {
  items: FavoriteItem[];
  folderPath: FolderNode[];
  currentFolderId: string | null;
  clipboard: FavoriteClipboard | null;
  loading: boolean;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<string>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cutFolder: (folderId: string) => void;
  cutPaper: (paperId: string) => void;
  pasteItem: (targetFolderId: string | null) => Promise<void>;
  addFavorite: (article: Article, folderId?: string | null) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
  movePaper: (articleId: string, newFolderId: string | null) => Promise<void>;
  getFolderPath: (folderId: string | null) => Promise<FolderNode[]>;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  items: [],
  folderPath: [{ id: null, name: '根目录', parentId: null }],
  currentFolderId: null,
  clipboard: null,
  loading: false,

  navigateToFolder: async (folderId) => {
    set({ loading: true, currentFolderId: folderId });
    try {
      const response = await invoke<FolderContentsResponse>('favorites_contents', {
        folderId: folderId ? parseInt(folderId) : null,
      });

      const folderItems: FavoriteItem[] = (response.folders || []).map(f => ({
        ...f,
        type: 'folder' as const,
        parentId: f.parentId ?? null,
      }));

      const paperItems: FavoriteItem[] = (response.papers || []).map(p => ({
        ...p,
        type: 'file' as const,
        parentId: p.folderId ?? null,
        article: p.article || undefined,
      }));

      const allItems = [...folderItems, ...paperItems];
      set({ items: allItems });

      const pathNodes: FolderNode[] = (response.path || []).map(p => ({
        id: p.id,
        name: p.name,
        parentId: null,
      }));
      set({ folderPath: pathNodes });
    } catch (error) {
      console.error('Failed to navigate:', error);
      set({ items: [] });
    } finally {
      set({ loading: false });
    }
  },

  createFolder: async (name, parentId) => {
    try {
      const response = await invoke<BackendFolder>('favorites_create_folder', {
        name,
        parentId: parentId ? parseInt(parentId) : null,
      });
      const folderItem: FavoriteItem = {
        ...response,
        type: 'folder' as const,
        parentId: response.parentId,
      };
      set((state) => ({ items: [...state.items, folderItem] }));
      return folderItem.id;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  renameFolder: async (folderId, newName) => {
    try {
      await invoke('favorites_rename_folder', {
        folderId: parseInt(folderId),
        newName,
      });
      set((state) => ({
        items: state.items.map(item => item.id === folderId ? { ...item, name: newName } : item),
      }));
    } catch (error) {
      console.error('Failed to rename folder:', error);
      throw error;
    }
  },

  deleteFolder: async (folderId) => {
    try {
      await invoke('favorites_delete_folder', { folderId: parseInt(folderId) });
      set((state) => ({ items: state.items.filter(item => item.id !== folderId) }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  },

  cutFolder: (folderId) => {
    set({ clipboard: { action: 'cut', itemType: 'folder', itemId: folderId } });
  },

  cutPaper: (paperId) => {
    set({ clipboard: { action: 'cut', itemType: 'paper', itemId: paperId } });
  },

  pasteItem: async (targetFolderId) => {
    const { clipboard, currentFolderId } = get();
    if (!clipboard) return;
    try {
      if (clipboard.itemType === 'folder') {
        await invoke('favorites_move_folder', {
          folderId: parseInt(clipboard.itemId),
          newParentId: targetFolderId ? parseInt(targetFolderId) : null,
        });
      } else if (clipboard.itemType === 'paper') {
        await invoke('favorites_move_paper', {
          articleId: parseInt(clipboard.itemId),
          newFolderId: targetFolderId ? parseInt(targetFolderId) : null,
        });
      }
      set({ clipboard: null });
      await get().navigateToFolder(currentFolderId);
    } catch (error) {
      console.error('Failed to paste item:', error);
      throw error;
    }
  },

  addFavorite: async (article, folderId) => {
    try {
      await invoke('favorites_add', {
        articleId: parseInt(article.id),
        folderId: folderId ? parseInt(folderId) : null,
      });
      const newItem: FavoriteItem = {
        id: article.id,
        type: 'file',
        name: article.title,
        article,
        parentId: folderId ?? null,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ items: [...state.items, newItem] }));
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  },

  removeFavorite: async (articleId) => {
    try {
      await invoke('favorites_remove', { articleId: parseInt(articleId) });
      set((state) => ({ items: state.items.filter(item => item.id !== articleId) }));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  },

  movePaper: async (articleId, newFolderId) => {
    const { currentFolderId } = get();
    try {
      await invoke('favorites_move_paper', {
        articleId: parseInt(articleId),
        newFolderId: newFolderId ? parseInt(newFolderId) : null,
      });
      await get().navigateToFolder(currentFolderId);
    } catch (error) {
      console.error('Failed to move paper:', error);
      throw error;
    }
  },

  getFolderPath: async (folderId) => {
    try {
      const response = await invoke<FolderNode[]>('favorites_path', {
        folderId: folderId ? parseInt(folderId) : null,
      });
      return response;
    } catch (error) {
      console.error('Failed to get folder path:', error);
      return [{ id: null, name: '根目录', parentId: null }];
    }
  },
}));