import { useState, useCallback } from 'react';
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

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [folderPath, setFolderPath] = useState<FolderNode[]>([{ id: null, name: '根目录', parentId: null }]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<FavoriteClipboard | null>(null);
  const [loading, setLoading] = useState(false);

  const navigateToFolder = useCallback(async (folderId: string | null) => {
    console.log('[navigateToFolder] 开始导航到文件夹:', folderId);
    setLoading(true);
    setCurrentFolderId(folderId);
    try {
      const response = await invoke<FolderContentsResponse>('favorites_contents', {
        folderId: folderId ? parseInt(folderId) : null,
      });
      console.log('[navigateToFolder] 后端返回数据:', response);
      console.log('[navigateToFolder] folders数量:', response.folders?.length);
      console.log('[navigateToFolder] papers数量:', response.papers?.length);

      // 给 folders 添加 type: 'folder'
      const folderItems: FavoriteItem[] = (response.folders || []).map(f => ({
        ...f,
        type: 'folder' as const,
        parentId: f.parentId,
      }));

      // 给 papers 添加 type: 'file'
      const paperItems: FavoriteItem[] = (response.papers || []).map(p => ({
        ...p,
        type: 'file' as const,
        parentId: p.folderId,
        article: p.article || undefined,
      }));

      const allItems = [...folderItems, ...paperItems];
      console.log('[navigateToFolder] 设置items数量:', allItems.length);
      setItems(allItems);

      // 转换 path
      const pathNodes: FolderNode[] = (response.path || []).map(p => ({
        id: p.id,
        name: p.name,
        parentId: null,
      }));
      setFolderPath(pathNodes);
    } catch (error) {
      console.error('Failed to navigate:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    try {
      const response = await invoke<BackendFolder>('favorites_create_folder', {
        name,
        parentId: parentId ? parseInt(parentId) : null,
      });
      // 添加 type 字段
      const folderItem: FavoriteItem = {
        ...response,
        type: 'folder' as const,
        parentId: response.parentId,
      };
      setItems(prev => [...prev, folderItem]);
      return folderItem.id;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }, []);

  const renameFolder = useCallback(async (folderId: string, newName: string) => {
    try {
      await invoke('favorites_rename_folder', {
        folderId: parseInt(folderId),
        newName,
      });
      setItems(prev => prev.map(item => item.id === folderId ? { ...item, name: newName } : item));
    } catch (error) {
      console.error('Failed to rename folder:', error);
      throw error;
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      await invoke('favorites_delete_folder', { folderId: parseInt(folderId) });
      setItems(prev => prev.filter(item => item.id !== folderId));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  }, []);

  const cutFolder = useCallback((folderId: string) => {
    setClipboard({ action: 'cut', itemType: 'folder', itemId: folderId });
  }, []);

  const cutPaper = useCallback((paperId: string) => {
    setClipboard({ action: 'cut', itemType: 'paper', itemId: paperId });
  }, []);

  const pasteItem = useCallback(async (targetFolderId: string | null) => {
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
      setClipboard(null);
      await navigateToFolder(currentFolderId);
    } catch (error) {
      console.error('Failed to paste item:', error);
      throw error;
    }
  }, [clipboard, currentFolderId, navigateToFolder]);

  const addFavorite = useCallback(async (article: Article, folderId?: string | null) => {
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
      setItems(prev => [...prev, newItem]);
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  }, []);

  const removeFavorite = useCallback(async (articleId: string) => {
    try {
      await invoke('favorites_remove', { articleId: parseInt(articleId) });
      setItems(prev => prev.filter(item => item.id !== articleId));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  }, []);

  const movePaper = useCallback(async (articleId: string, newFolderId: string | null) => {
    try {
      await invoke('favorites_move_paper', {
        articleId: parseInt(articleId),
        newFolderId: newFolderId ? parseInt(newFolderId) : null,
      });
      await navigateToFolder(currentFolderId);
    } catch (error) {
      console.error('Failed to move paper:', error);
      throw error;
    }
  }, [currentFolderId, navigateToFolder]);

  const getFolderPath = useCallback(async (folderId: string | null) => {
    try {
      const response = await invoke<FolderNode[]>('favorites_path', {
        folderId: folderId ? parseInt(folderId) : null,
      });
      return response;
    } catch (error) {
      console.error('Failed to get folder path:', error);
      return [{ id: null, name: '根目录', parentId: null }];
    }
  }, []);

  return {
    items,
    folderPath,
    currentFolderId,
    clipboard,
    loading,
    navigateToFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    cutFolder,
    cutPaper,
    pasteItem,
    addFavorite,
    removeFavorite,
    movePaper,
    getFolderPath,
  };
}