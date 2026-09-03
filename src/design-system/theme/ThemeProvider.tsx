/**
 * Theme provider — resolves dark/light tokens.
 *
 * - Preference: 'light' | 'dark' | 'system', persisted when a
 *   PreferencesRepository is provided (PHASE 04). Without one (tests), it
 *   stays in-memory.
 * - Tokens drive every primitive, so dark/light switch globally.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import type { PreferencesRepository, ThemePreference } from '@/data/repositories/preferences.repository';
import { logger } from '@/core/logging/logger';
import { darkColors, lightColors, type ColorPalette } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { textVariants } from '../tokens/typography';
import { shadow, type Elevation } from '../tokens/shadows';

export type ThemeMode = 'light' | 'dark';
export type ThemeModePreference = ThemeMode | 'system';

export interface Theme {
  mode: ThemeMode;
  colors: ColorPalette;
  spacing: typeof spacing;
  textVariants: typeof textVariants;
  shadow: (elevation: Elevation) => ReturnType<typeof shadow>;
  isDark: boolean;
}

interface ThemeContextValue extends Theme {
  preference: ThemeModePreference;
  setPreference: (p: ThemeModePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (v: string | null): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

export function ThemeProvider({
  children,
  preferencesRepository,
}: {
  children: ReactNode;
  preferencesRepository?: PreferencesRepository;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemeModePreference>('system');

  // Load saved preference at startup (if persistence available).
  useEffect(() => {
    if (!preferencesRepository) return;
    let cancelled = false;
    preferencesRepository
      .getThemePreference()
      .then((saved) => {
        if (!cancelled && isThemePreference(saved)) setPreferenceState(saved);
      })
      .catch((error) => logger.warn('Theme preference load failed', { error: String(error) }));
    return () => {
      cancelled = true;
    };
  }, [preferencesRepository]);

  const setPreference = useCallback(
    (next: ThemeModePreference) => {
      setPreferenceState(next);
      if (preferencesRepository) {
        preferencesRepository.setThemePreference(next).catch((error) =>
          logger.warn('Theme preference save failed', { error: String(error) }),
        );
      }
    },
    [preferencesRepository],
  );

  const mode: ThemeMode =
    preference === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : preference;

  const colors = mode === 'dark' ? darkColors : lightColors;

  const toggle = useCallback(() => {
    setPreferenceState((prev) => {
      const current: ThemeMode =
        prev === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : prev;
      const next: ThemeModePreference = current === 'dark' ? 'light' : 'dark';
      if (preferencesRepository) {
        preferencesRepository.setThemePreference(next).catch(noopCatch);
      }
      return next;
    });
  }, [systemScheme, preferencesRepository]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors,
      spacing,
      textVariants,
      shadow: (e: Elevation) => shadow(colors, e),
      isDark: mode === 'dark',
      preference,
      setPreference,
      toggle,
    }),
    [mode, colors, preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const noopCatch = () => undefined;

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
