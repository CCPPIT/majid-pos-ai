/**
 * اختبارات PHASE 09 — معالج إعداد المتجر.
 * تغطي: التحقق النقي، بناء الهرمية من الملف، المستودع، والمصدر المحلي.
 */
import {
  BUSINESS_TYPE_OPTIONS,
  CODE_MAX_LENGTH,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY_BY_COUNTRY,
  DEFAULT_TAX_BY_COUNTRY,
} from '@/domain/setup/options';
import {
  buildTenancyFromProfile,
  SETUP_IDS,
} from '@/domain/setup/builder';
import {
  isProfileComplete,
  isValidName,
  isValidStoreCode,
  isValidTaxRate,
  validateStep,
} from '@/domain/setup/validation';
import { SETUP_STEPS, type StoreSetupProfile } from '@/domain/setup/types';
import { LocalSetupSource } from '@/data/sources/setup.source';
import { AppSetupRepository } from '@/data/repositories/setup.repository';
import { MockTenancySource } from '@/data/sources/tenancy.source';

// ملف تعريفي صالح للاختبارات.
function validProfile(overrides: Partial<StoreSetupProfile> = {}): StoreSetupProfile {
  return {
    businessName: 'متاجر الاختبار',
    businessType: 'retail',
    country: 'YE',
    currency: 'YER',
    taxRatePercent: 5,
    branchName: 'فرع صنعاء',
    branchCity: 'صنعاء',
    storeName: 'متجر حدة',
    storeCode: 'SNH-01',
    managerName: '',
    completedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

// مخزن نصي في الذاكرة (يحاكي التفضيلات).
function memoryStore() {
  const map = new Map<string, string>();
  return {
    getString: jest.fn(async (key: string) => (map.has(key) ? (map.get(key) as string) : null)),
    setString: jest.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    _map: map,
  };
}

describe('PHASE 09 — setup validation', () => {
  it('يقبل اسمًا صالحًا ويرفض الفارغ والطويل', () => {
    expect(isValidName('متاجر ماجد')).toBe(true);
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('x'.repeat(CODE_MAX_LENGTH + 100))).toBe(false);
  });

  it('يتحقق من كود المتجر (حروف/أرقام/شرطات فقط)', () => {
    expect(isValidStoreCode('SNH-01')).toBe(true);
    expect(isValidStoreCode('snh 02')).toBe(false); // فراغ.
    expect(isValidStoreCode('كود')).toBe(false); // أحرف عربية.
    expect(isValidStoreCode('')).toBe(false);
  });

  it('يتحقق من نسبة الضريبة ضمن الحدود', () => {
    expect(isValidTaxRate(0)).toBe(true);
    expect(isValidTaxRate(15)).toBe(true);
    expect(isValidTaxRate(101)).toBe(false);
    expect(isValidTaxRate(-1)).toBe(false);
    expect(isValidTaxRate(Number.NaN)).toBe(false);
  });

  it('يعتبر الملف الكامل مكتملًا والناقص غير مكتمل', () => {
    expect(isProfileComplete(validProfile())).toBe(true);
    const missing = validProfile();
    delete (missing as Partial<StoreSetupProfile>).businessName;
    expect(isProfileComplete(missing)).toBe(false);
    // المدير اختياري — لا يؤثر على الاكتمال.
    expect(isProfileComplete(validProfile({ managerName: 'ماجد' }))).toBe(true);
  });

  it('validateStep يرفض كل خطوة بياناتها ناقصة ويقبلها بعد استيفائها', () => {
    const empty: Partial<StoreSetupProfile> = {};
    expect(validateStep('business', empty).valid).toBe(false);
    expect(validateStep('location', empty).valid).toBe(false);
    expect(validateStep('tax', empty).valid).toBe(false);
    expect(validateStep('store', empty).valid).toBe(false);
    // المدير والمراجعة: المراجعة تكتمل بملف صالح.
    expect(validateStep('manager', empty).valid).toBe(true); // اختياري.
    expect(validateStep('review', validProfile()).valid).toBe(true);
  });
});

describe('PHASE 09 — options', () => {
  it('قوائم الاختيار غير فارغة ومترابطة', () => {
    expect(BUSINESS_TYPE_OPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(COUNTRY_OPTIONS.some((c) => c.value === 'YE')).toBe(true);
    expect(CURRENCY_OPTIONS.some((c) => c.value === 'YER')).toBe(true);
  });

  it('لكل دولة عملة وضريبة افتراضية صالحة', () => {
    for (const country of COUNTRY_OPTIONS) {
      expect(DEFAULT_CURRENCY_BY_COUNTRY[country.value]).toBeDefined();
      expect(DEFAULT_TAX_BY_COUNTRY[country.value]).toBeGreaterThanOrEqual(0);
      expect(CURRENCY_OPTIONS.some((c) => c.value === DEFAULT_CURRENCY_BY_COUNTRY[country.value])).toBe(true);
    }
  });
});

describe('PHASE 09 — builder', () => {
  it('يبني هرمية مستأجر من الملف التعريفي بمعرّفات ثابتة', () => {
    const profile = validProfile();
    const built = buildTenancyFromProfile(profile, '2026-08-28T10:00:00.000Z');
    const { data } = built;
    // المعرفات الثابتة.
    expect(String(data.tenant.id)).toBe(SETUP_IDS.tenant);
    expect(String(data.organization.id)).toBe(SETUP_IDS.organization);
    expect(String(data.branches[0]?.id)).toBe(SETUP_IDS.branch);
    expect(String(data.stores[0]?.id)).toBe(SETUP_IDS.store);
    // الحقول منقولة.
    expect(data.tenant.name).toBe('متاجر الاختبار');
    expect(data.tenant.defaultCurrency).toBe('YER');
    expect(data.organization.industry).toBe('retail');
    expect(data.stores[0]?.taxRatePercent).toBe(5);
    expect(data.stores[0]?.code).toBe('SNH-01');
    expect(data.branches[0]?.city).toBe('صنعاء');
    // المتجر النشط = المتجر الأول.
    expect(String(built.activeStoreId)).toBe(SETUP_IDS.store);
  });

  it('الناتج حتمي (deterministic) لنفس الملف', () => {
    const a = buildTenancyFromProfile(validProfile(), '2026-01-01T00:00:00.000Z');
    const b = buildTenancyFromProfile(validProfile(), '2026-01-01T00:00:00.000Z');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('يطبّع كود المتجر لأحرف كبيرة ويزيل الفراغات', () => {
    const built = buildTenancyFromProfile(validProfile({ storeCode: 'snh 9' }), '2026-01-01T00:00:00.000Z');
    expect(built.data.stores[0]?.code).toBe('SNH-9');
  });

  it('عدد خطوات المعالج 6 والمراجعة آخرها', () => {
    expect(SETUP_STEPS).toHaveLength(6);
    expect(SETUP_STEPS[SETUP_STEPS.length - 1]).toBe('review');
  });
});

describe('PHASE 09 — repository & local source', () => {
  it('يحفظ الملف ويستعيده (round-trip) ويعتبر الإعداد مكتملًا', async () => {
    const store = memoryStore();
    const source = new LocalSetupSource(store);
    const repo = new AppSetupRepository(source);
    // قبل الحفظ: غير مكتمل.
    expect(await repo.isSetupComplete()).toBe(false);
    expect(await repo.getProfile()).toBeNull();
    // بعد الحفظ: مكتمل.
    const built = await repo.submitProfile(validProfile());
    expect(String(built.activeStoreId)).toBe(SETUP_IDS.store);
    expect(await repo.isSetupComplete()).toBe(true);
    const restored = await repo.getProfile();
    expect(restored?.businessName).toBe('متاجر الاختبار');
    expect(restored?.storeCode).toBe('SNH-01');
  });

  it('يرفض حفظ ملف ناقص', async () => {
    const repo = new AppSetupRepository(new LocalSetupSource(memoryStore()));
    const incomplete = validProfile();
    delete (incomplete as Partial<StoreSetupProfile>).storeCode;
    await expect(repo.submitProfile(incomplete)).rejects.toThrow();
  });

  it('مصدر المستأجرين يبني من ملف الإعداد ويعود للتجريبي عند غيابه', async () => {
    // بملف إعداد.
    const withSetup = new MockTenancySource(new LocalSetupSource(memoryStore()));
    expect(await withSetup.getTenantData()).toBeDefined();
    // يحفظ الملف ثم يبني منه.
    const setupSource = new LocalSetupSource(memoryStore());
    await setupSource.saveProfile(validProfile({ businessName: 'سلسلة خاصة', currency: 'SAR' }));
    const source = new MockTenancySource(setupSource);
    const data = await source.getTenantData();
    expect(data.tenant.name).toBe('سلسلة خاصة');
    expect(data.stores[0]?.currency).toBe('SAR');
    // بلا مصدر إعداد → البيانات التجريبية (4 متاجر).
    const demo = new MockTenancySource();
    const demoData = await demo.getTenantData();
    expect(demoData.stores).toHaveLength(4);
  });
});
