/**
 * Preferences repository — onboarding/store-setup flags, locale and theme.
 * UI never touches AsyncStorage directly (Section 38).
 */
import { FLAG_KEYS, STORAGE_KEYS } from '@/core/config/constants';
import type { AppLocale } from '@/i18n/types';
import type { PreferencesSource } from '../sources/preferences.source';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface PreferencesRepository {
  isOnboardingCompleted(): Promise<boolean>;
  setOnboardingCompleted(): Promise<void>;
  isStoreSetupCompleted(): Promise<boolean>;
  setStoreSetupCompleted(): Promise<void>;
  getLocale(): Promise<string | null>;
  setLocale(locale: AppLocale): Promise<void>;
  getThemePreference(): Promise<string | null>;
  setThemePreference(mode: ThemePreference): Promise<void>;
}

export class AppPreferencesRepository implements PreferencesRepository {
  constructor(private readonly source: PreferencesSource) {}

  isOnboardingCompleted(): Promise<boolean> {
    return this.source.getFlag(FLAG_KEYS.onboardingCompleted);
  }

  setOnboardingCompleted(): Promise<void> {
    return this.source.setFlag(FLAG_KEYS.onboardingCompleted, true);
  }

  isStoreSetupCompleted(): Promise<boolean> {
    return this.source.getFlag(FLAG_KEYS.storeSetupCompleted);
  }

  setStoreSetupCompleted(): Promise<void> {
    return this.source.setFlag(FLAG_KEYS.storeSetupCompleted, true);
  }

  getLocale(): Promise<string | null> {
    return this.source.getString(STORAGE_KEYS.locale);
  }

  setLocale(locale: AppLocale): Promise<void> {
    return this.source.setString(STORAGE_KEYS.locale, locale);
  }

  getThemePreference(): Promise<string | null> {
    return this.source.getString(STORAGE_KEYS.theme);
  }

  setThemePreference(mode: ThemePreference): Promise<void> {
    return this.source.setString(STORAGE_KEYS.theme, mode);
  }
}
