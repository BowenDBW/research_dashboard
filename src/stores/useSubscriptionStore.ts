import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Subscriptions, SubscribedAuthor, SubscribedCategory, SubscribedKeyword } from '../types';

// Backend response types (match Rust models)
interface BackendSubscribedAuthor {
  id: number;
  author_name: string;
  created_at: string | null;
}

interface BackendSubscribedCategory {
  id: number;
  category: string;
  created_at: string | null;
}

interface BackendSubscribedKeyword {
  id: number;
  keyword: string;
  created_at: string | null;
}

interface BackendSubscriptions {
  authors: BackendSubscribedAuthor[];
  categories: BackendSubscribedCategory[];
  keywords: BackendSubscribedKeyword[];
}

// Convert backend types to frontend types
function authorToFrontend(a: BackendSubscribedAuthor): SubscribedAuthor {
  return {
    id: String(a.id),
    authorName: a.author_name,
    createdAt: a.created_at,
  };
}

function categoryToFrontend(c: BackendSubscribedCategory): SubscribedCategory {
  return {
    id: String(c.id),
    category: c.category,
    createdAt: c.created_at,
  };
}

function keywordToFrontend(k: BackendSubscribedKeyword): SubscribedKeyword {
  return {
    id: String(k.id),
    keyword: k.keyword,
    createdAt: k.created_at,
  };
}

interface SubscriptionStore {
  authors: SubscribedAuthor[];
  categories: SubscribedCategory[];
  keywords: SubscribedKeyword[];
  loading: boolean;

  // Load all subscriptions
  loadSubscriptions: () => Promise<void>;

  // Author operations
  addAuthor: (authorName: string) => Promise<void>;
  removeAuthor: (id: string) => Promise<void>;

  // Category operations
  addCategory: (category: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  // Keyword operations
  addKeyword: (keyword: string) => Promise<void>;
  removeKeyword: (id: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  authors: [],
  categories: [],
  keywords: [],
  loading: false,

  loadSubscriptions: async () => {
    set({ loading: true });
    try {
      const response = await invoke<BackendSubscriptions>('subscriptions_get');

      set({
        authors: response.authors.map(authorToFrontend),
        categories: response.categories.map(categoryToFrontend),
        keywords: response.keywords.map(keywordToFrontend),
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      set({ loading: false });
    }
  },

  addAuthor: async (authorName: string) => {
    try {
      const response = await invoke<BackendSubscribedAuthor>('subscriptions_add_author', {
        authorName,
      });

      const newAuthor = authorToFrontend(response);
      set((state) => ({ authors: [newAuthor, ...state.authors] }));
    } catch (error) {
      console.error('Failed to add author:', error);
      throw error;
    }
  },

  removeAuthor: async (id: string) => {
    try {
      await invoke('subscriptions_remove_author', { id: parseInt(id) });

      set((state) => ({
        authors: state.authors.filter((a) => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to remove author:', error);
      throw error;
    }
  },

  addCategory: async (category: string) => {
    try {
      const response = await invoke<BackendSubscribedCategory>('subscriptions_add_category', {
        category,
      });

      const newCategory = categoryToFrontend(response);
      set((state) => ({ categories: [newCategory, ...state.categories] }));
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  },

  removeCategory: async (id: string) => {
    try {
      await invoke('subscriptions_remove_category', { id: parseInt(id) });

      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
    } catch (error) {
      console.error('Failed to remove category:', error);
      throw error;
    }
  },

  addKeyword: async (keyword: string) => {
    try {
      const response = await invoke<BackendSubscribedKeyword>('subscriptions_add_keyword', {
        keyword,
      });

      const newKeyword = keywordToFrontend(response);
      set((state) => ({ keywords: [newKeyword, ...state.keywords] }));
    } catch (error) {
      console.error('Failed to add keyword:', error);
      throw error;
    }
  },

  removeKeyword: async (id: string) => {
    try {
      await invoke('subscriptions_remove_keyword', { id: parseInt(id) });

      set((state) => ({
        keywords: state.keywords.filter((k) => k.id !== id),
      }));
    } catch (error) {
      console.error('Failed to remove keyword:', error);
      throw error;
    }
  },
}));