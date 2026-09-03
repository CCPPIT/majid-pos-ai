/**
 * Root layout — application shell + provider composition.
 *
 * Provider order (outer → inner):
 *   SafeArea → Locale (ar/en · RTL/LTR · formatters) → Theme (dark/light,
 *   persisted) → Bootstrap (session/onboarding) → Toast → Router
 *
 * We keep a splash screen until locale + bootstrap are loaded so the first
 * frame never flashes the wrong direction/theme (Sections 44/45).
 *
 * Repositories are instantiated ONCE here (composition root). Swapping
 * mock/local data for a real API/AI backend only changes source
 * implementations — no screen/feature code changes (Section 38).
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APP_NAME, APP_VERSION } from '@/core/config/constants';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import { AsyncStoragePreferencesSource } from '@/data/sources/preferences.source';
import { SecureSessionSource } from '@/data/sources/session.source';
import { AppPreferencesRepository } from '@/data/repositories/preferences.repository';
import { AppSessionRepository } from '@/data/repositories/session.repository';
import { AppSecurityRepository } from '@/data/repositories/security.repository';
import { ExpoSecureStorage } from '@/security/secure-storage/secure-storage';
import { BootstrapProvider, useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { TenancyProvider } from '@/features/tenancy/tenancy-context';
import { MockTenancySource } from '@/data/sources/tenancy.source';
import { LocalSetupSource } from '@/data/sources/setup.source';
import { AppSetupRepository } from '@/data/repositories/setup.repository';
import { SecurityProvider } from '@/features/security/security-context';
import { LockOverlay } from '@/features/security/LockOverlay';
import { CrashBoundary } from '@/features/error/CrashBoundary';
import { wireAudit } from '@/shared/audit/audit-bootstrap';
import { sessionActor } from '@/data/repositories/audit.repository';
import {
  AppTenancyRepository,
  PreferencesActiveStoreStore,
} from '@/data/repositories/tenancy.repository';
import { SetupProvider } from '@/features/setup/setup-context';
import { CartProvider } from '@/features/cart/cart-context';
import { SyncProvider } from '@/features/sync/sync-context';

import { LocaleProvider, useLocale } from '@/i18n/LocaleProvider';
import { ThemeProvider, ToastProvider, useTheme } from '@/design-system';
import { Spinner } from '@/design-system/primitives/Spinner';

// ── Composition root ────────────────────────────────────────────────────────
// مصدر التفضيلات (نستخدمه للتخزين العام ومتجر المتجر النشط).
const preferencesSource = new AsyncStoragePreferencesSource();
const preferencesRepository = new AppPreferencesRepository(preferencesSource);
// Secure-storage-backed session (keychain/keystore). Falls back gracefully on
// unsupported platforms (tests use the in-memory source instead).
const sessionRepository = new AppSessionRepository(
  new SecureSessionSource(new ExpoSecureStorage()),
);
// مستودع الأمان (PHASE 26): إعدادات القفل التلقائي وفتح القفل بـ PIN/البصمة.
const securityRepository = new AppSecurityRepository(preferencesSource, sessionRepository);
// مستودع إعداد المتجر (PHASE 09) — يخزّن الملف التعريفي فوق التفضيلات.
const setupSource = new LocalSetupSource({
  getString: (key) => preferencesSource.getString(key),
  setString: (key, value) => preferencesSource.setString(key, value),
});
const setupRepository = new AppSetupRepository(setupSource);
// مستودع المستأجرين (هرمية المتاجر) — يحفظ المتجر النشط عبر التفضيلات.
// المصدر المحلي يبني الهرمية من ملف الإعداد إن وُجد، وإلا البيانات التجريبية.
const tenancyRepository = new AppTenancyRepository(
  new MockTenancySource(setupSource),
  new PreferencesActiveStoreStore(
    (key) => preferencesSource.getString(key),
    (key, value) => preferencesSource.setString(key, value),
  ),
);

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function ThemedStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    />
  );
}

/** Waits for locale (RTL applied) + bootstrap state before showing routes. */
function AppGate({ children }: { children: React.ReactNode }) {
  const { ready: localeReady } = useLocale();
  const { ready: bootstrapReady, state } = useBootstrap();
  const { colors } = useTheme();
  const ready = localeReady && bootstrapReady;

  // نلتقط أحداث المجال في سجل التدقيق (PHASE 27) بمجرد جاهزية التمهيد.
  useEffect(() => {
    if (!ready) return;
    const unwire = wireAudit(() => sessionActor(state.session));
    return () => unwire();
    // نربط مرة واحدة عند الجاهزية (المنفّذ يُقرأ لحظيًا من الجلسة الحالية).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </View>
    );
  }
  // نلف الشجرة بمزود الإعداد ثم سياق المستأجر ثم سلة البيع
  // (السلة تعتمد على عملة/ضريبة/متجر سياق الاستئجار).
  return (
    <SetupProvider repository={setupRepository}>
      <TenancyProvider
        repository={tenancyRepository}
        session={state.session}
        storeSetupCompleted={state.storeSetupCompleted}
      >
        <SyncProvider>
          <CartProvider>{children}</CartProvider>
        </SyncProvider>
      </TenancyProvider>
    </SetupProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    logger.info('Application bootstrap started', {
      app: APP_NAME,
      version: APP_VERSION,
      environment: env.appEnvironment,
      locale: env.defaultLocale,
      currency: env.defaultCurrency,
    });
  }, []);

  return (
    <SafeAreaProvider>
      <LocaleProvider preferencesRepository={preferencesRepository}>
        <ThemeProvider preferencesRepository={preferencesRepository}>
          <BootstrapProvider
            preferencesRepository={preferencesRepository}
            sessionRepository={sessionRepository}
          >
            <ToastProvider>
              <ThemedStatusBar />
              <AppGate>
                <SecurityProvider repository={securityRepository}>
                  <ThemedStack />
                  {/* طبقة القفل التلقائي (PHASE 26) — تحجب المحتوى عند القفل. */}
                  <LockOverlay />
                </SecurityProvider>
              </AppGate>
            </ToastProvider>
          </BootstrapProvider>
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

/**
 * حاجز أخطاء الإنتاج (PHASE 30) — تلتقطه expo-router عند خطأ غير ممسوك
 * في أي شاشة وتعرض واجهة لائقة مع زر إعادة محاولة بدل شاشة انهيار فنية.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry?: () => void }) {
  return <CrashBoundary error={error} retry={retry} />;
}
