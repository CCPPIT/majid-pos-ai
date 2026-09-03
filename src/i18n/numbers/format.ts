/**
 * Number / currency formatting, locale-aware (Section 46).
 * Uses Intl with the proper BCP-47 tag. Currency does not force a specific
 * locale's symbol unless asked — callers pass the active currency (YER/SAR/…).
 */
import type { AppLocale } from '../types';

const BCP_47: Record<AppLocale, string> = {
  ar: 'ar-YE',
  en: 'en-US',
};

/** Format a plain number with locale digits/grouping. */
export const formatNumber = (locale: AppLocale, value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(BCP_47[locale], options).format(value);

/**
 * Format a monetary amount.
 * - compact=false → e.g. "1,250 ر.ي." / "YER 1,250"
 * - compact=true  → e.g. "1.2 ألف" / "1.2K" (for dashboards).
 */
export const formatCurrency = (
  locale: AppLocale,
  amount: number,
  currency: string,
  options?: { compact?: boolean },
): string => {
  const notation = options?.compact ? 'compact' : 'standard';
  return new Intl.NumberFormat(BCP_47[locale], {
    style: 'currency',
    currency,
    notation,
    maximumFractionDigits: currency === 'YER' ? 0 : 2,
    currencyDisplay: locale === 'ar' ? 'symbol' : 'code',
  }).format(amount);
};

/** Percentage 0..100 with locale digits. */
export const formatPercent = (locale: AppLocale, value: number, fractionDigits = 0): string =>
  new Intl.NumberFormat(BCP_47[locale], {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);

export { BCP_47 };
