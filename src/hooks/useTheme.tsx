import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ColorTheme = 'purple' | 'coral' | 'emerald' | 'blue';
export type Mode = 'light' | 'dark';

interface ThemeContextType {
  colorTheme: ColorTheme;
  mode: Mode;
  setColorTheme: (theme: ColorTheme) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_COLOR = 'app-color-theme';
const STORAGE_KEY_MODE = 'app-mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR);
    return (stored as ColorTheme) || 'purple';
  });

  const [mode, setModeState] = useState<Mode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    return (stored as Mode) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLOR, colorTheme);
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
  }, [mode]);

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
  };

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
  };

  const toggleMode = () => {
    setModeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ colorTheme, mode, setColorTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
