import { useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AppRouter } from './Router';
import { useSettingsStore } from '../stores/useSettingsStore';
import { initChatEventListeners } from '../stores/useChatStore';

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    loadSettings();
    initChatEventListeners();
  }, [loadSettings]);

  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;