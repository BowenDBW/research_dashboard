import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { GmailAuthStatus, GmailSyncProgress } from '../types';

interface GmailStore {
  authStatus: GmailAuthStatus | null;
  syncProgress: GmailSyncProgress | null;

  fetchAuthStatus: () => Promise<void>;
  authorize: (clientId: string, clientSecret: string) => Promise<GmailAuthStatus>;
  logout: () => Promise<void>;
  /** Kick off a background sync. The backend returns immediately; live progress is polled via fetchSyncStatus. Throws on error (e.g. already running / missing credentials). */
  startSync: (clientId: string, clientSecret: string) => Promise<void>;
  /** Poll the live sync status snapshot from the backend. */
  fetchSyncStatus: () => Promise<GmailSyncProgress | null>;
  /** Request cooperative cancel of the running sync. */
  stopSync: () => Promise<void>;
}

export const useGmailStore = create<GmailStore>((set) => ({
  authStatus: null,
  syncProgress: null,

  fetchAuthStatus: async () => {
    try {
      const status = await invoke<GmailAuthStatus>('gmail_auth_status');
      set({ authStatus: status });
    } catch (err) {
      console.error('Failed to fetch Gmail auth status:', err);
      set({ authStatus: { authorized: false, email: '' } });
    }
  },

  authorize: async (clientId, clientSecret) => {
    const status = await invoke<GmailAuthStatus>('gmail_authorize', { clientId, clientSecret });
    set({ authStatus: status });
    return status;
  },

  logout: async () => {
    await invoke('gmail_logout');
    set({ authStatus: { authorized: false, email: '' } });
  },

  startSync: async (clientId, clientSecret) => {
    // Backend returns immediately with "同步已启动"; progress is published to the shared
    // handle and read via fetchSyncStatus.
    await invoke<string>('gmail_sync', { clientId, clientSecret });
    // Optimistic running state so the UI can begin polling/refreshing immediately
    set({
      syncProgress: {
        running: true,
        totalEmails: 0,
        processed: 0,
        totalArticles: 0,
        errors: [],
        message: '正在同步...',
      },
    });
  },

  fetchSyncStatus: async () => {
    try {
      const status = await invoke<GmailSyncProgress>('gmail_sync_status');
      set({ syncProgress: status });
      return status;
    } catch (err) {
      console.error('Failed to fetch Gmail sync status:', err);
      return null;
    }
  },

  stopSync: async () => {
    try {
      await invoke<string>('gmail_sync_stop');
    } catch (err) {
      console.error('Failed to stop Gmail sync:', err);
    }
  },
}));
