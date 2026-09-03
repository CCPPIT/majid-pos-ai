/**
 * LocaleProvider — locale state, translations, RTL enforcement and formatters.
 *
 * Direction (RTL/LTR) is a native setting in React Native: after changing it
 * via I18nManager the app must reload for the layout to fully mirror. We:
 *   1) load the saved locale (or device locale, or default) once,
 *   2) force RTL/LTR at startup,
 *   3) on language switch: persist, flip I18nManager, then reload (Expo
 *      Updates in dev/standalone; in the test environment reload is skipped).
 *
 * This keeps Section 45 working: Arabic = RTL, English = LTR, no broken layout.
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
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { getLocales } from 'expo-localization';

import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import type { PreferencesRepository } from '@/data/repositories/preferences.repository';
import { formatCurrency, formatNumber, formatPercent } from './numbers/format';
import { formatDate, formatDateTime, formatRelativeDay, formatTime } from './date-time/format';
import { translate, translatePlural, type TranslateParams } from './translate';
import { isRTL, localeDirection, SUPPORTED_LOCALES, type AppLocale } from './types';

export interface LocaleContextValue {
  locale: AppLocale;
  isRTL: boolean;
  direction: 'rtl' | 'ltr';
  ready: boolean;
  t: (key: string, params?: TranslateParams) => string;
  tn: (baseKey: string, count: number, params?: TranslateParams) => string;
  setLocale: (locale: AppLocale) => Promise<void>;
  /** Flip I18nManager + reload so the native direction applies. */
  switchLocale: (locale: AppLocale) => Promise<void>;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string, options?: { compact?: boolean }) => string;
  formatPercent: (value: number, fractionDigits?: number) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
  formatRelativeDay: (date: Date | string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const detectDeviceLocale = (): AppLocale => {
  const device = getLocales?.()[0]?.languageCode;
  return device === 'en' ? 'en' : 'ar'; // default Arabic-first
};

/** Standalone translator usable outside React (tests, domain layers). */
export const translateFor = (locale: AppLocale) => ({
  t: (key: string, params?: TranslateParams) => translate(locale, key, params),
  tn: (base: string, count: number, params?: TranslateParams) =>
    translatePlural(locale, base, count, params),
});

const noop = () => undefined;

export function LocaleProvider({
  children,
  preferencesRepository,
}: {
  children: ReactNode;
  preferencesRepository: PreferencesRepository;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(env.defaultLocale as AppLocale);
  const [ready, setReady] = useState(false);

  // Load saved/device locale once and align native direction at startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolved: AppLocale = env.defaultLocale as AppLocale;
      try {
        const saved = await preferencesRepository.getLocale();
        if (saved === 'ar' || saved === 'en') {
          resolved = saved;
        } else {
          resolved = detectDeviceLocale();
        }
        if (!SUPPORTED_LOCALES.includes(resolved)) resolved = 'ar';
      } catch (error) {
        logger.warn('Locale load failed, using default', { error: String(error) });
      }

      // Enforce direction at startup (does not require a reload on cold start).
      const desiredRTL = isRTL(resolved);
      if (I18nManager.isRTL !== desiredRTL) {
        try {
          I18nManager.allowRTL(desiredRTL);
          I18nManager.forceRTL(desiredRTL);
        } catch (error) {
          logger.warn('Failed to set RTL at startup', { error: String(error) });
        }
      }

      if (!cancelled) {
        setLocaleState(resolved);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferencesRepository]);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );
  const tn = useCallback(
    (base: string, count: number, params?: TranslateParams) =>
      translatePlural(locale, base, count, params),
    [locale],
  );

  const setLocale = useCallback(
    async (next: AppLocale) => {
      await preferencesRepository.setLocale(next);
      setLocaleState(next);
    },
    [preferencesRepository],
  );

  const reloadApp = useCallback(async () => {
    try {
      if (Updates.isEnabled && typeof Updates.reloadAsync === 'function') {
        await Updates.reloadAsync();
        return;
      }
    } catch (error) {
      logger.warn('Updates reload unavailable', { error: String(error) });
    }
    logger.info('RTL switch needs an app reload (no runtime reload available)');
  }, []);

  const switchLocale = useCallback(
    async (next: AppLocale) => {
      await preferencesRepository.setLocale(next);
      setLocaleState(next);
      const desiredRTL = isRTL(next);
      if (I18nManager.isRTL !== desiredRTL) {
        I18nManager.allowRTL(desiredRTL);
        I18nManager.forceRTL(desiredRTL);
        await reloadApp();
      }
    },
    [preferencesRepository, reloadApp],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isRTL: isRTL(locale),
      direction: localeDirection(locale),
      ready,
      t,
      tn,
      setLocale,
      switchLocale,
      formatNumber: (v, o) => formatNumber(locale, v, o),
      formatCurrency: (amount, currency = env.defaultCurrency, options) =>
        formatCurrency(locale, amount, currency, options),
      formatPercent: (v, d) => formatPercent(locale, v, d),
      formatDate: (d) => formatDate(locale, d),
      formatTime: (d) => formatTime(locale, d),
      formatDateTime: (d) => formatDateTime(locale, d),
      formatRelativeDay: (d) => formatRelativeDay(locale, d),
    }),
    [locale, ready, t, tn, setLocale, switchLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>');
  return ctx;
}

/**
 * Translation hook safe to use in design-system primitives/tests even before a
 * LocaleProvider is mounted — falls back to Arabic catalog.
 */
export function useTranslation() {
  const ctx = useContext(LocaleContext);
  const fallback = useMemo<LocaleContextValue>(
    () => {
      const arHelpers = translateFor('ar');
      return {
        locale: 'ar',
        isRTL: true,
        direction: 'rtl',
        ready: true,
        t: arHelpers.t,
        tn: arHelpers.tn,
        setLocale: noop as unknown as LocaleContextValue['setLocale'],
        switchLocale: noop as unknown as LocaleContextValue['switchLocale'],
        formatNumber: (v: number) => formatNumber('ar', v),
        formatCurrency: (amount: number) => formatCurrency('ar', amount, env.defaultCurrency),
        formatPercent: (v: number) => formatPercent('ar', v),
        formatDate: (d: Date | string) => formatDate('ar', d),
        formatTime: (d: Date | string) => formatTime('ar', d),
        formatDateTime: (d: Date | string) => formatDateTime('ar', d),
        formatRelativeDay: (d: Date | string) => formatRelativeDay('ar', d),
      };
    },
    [],
  );
  return ctx ?? fallback;
}
