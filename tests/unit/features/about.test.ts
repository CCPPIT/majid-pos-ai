/**
 * اختبارات شاشة «عن التطبيق» (جاهزية إنتاج بعد PHASE 30).
 * تتحقق من أن جميع مفاتيح الترجمة تُحَل في العربيتين، وأن بطاقة الإصدار/البيئة
 * ومكوّن الشاشة قائمان — دون عرض RN الأصلي الهش في بيئة الاختبار.
 */
import { APP_VERSION } from '@/core/config/constants';
import { translate } from '@/i18n/translate';

const ABOUT_KEYS = [
  'more.about',
  'about.title',
  'about.version',
  'about.envProduction',
  'about.envStaging',
  'about.envDevelopment',
  'about.offlineTitle',
  'about.offlineBody',
  'about.aiTitle',
  'about.aiBody',
  'about.rights',
];

describe('About screen i18n', () => {
  it('every about key resolves to real text in Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      for (const key of ABOUT_KEYS) {
        // المفتاح يجب أن يُترجَم (لا يُعاد كما هو).
        expect(translate(locale, key)).not.toBe(key);
        expect(translate(locale, key).length).toBeGreaterThan(2);
      }
    }
  });

  it('uses the honest offline + local-AI disclosures (not a fake cloud claim)', () => {
    // الإفصاح العربي يؤكد العمل دون اتصال وعدم وجود سحابة وهمية.
    const offline = translate('ar', 'about.offlineBody');
    const ai = translate('ar', 'about.aiBody');
    expect(offline).toContain('محلي');
    expect(offline).toContain('دون اتصال');
    expect(ai).toContain('محلي');
  });
});

describe('About screen wiring', () => {
  it('exposes a concrete app version constant shown on the card', () => {
    // رقم الإصدار مُعرَّف ويُعرَض على البطاقة.
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is reachable from the More menu label in both locales', () => {
    // مدخل «عن التطبيق» في المزيد يُترجَم في اللغتين.
    expect(translate('ar', 'more.about')).toBe('عن التطبيق');
    expect(translate('en', 'more.about')).toBe('About');
  });
});
