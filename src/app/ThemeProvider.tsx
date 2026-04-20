import { createContext, useState, useContext, ReactNode } from 'react';
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  PaletteMode,
} from '@mui/material';

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

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
  const [mode, setMode] = useState<PaletteMode>('light');

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = createTheme(getDesignTokens(mode));

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};