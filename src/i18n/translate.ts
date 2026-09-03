/**
 * Translation function — pure, no React dependency.
 * - Interpolation: t('hello', { name: 'Ali' }) with 'مرحبًا {name}'.
 * - Fallback: missing keys in the active locale fall back to English, then
 *   the raw key (never a blank screen).
 * - Plurals: keys can carry _zero/_one/_two/_many suffixes; `plural()` picks
 *   the Arabic-aware form.
 */
import { ar } from './ar';
import { en } from './en';
import type { AppLocale, TranslationDict } from './types';

const CATALOGS: Record<AppLocale, TranslationDict> = { ar, en };

export type TranslateParams = Record<string, string | number>;

export const translate = (
  locale: AppLocale,
  key: string,
  params?: TranslateParams,
): string => {
  const dict = CATALOGS[locale] ?? CATALOGS.ar;
  let template = dict[key];
  if (template === undefined) {
    template = CATALOGS.en[key] ?? key; // graceful fallback
  }

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    params[token] !== undefined ? String(params[token]) : `{${token}}`,
  );
};

/**
 * Arabic-aware plural selection.
 * Convention: provide keys `key.zero`, `key.one`, `key.two`, `key.many` or
 * pass a params object with count and a matching suffix on the base key.
 * Arabic: 0 → zero, 1 → one, 2 → two, else many. English: 1 → one, else many.
 */
export const pluralKey = (locale: AppLocale, base: string, count: number): string => {
  if (locale === 'ar') {
    if (count === 0) return `${base}.zero`;
    if (count === 1) return `${base}.one`;
    if (count === 2) return `${base}.two`;
    return `${base}.many`;
  }
  return count === 1 ? `${base}.one` : `${base}.many`;
};

export const translatePlural = (
  locale: AppLocale,
  base: string,
  count: number,
  params?: TranslateParams,
): string => translate(locale, pluralKey(locale, base, count), { count, ...params });
