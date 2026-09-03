/**
 * Date / time formatting, locale-aware (Arabic calendar defaults to Gregorian
 * with Arabic-Indic digits; can be swapped to 'islamic-umalqura' per tenant).
 */
import type { AppLocale } from '../types';
import { BCP_47 } from '../numbers/format';

export const formatDate = (locale: AppLocale, date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP_47[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
};

export const formatTime = (locale: AppLocale, date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP_47[locale], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
};

export const formatDateTime = (locale: AppLocale, date: Date | string): string =>
  `${formatDate(locale, date)} · ${formatTime(locale, date)}`;

export const formatRelativeDay = (locale: AppLocale, date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat(BCP_47[locale], { numeric: 'auto' });
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) < 1) return rtf.format(0, 'day');
  return rtf.format(diffDays, 'day');
};
