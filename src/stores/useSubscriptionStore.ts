import { create } from 'zustand';
import { Subscriptions } from '../types';

interface SubscriptionStore {
  keywords: string[];
  authors: string[];
  loading: boolean;
  loadSubscriptions: () => Promise<void>;
  updateSubscriptions: (data: Partial<Subscriptions>) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  keywords: ['transformer', 'cs.LG', 'deep learning'],
  authors: ['Yann LeCun', 'Geoffrey Hinton'],
  loading: false,

  loadSubscriptions: async () => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    set({ loading: false });
  },

  updateSubscriptions: async (data) => {
    set((state) => ({
      keywords: data.keywords ?? state.keywords,
      authors: data.authors ?? state.authors,
    }));
  },
}));