import { Article } from './article';

export interface FavoriteItem {
  id: string;
  type: 'folder' | 'file';
  name: string;
  article?: Article;
  children?: FavoriteItem[];
  parentId: string | null;
  createdAt: string;
}

export interface FolderNode {
  id: string | null;
  name: string;
  parentId: string | null;
}

export interface FavoriteClipboard {
  type: 'cut';
  folderId: string;
}