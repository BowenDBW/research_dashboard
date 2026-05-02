import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FavoriteItem, FolderNode, Article } from '../types';

interface FolderContentsResponse {
  folders: FavoriteItem[];
  papers: FavoriteItem[];
  path: FolderNode[];
}

interface FavoriteClipboard {
  type: 'cut';
  folderId: string;
}

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [folderPath, setFolderPath] = useState<FolderNode[]>([{ id: null, name: '根目录', parentId: null }]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<FavoriteClipboard | null>(null);
  const [loading, setLoading] = useState(false);

  const navigateToFolder = useCallback(async (folderId: string | null) => {
    setLoading(true);
    setCurrentFolderId(folderId);
    try {
      const response = await invoke<FolderContentsResponse>('favorites_contents', {
        folderId: folderId ? parseInt(folderId) : null,
      });
      setItems([...response.folders, ...response.papers]);
      setFolderPath(response.path);
    } catch (error) {
      console.error('Failed to navigate:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    try {
      const response = await invoke<FavoriteItem>('favorites_create_folder', {
        name,
        parentId: parentId ? parseInt(parentId) : null,
      });
      setItems(prev => [...prev, response]);
      return response.id;
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
    setClipboard({ type: 'cut', folderId });
  }, []);

  const pasteFolder = useCallback(async (targetParentId: string | null) => {
    if (!clipboard) return;
    try {
      await invoke('favorites_move_folder', {
        folderId: parseInt(clipboard.folderId),
        newParentId: targetParentId ? parseInt(targetParentId) : null,
      });
      await navigateToFolder(currentFolderId);
      setClipboard(null);
    } catch (error) {
      console.error('Failed to paste folder:', error);
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
    pasteFolder,
    addFavorite,
    removeFavorite,
    movePaper,
    getFolderPath,
  };
}