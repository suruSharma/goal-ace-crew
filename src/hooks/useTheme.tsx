import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ColorTheme = 'purple' | 'coral' | 'emerald' | 'blue';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

interface ThemeContextType {
  colorTheme: ColorTheme;
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  setColorTheme: (theme: ColorTheme) => void;
  setMode: (mode: ThemeMode) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_COLOR = 'app-color-theme';
const STORAGE_KEY_MODE = 'app-mode';

function getSystemPreference(): ResolvedMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR);
    return (stored as ColorTheme) || 'purple';
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    return (stored as ThemeMode) || 'system';
  });

  const [systemPreference, setSystemPreference] = useState<ResolvedMode>(getSystemPreference);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Calculate resolved mode
  const resolvedMode: ResolvedMode = mode === 'system' ? systemPreference : mode;

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLOR, colorTheme);
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedMode);
  }, [mode, resolvedMode]);

  // Load theme from database when user logs in
  useEffect(() => {
    if (user) {
      loadThemeFromDatabase();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadThemeFromDatabase = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('color_theme, theme_mode')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if (data.color_theme) {
          setColorThemeState(data.color_theme as ColorTheme);
          localStorage.setItem(STORAGE_KEY_COLOR, data.color_theme);
        }
        if (data.theme_mode) {
          setModeState(data.theme_mode as ThemeMode);
          localStorage.setItem(STORAGE_KEY_MODE, data.theme_mode);
        }
      }
    } catch (error) {
      console.error('Error loading theme from database:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemeToDatabase = useCallback(async (color: ColorTheme, themeMode: ThemeMode) => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ color_theme: color, theme_mode: themeMode })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error saving theme to database:', error);
    }
  }, [user]);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    saveThemeToDatabase(theme, mode);
  }, [mode, saveThemeToDatabase]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    saveThemeToDatabase(colorTheme, newMode);
  }, [colorTheme, saveThemeToDatabase]);

  return (
    <ThemeContext.Provider value={{ colorTheme, mode, resolvedMode, setColorTheme, setMode, isLoading }}>
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
