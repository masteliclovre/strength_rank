import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  colorScheme: 'light' | 'dark';
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void> | void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'app-theme-preference';

function normalizeSystemScheme(systemScheme: ColorSchemeName | undefined): 'light' | 'dark' {
  switch (systemScheme) {
    case 'dark':
      return 'dark';
    case 'light':
      return 'light';
    default:
      return 'light';
  }
}

function resolveColorScheme(
  systemScheme: ColorSchemeName | undefined,
  preference: ThemePreference
): 'light' | 'dark' {
  if (preference === 'system') {
    return normalizeSystemScheme(systemScheme);
  }
  return preference;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | undefined>(() => Appearance.getColorScheme());
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored: string | null) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored);
        }
      })
      .catch((error: unknown) => {
        console.warn('Failed to load theme preference', error);
      });
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const setThemePreference = useCallback(async (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    try {
      if (preference === 'system') {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, preference);
      }
    } catch (error: unknown) {
      console.warn('Failed to persist theme preference', error);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      colorScheme: resolveColorScheme(systemScheme, themePreference),
      themePreference,
      setThemePreference,
    };
  }, [systemScheme, themePreference, setThemePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within an AppThemeProvider');
  }
  return context;
}

export function useThemePreference() {
  const { colorScheme, themePreference, setThemePreference } = useThemeContext();
  return { colorScheme, themePreference, setThemePreference };
}
