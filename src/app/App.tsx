import { useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AppRouter } from './Router';
import { useSettingsStore } from '../stores/useSettingsStore';

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;