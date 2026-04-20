import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  PaletteMode,
} from '@mui/material';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  mode: PaletteMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  preference: 'system',
  setPreference: () => {},
  toggleMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

// 获取系统主题偏好
const getSystemPreference = (): PaletteMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          primary: {
            main: '#1565C0',
            light: '#1E88E5',
            dark: '#0D47A1',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#00897B',
            light: '#4DB6AC',
            dark: '#00695C',
            contrastText: '#FFFFFF',
          },
          background: {
            default: '#F5F5F5',
            paper: '#FFFFFF',
          },
        }
      : {
          primary: {
            main: '#42A5F5',
            light: '#64B5F6',
            dark: '#1976D2',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#4DB6AC',
            light: '#80CBC4',
            dark: '#00897B',
            contrastText: '#FFFFFF',
          },
          background: {
            default: '#121212',
            paper: '#1E1E1E',
          },
        }),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 600, letterSpacing: '0.02em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.75rem', lineHeight: 1.5 },
    caption: { fontSize: '0.6875rem' },
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // 从 localStorage 读取偏好设置
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('themePreference');
    return (saved as ThemePreference) || 'system';
  });

  // 计算实际的主题模式
  const [mode, setMode] = useState<PaletteMode>(() => {
    const saved = localStorage.getItem('themePreference') as ThemePreference;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return getSystemPreference();
  });

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preference === 'system') {
        setMode(getSystemPreference());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  // 设置偏好并保存到 localStorage
  const setPreference = (newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem('themePreference', newPreference);

    if (newPreference === 'system') {
      setMode(getSystemPreference());
    } else {
      setMode(newPreference);
    }
  };

  // 切换主题（用于快速切换按钮）
  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setPreference(newMode);
  };

  const theme = createTheme(getDesignTokens(mode));

  return (
    <ThemeContext.Provider value={{ mode, preference, setPreference, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};