/**
 * i18n core types (Section 46).
 * Locales: Arabic (RTL, default for the Yemeni launch) · English (LTR).
 */
export type AppLocale = 'ar' | 'en';

export const SUPPORTED_LOCALES: AppLocale[] = ['ar', 'en'];

/** Resolve writing direction for a locale. */
export const isRTL = (locale: AppLocale): boolean => locale === 'ar';

export const localeDirection = (locale: AppLocale): 'rtl' | 'ltr' =>
  isRTL(locale) ? 'rtl' : 'ltr';

/**
 * Flat key → string catalog. Values use `{name}` interpolation tokens and
 * ICU-lite plural suffixes handled by `plural()`.
 */
export type TranslationDict = Record<string, string>;
