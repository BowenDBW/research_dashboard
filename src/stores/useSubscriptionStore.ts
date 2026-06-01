import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SubscribedAuthor, SubscribedCategory, SubscribedKeyword, Subscriptions } from '../types';

interface SubscriptionStore {
  authors: SubscribedAuthor[];
  categories: SubscribedCategory[];
  keywords: SubscribedKeyword[];
  loading: boolean;
  loadSubscriptions: () => Promise<void>;
  addAuthor: (authorName: string) => Promise<void>;
  removeAuthor: (id: string) => Promise<void>;
  addCategory: (category: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addKeyword: (keyword: string) => Promise<void>;
  removeKeyword: (id: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  authors: [],
  categories: [],
  keywords: [],
  loading: false,

  loadSubscriptions: async () => {
    set({ loading: true });
    try {
      const response = await invoke<Subscriptions>('subscriptions_get');
      set({ authors: response.authors, categories: response.categories, keywords: response.keywords });
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      set({ loading: false });
    }
  },

  addAuthor: async (authorName) => {
    try {
      const response = await invoke<SubscribedAuthor>('subscriptions_add_author', { authorName });
      set((state) => ({ authors: [response, ...state.authors] }));
    } catch (error) {
      console.error('Failed to add author:', error);
      throw error;
    }
  },

  removeAuthor: async (id) => {
    try {
      await invoke('subscriptions_remove_author', { id: parseInt(id) });
      set((state) => ({ authors: state.authors.filter(a => a.id !== id) }));
    } catch (error) {
      console.error('Failed to remove author:', error);
      throw error;
    }
  },

  addCategory: async (category) => {
    try {
      const response = await invoke<SubscribedCategory>('subscriptions_add_category', { category });
      set((state) => ({ categories: [response, ...state.categories] }));
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  },

  removeCategory: async (id) => {
    try {
      await invoke('subscriptions_remove_category', { id: parseInt(id) });
      set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
    } catch (error) {
      console.error('Failed to remove category:', error);
      throw error;
    }
  },

  addKeyword: async (keyword) => {
    try {
      const response = await invoke<SubscribedKeyword>('subscriptions_add_keyword', { keyword });
      set((state) => ({ keywords: [response, ...state.keywords] }));
    } catch (error) {
      console.error('Failed to add keyword:', error);
      throw error;
    }
  },

  removeKeyword: async (id) => {
    try {
      await invoke('subscriptions_remove_keyword', { id: parseInt(id) });
      set((state) => ({ keywords: state.keywords.filter(k => k.id !== id) }));
    } catch (error) {
      console.error('Failed to remove keyword:', error);
      throw error;
    }
  },
}));