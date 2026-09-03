/**
 * اختبارات نواة الـSDK — PHASE 31 · قسم 59.
 * تغطي: Result · نظام الأخطاء · المال · الترقيم · المرشّحات · الفرز · السياق.
 */
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  ContextError,
  NotFoundError,
  SDK_VERSION,
  ValidationError,
  addMoney,
  applyFilters,
  applySort,
  asProductId,
  createContext,
  createContextStore,
  createDomainEvent,
  failure,
  isFailure,
  isSuccess,
  map,
  money,
  multiplyMoney,
  paginate,
  percentageOf,
  requireContext,
  subtractMoney,
  success,
  sumMoney,
  toCurrencyCode,
  toSDKError,
  unwrapOr,
  zeroMoney,
  type Result,
  type SDKError,
} from '@/sdk/core';

describe('SDK Core — Result', () => {
  // النجاح يحمل البيانات ويُميَّز بعلم success.
  it('يبني نتيجة نجاح تحمل البيانات', () => {
    const result = success(42);
    expect(result.success).toBe(true);
    expect(isSuccess(result)).toBe(true);
    // الوصول للبيانات بعد التضييق النوعي.
    if (result.success) expect(result.data).toBe(42);
  });

  // الفشل يحمل الخطأ ولا يحمل بيانات.
  it('يبني نتيجة فشل تحمل الخطأ', () => {
    const result = failure(new NotFoundError('product', 'p-1'));
    expect(result.success).toBe(false);
    expect(isFailure(result)).toBe(true);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });

  // التحويل يطبَّق على النجاح فقط.
  it('يحوّل قيمة النجاح ويترك الفشل كما هو', () => {
    expect(unwrapOr(map(success(5), (n) => n * 2), 0)).toBe(10);
    // الفشل يمر دون استدعاء دالة التحويل.
    const failed = failure<SDKError>(new ConflictError('taken'));
    expect(unwrapOr(map(failed as Result<number, SDKError>, (n) => n * 2), -1)).toBe(-1);
  });
});

describe('SDK Core — نظام الأخطاء', () => {
  // كل نوع خطأ يحمل كوده الثابت.
  it('يحمل كل خطأ كوده المميّز', () => {
    expect(new NotFoundError('product', 'p-1').code).toBe('NOT_FOUND');
    expect(new ValidationError('bad', { name: 'required' }).code).toBe('VALIDATION_ERROR');
    expect(new AuthorizationError().code).toBe('AUTHORIZATION_ERROR');
    expect(new ConflictError('dup').code).toBe('CONFLICT');
    expect(new BusinessRuleError('rule').code).toBe('BUSINESS_RULE_ERROR');
    expect(new ContextError(['tenantId']).code).toBe('CONTEXT_ERROR');
  });

  // أخطاء التفويض والتحقق لا تُعاد المحاولة فيها.
  it('يصنّف قابلية إعادة المحاولة تصنيفًا صحيحًا', () => {
    expect(new AuthorizationError().retryable).toBe(false);
    expect(new ValidationError().retryable).toBe(false);
  });

  // أخطاء التحقق تحمل خريطة حقول للعرض في النماذج.
  it('يحمل خطأ التحقق أخطاء الحقول', () => {
    const error = new ValidationError('sdk.error.validation', { nameAr: 'sdk.validation.required' });
    expect(error.fieldErrors.nameAr).toBe('sdk.validation.required');
  });

  // خطأ السياق يذكر الحقول الناقصة تحديدًا.
  it('يذكر خطأ السياق الحقول الناقصة', () => {
    const error = new ContextError(['tenantId', 'storeId']);
    expect(error.missing).toEqual(['tenantId', 'storeId']);
  });

  // جسر التحويل من نظام الأخطاء القديم يحوّل أي قيمة إلى SDKError.
  it('يحوّل أي خطأ خام إلى SDKError مصنّف', () => {
    // خطأ JS قياسي يُغلَّف كخطأ غير معروف مع حفظ الرسالة.
    const wrapped = toSDKError(new Error('boom'));
    expect(wrapped.code).toBe('UNKNOWN_ERROR');
    expect(wrapped.message).toBe('boom');
    // قيمة خام غير كائن تُحوَّل أيضًا بلا رمي.
    expect(toSDKError('نص خام').code).toBe('UNKNOWN_ERROR');
  });
});

describe('SDK Core — المال', () => {
  // العملة نوع مُقيَّد يمنع الأخطاء الصامتة.
  const YER = toCurrencyCode('YER');

  // الجمع والطرح يحفظان العملة.
  it('يجمع ويطرح المبالغ بنفس العملة', () => {
    expect(addMoney(money(100, YER), money(50, YER)).amount).toBe(150);
    expect(subtractMoney(money(100, YER), money(30, YER)).amount).toBe(70);
  });

  // الضرب في كمية.
  it('يضرب المبلغ في كمية', () => {
    expect(multiplyMoney(money(250, YER), 4).amount).toBe(1000);
  });

  // النسبة المئوية أساس حساب الضريبة والخصم.
  it('يحسب نسبة مئوية من مبلغ', () => {
    expect(percentageOf(money(1000, YER), 15).amount).toBe(150);
  });

  // الجمع التراكمي لقائمة مبالغ.
  it('يجمع قائمة مبالغ', () => {
    expect(sumMoney([money(10, YER), money(20, YER), money(30, YER)], YER).amount).toBe(60);
  });

  // المبلغ الصفري يحفظ العملة (لا صفر بلا عملة).
  it('يبني مبلغًا صفريًا بعملة محددة', () => {
    const zero = zeroMoney(YER);
    expect(zero.amount).toBe(0);
    expect(zero.currency).toBe('YER');
  });
});

describe('SDK Core — الترقيم والمرشّحات والفرز', () => {
  // بيانات اختبار بسيطة.
  const rows = [
    { id: 'a', name: 'تفاح', price: 300, active: true },
    { id: 'b', name: 'موز', price: 100, active: true },
    { id: 'c', name: 'برتقال', price: 200, active: false },
  ];

  // الترقيم يقصّ الصفحة ويحسب البيانات الوصفية.
  it('يُرقّم النتائج ويحسب بياناتها الوصفية', () => {
    const page = paginate(rows, { page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.pageInfo.total).toBe(3);
    expect(page.pageInfo.totalPages).toBe(2);
    expect(page.pageInfo.hasNext).toBe(true);
    expect(page.pageInfo.hasPrevious).toBe(false);
  });

  // الصفحة الأخيرة لا تحمل تاليًا.
  it('يحسب الصفحة الأخيرة بلا تالٍ', () => {
    const page = paginate(rows, { page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(1);
    expect(page.pageInfo.hasNext).toBe(false);
    expect(page.pageInfo.hasPrevious).toBe(true);
  });

  // المرشّحات بيانات لا دوال — قابلة للنقل للخادم لاحقًا.
  it('يطبّق مرشّح المساواة', () => {
    const filtered = applyFilters(rows, [{ field: 'active', operator: 'equals', value: true }]);
    expect(filtered).toHaveLength(2);
  });

  // مرشّح الاحتواء النصي.
  it('يطبّق مرشّح الاحتواء', () => {
    const filtered = applyFilters(rows, [{ field: 'name', operator: 'contains', value: 'تفا' }]);
    expect(filtered).toHaveLength(1);
  });

  // مرشّح المقارنة العددية.
  it('يطبّق مرشّح أكبر من', () => {
    const filtered = applyFilters(rows, [{ field: 'price', operator: 'greaterThan', value: 150 }]);
    expect(filtered).toHaveLength(2);
  });

  // مرشّح المدى.
  it('يطبّق مرشّح المدى', () => {
    const filtered = applyFilters(rows, [{ field: 'price', operator: 'between', value: [150, 250] }]);
    expect(filtered).toHaveLength(1);
  });

  // الفرز لا يُطفّر المصدر (دالة نقية).
  it('يفرز تصاعديًا دون تعديل المصدر', () => {
    const sorted = applySort(rows, { field: 'price', direction: 'asc' });
    expect(sorted[0]?.price).toBe(100);
    // المصدر لم يتغيّر.
    expect(rows[0]?.price).toBe(300);
  });
});

describe('SDK Core — السياق', () => {
  // السياق يمنع تنفيذ أي عملية بلا مستأجر.
  it('يرفض السياق الناقص ويذكر الحقول المفقودة', () => {
    const result = requireContext(createContext({}), ['tenantId', 'storeId']);
    expect(result.success).toBe(false);
    if (!result.success) expect((result.error as ContextError).missing).toContain('tenantId');
  });

  // السياق المكتمل يمر.
  it('يقبل السياق المكتمل', () => {
    const context = createContext({
      tenantId: 't-1' as never,
      storeId: 's-1' as never,
    });
    expect(requireContext(context, ['tenantId', 'storeId']).success).toBe(true);
  });

  // الحاوية تُخطر المشتركين عند التغيّر.
  it('تُخطر الحاوية المشتركين عند تغيّر السياق', () => {
    const store = createContextStore({});
    // عدّاد الإخطارات.
    let notifications = 0;
    // نشترك.
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    // نغيّر السياق.
    store.set({ tenantId: 't-1' as never });
    expect(notifications).toBe(1);
    // نلغي الاشتراك ثم نغيّر مجددًا.
    unsubscribe();
    store.set({ storeId: 's-1' as never });
    expect(notifications).toBe(1);
  });

  // المسح يفرّغ السياق بالكامل.
  it('يمسح السياق بالكامل', () => {
    const store = createContextStore({ tenantId: 't-1' as never });
    store.clear();
    expect(store.get().tenantId).toBeUndefined();
  });
});

describe('SDK Core — الأحداث والإصدار', () => {
  // كل حدث يحمل معرّفًا فريدًا ولحظة حدوث.
  it('يبني حدث مجال كامل البيانات الوصفية', () => {
    const event = createDomainEvent('sdk.product.created', { productId: 'p-1' }, { tenantId: 't-1' as never });
    expect(event.eventId).toBeTruthy();
    expect(event.name).toBe('sdk.product.created');
    expect(event.occurredAt).toBeTruthy();
    expect(event.tenantId).toBe('t-1');
  });

  // معرّفات الأحداث لا تتكرر.
  it('يولّد معرّفات أحداث فريدة', () => {
    const first = createDomainEvent('a', {});
    const second = createDomainEvent('a', {});
    expect(first.eventId).not.toBe(second.eventId);
  });

  // الإصدار معرَّف صراحةً (قسم 55).
  it('يعرّف إصدار الـSDK', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  // المعرّفات المُعلَّمة تمنع خلط الأنواع.
  it('يبني معرّفات مُعلَّمة من نصوص', () => {
    expect(String(asProductId('p-1'))).toBe('p-1');
  });
});
