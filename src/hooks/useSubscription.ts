import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SubscribedAuthor, SubscribedCategory, SubscribedKeyword, Subscriptions } from '../types';

export function useSubscription() {
  const [authors, setAuthors] = useState<SubscribedAuthor[]>([]);
  const [categories, setCategories] = useState<SubscribedCategory[]>([]);
  const [keywords, setKeywords] = useState<SubscribedKeyword[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invoke<Subscriptions>('subscriptions_get');
      setAuthors(response.authors);
      setCategories(response.categories);
      setKeywords(response.keywords);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addAuthor = useCallback(async (authorName: string) => {
    try {
      const response = await invoke<SubscribedAuthor>('subscriptions_add_author', { authorName });
      setAuthors(prev => [response, ...prev]);
    } catch (error) {
      console.error('Failed to add author:', error);
      throw error;
    }
  }, []);

  const removeAuthor = useCallback(async (id: string) => {
    try {
      await invoke('subscriptions_remove_author', { id: parseInt(id) });
      setAuthors(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to remove author:', error);
      throw error;
    }
  }, []);

  const addCategory = useCallback(async (category: string) => {
    try {
      const response = await invoke<SubscribedCategory>('subscriptions_add_category', { category });
      setCategories(prev => [response, ...prev]);
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    try {
      await invoke('subscriptions_remove_category', { id: parseInt(id) });
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to remove category:', error);
      throw error;
    }
  }, []);

  const addKeyword = useCallback(async (keyword: string) => {
    try {
      const response = await invoke<SubscribedKeyword>('subscriptions_add_keyword', { keyword });
      setKeywords(prev => [response, ...prev]);
    } catch (error) {
      console.error('Failed to add keyword:', error);
      throw error;
    }
  }, []);

  const removeKeyword = useCallback(async (id: string) => {
    try {
      await invoke('subscriptions_remove_keyword', { id: parseInt(id) });
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (error) {
      console.error('Failed to remove keyword:', error);
      throw error;
    }
  }, []);

  return {
    authors,
    categories,
    keywords,
    loading,
    loadSubscriptions,
    addAuthor,
    removeAuthor,
    addCategory,
    removeCategory,
    addKeyword,
    removeKeyword,
  };
}