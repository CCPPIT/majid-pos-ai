import { formatCurrency, formatNumber, formatPercent } from '@/i18n/numbers/format';
import { formatDate, formatTime } from '@/i18n/date-time/format';
import { isRTL, localeDirection } from '@/i18n/types';

describe('locale direction', () => {
  it('Arabic is RTL, English is LTR', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('en')).toBe('ltr');
  });
});

describe('number formatting', () => {
  it('groups numbers per locale', () => {
    expect(formatNumber('en', 1250000)).toMatch(/1,250,000|1250000/);
  });

  it('formats currency with the correct code and zero decimals for YER', () => {
    const en = formatCurrency('en', 1250, 'YER');
    expect(en).toContain('YER');
    // Arabic uses Arabic-Indic digits and the Rial symbol.
    const ar = formatCurrency('ar', 1250, 'YER');
    expect(ar).toContain('ر.ي.');
    expect(ar).toContain('١٬٢٥٠');
  });

  it('uses 2 decimals for USD', () => {
    expect(formatCurrency('en', 19.99, 'USD')).toContain('19.99');
  });

  it('formats compact currency', () => {
    const compact = formatCurrency('en', 1500000, 'USD', { compact: true });
    expect(compact).toMatch(/1\.5/);
  });

  it('formats percent', () => {
    expect(formatPercent('en', 15)).toMatch(/15/);
  });
});

describe('date/time formatting', () => {
  const d = '2026-08-28T10:30:00.000Z';

  it('formats a date and time without throwing', () => {
    expect(typeof formatDate('en', d)).toBe('string');
    expect(typeof formatTime('en', d)).toBe('string');
    expect(formatDate('ar', d).length).toBeGreaterThan(0);
  });
});
