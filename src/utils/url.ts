import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Open a URL in the default browser
 * In Tauri, window.open doesn't work, so we use the opener plugin
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  try {
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open URL:', error);
    // Fallback to window.open for non-Tauri environment
    window.open(url, '_blank');
  }
};