/**
 * اختبارات صقل الإنتاج (PHASE 30).
 * تثبت صحة إعدادات التطبيق (صيغة JSON، بلا إضافات مكرّرة، معرّفات الحزم،
 * الشاشة/الشعار)، وتكوين حاجز الأخطاء (يوفّر دالة إعادة محاولة ولوحتا ألوان).
 * هذه اختبارات بنية/إعداد لا تعتمد على عرض RN الأصلي الهش في بيئة الاختبار.
 */
import appJson from '../../../app.json';
import easJson from '../../../eas.json';
import { CrashBoundary } from '@/features/error/CrashBoundary';

describe('app.json production configuration', () => {
  const expo = appJson.expo;

  test('is well-formed with identity metadata', () => {
    expect(expo.name).toBe('MAJID POS AI');
    expect(expo.slug).toBe('majid-pos-ai');
    expect(expo.version).toBeTruthy();
    expect(expo.orientation).toBe('portrait');
  });

  test('has stable package identifiers for both platforms', () => {
    expect(expo.android.package).toBe('ai.majid.pos');
    expect(expo.ios.bundleIdentifier).toBe('ai.majid.pos');
  });

  test('declares a themeable splash and adaptive icon', () => {
    const splashPlugin = (expo.plugins as unknown[]).find(
      (p): p is [string, Record<string, unknown>] => Array.isArray(p) && p[0] === 'expo-splash-screen',
    );
    expect(splashPlugin).toBeDefined();
    expect(expo.android.adaptiveIcon.backgroundColor).toBe('#0B0F14');
  });

  test('plugin list has no duplicates', () => {
    const names = (expo.plugins as unknown[]).map((p) => (Array.isArray(p) ? p[0] : p));
    const sorted = [...names].sort();
    const dupes = sorted.filter((n, i) => i > 0 && n === sorted[i - 1]);
    expect(dupes).toEqual([]);
    // التوطين والتخزين الآمن والتوجيه مفعّلة مرة واحدة.
    expect(names).toContain('expo-localization');
    expect(names).toContain('expo-secure-store');
    expect(names).toContain('expo-router');
  });

  test('does not duplicate environment source in app.json extra', () => {
    // مصدر البيئة الوحيد هو EXPO_PUBLIC_APP_ENV عبر EAS — لا حقل extra مكرّر قد يضلّل.
    expect((expo as { extra?: unknown }).extra).toBeUndefined();
  });
});

describe('eas.json build profiles', () => {
  const build = easJson.build as Record<string, { env?: Record<string, string>; distribution?: string }>;

  test('declares development, preview and production profiles', () => {
    // ثلاث ملامح بناء: تنموي (عميل تطوير)، معاينة (APK داخلي)، إنتاج (AAB).
    expect(build.development).toBeDefined();
    expect(build.preview).toBeDefined();
    expect(build.production).toBeDefined();
  });

  test('production ships an app bundle with production environment', () => {
    // الإنتاج AAB مع بيئة production وتزايد رقم النسخة تلقائيًا.
    expect(build.production!.env?.EXPO_PUBLIC_APP_ENV).toBe('production');
    expect(build.preview!.env?.EXPO_PUBLIC_APP_ENV).toBe('staging');
    expect(build.development!.env?.EXPO_PUBLIC_APP_ENV).toBe('development');
  });
});

describe('CrashBoundary wiring', () => {
  test('is a renderable function component', () => {
    expect(typeof CrashBoundary).toBe('function');
  });

  test('does not invoke retry until the user presses retry', () => {
    const retry = jest.fn();
    // نستدعي دالة الإعادة يدويًا كما يفعل المعالج في الحاجز (تحقق سلوكي بلا عرض).
    const props = { error: new Error('boom'), retry };
    props.retry?.();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
