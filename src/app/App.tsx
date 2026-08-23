import { useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AppRouter } from './Router';
import { useSettingsStore, initSettingsEventListeners } from '../stores/useSettingsStore';
import { initChatEventListeners } from '../stores/useChatStore';
import { usePluginStore, initPluginEventListeners } from '../stores/usePluginStore';

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadPlugins = usePluginStore((state) => state.loadPlugins);

  useEffect(() => {
    loadSettings();
    initChatEventListeners();
    initSettingsEventListeners();
    initPluginEventListeners();
    loadPlugins();
  }, [loadSettings, loadPlugins]);

  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;