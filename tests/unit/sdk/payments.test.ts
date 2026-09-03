/**
 * اختبارات خدمة الدفع — PHASE 31 · أقسام 39 و59.
 * المال لا يحتمل الغموض: كل حالة هنا تُثبت قاعدة مالية صريحة
 * (كفاية المُسلَّم · الباقي · حدود التحصيل · ترتيب التفويض والتحصيل ·
 * تخزين المحاولة الفاشلة · حدود الاسترجاع).
 */
import { money, type CurrencyCode } from '@/sdk/core';
import {
  AMOUNT_TOLERANCE,
  calculateChange,
  createPaymentService,
  isSufficient,
  requiresProvider,
  requiresTendered,
  splitsCoverTotal,
  splitsShortfall,
  splitsTotal,
  suggestQuickCash,
  toProviderMethod,
  type PaymentSplit,
} from '@/sdk/payments';
import { createRbacService } from '@/sdk/rbac';
import { createTenancyService } from '@/sdk/tenancy';
import {
  createInMemoryPaymentRepository,
  createInMemoryRbacRepository,
  createInMemorySaleRepository,
  createInMemoryTenancyRepository,
  createTestPaymentProvider,
  fixedClock,
  makeSale,
  ownerRole,
  recordingAudit,
  recordingEvents,
  testContext,
} from '../../helpers/sdk-mocks';

// العملة المستخدمة في كل الاختبارات.
const YER = 'YER' as CurrencyCode;

// يبني بيئة خدمة دفع كاملة بمزوّد اختياري.
const setup = (
  options: {
    readonly providers?: readonly ReturnType<typeof createTestPaymentProvider>[];
    readonly sales?: readonly ReturnType<typeof makeSale>[];
    readonly permissions?: readonly string[];
  } = {},
) => {
  // السياق (صلاحيات كاملة افتراضيًا).
  const contextStore = testContext(options.permissions ? { permissions: options.permissions } : {});
  // الأحداث والتدقيق مُسجَّلة للتحقق منها.
  const events = recordingEvents();
  const audit = recordingAudit();
  // مستودع الفواتير مع البذرة.
  const sales = createInMemorySaleRepository(options.sales ?? [makeSale()]);
  // مستودع الدفعات.
  const repository = createInMemoryPaymentRepository();
  // الصلاحيات والنطاق.
  const rbac = createRbacService({ repository: createInMemoryRbacRepository([ownerRole()]), contextStore });
  const tenancy = createTenancyService({ repository: createInMemoryTenancyRepository(), contextStore });
  // الخدمة محل الاختبار.
  const service = createPaymentService({
    repository,
    sales,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
    providers: options.providers,
    clock: fixedClock(),
  });
  return { service, repository, sales, events, audit, contextStore };
};

describe('SDK Payments — حسابات المال', () => {
  // الباقي = المُسلَّم − المستحق.
  it('يحسب الباقي للعميل', () => {
    expect(calculateChange(money(750, YER), money(1000, YER)).amount).toBe(250);
  });

  // الدفع بالضبط لا يُنتج باقيًا.
  it('لا يُنتج باقيًا عند الدفع بالضبط', () => {
    expect(calculateChange(money(1000, YER), money(1000, YER)).amount).toBe(0);
  });

  // النقص لا يُنتج باقيًا سالبًا.
  it('لا يُنتج باقيًا سالبًا عند النقص', () => {
    expect(calculateChange(money(1000, YER), money(400, YER)).amount).toBe(0);
  });

  // الكفاية تحتمل فروق التقريب ضمن التسامح المعلن.
  it('يعتبر المبلغ كافيًا ضمن تسامح التقريب', () => {
    expect(isSufficient(money(1000, YER), money(1000 - AMOUNT_TOLERANCE / 2, YER))).toBe(true);
    // وما دون التسامح غير كافٍ.
    expect(isSufficient(money(1000, YER), money(999, YER))).toBe(false);
  });

  // النقد وحده يتطلب مبلغًا مُسلَّمًا.
  it('يُلزم النقد وحده بالمبلغ المُسلَّم', () => {
    expect(requiresTendered('cash')).toBe(true);
    expect(requiresTendered('card')).toBe(false);
    expect(requiresTendered('credit')).toBe(false);
  });

  // البطاقة والمحفظة تتطلبان مزوّدًا؛ النقد والآجل لا.
  it('يُلزم الطرق الإلكترونية وحدها بمزوّد', () => {
    expect(requiresProvider('card')).toBe(true);
    expect(requiresProvider('wallet')).toBe(true);
    expect(requiresProvider('cash')).toBe(false);
    expect(requiresProvider('credit')).toBe(false);
  });

  // مجموع الأجزاء يُحسب بدقة.
  it('يجمع أجزاء الدفع المقسّم', () => {
    const splits: PaymentSplit[] = [
      { method: 'cash', amount: money(600, YER) },
      { method: 'card', amount: money(400, YER) },
    ];
    expect(splitsTotal(splits, YER).amount).toBe(1000);
    // ويغطي المستحق تمامًا.
    expect(splitsCoverTotal(splits, money(1000, YER))).toBe(true);
    // بلا عجز.
    expect(splitsShortfall(splits, money(1000, YER)).amount).toBe(0);
  });

  // الأجزاء الناقصة تُكتشف مع مقدار العجز.
  it('يكتشف عجز الدفع المقسّم ويقيسه', () => {
    const splits: PaymentSplit[] = [{ method: 'cash', amount: money(300, YER) }];
    expect(splitsCoverTotal(splits, money(1000, YER))).toBe(false);
    expect(splitsShortfall(splits, money(1000, YER)).amount).toBe(700);
  });

  // اقتراحات النقد السريع تتجاوز المستحق دائمًا.
  it('يقترح فئات نقدية تغطي المستحق', () => {
    const suggestions = suggestQuickCash(money(1750, YER), [500, 1000, 5000]);
    // كل اقتراح يكفي أو يزيد.
    expect(suggestions.every((suggestion) => suggestion.amount >= 1750)).toBe(true);
  });

  // ترجمة طرق الدفع لطرق المزوّد.
  it('يترجم طريقة الدفع لصيغة المزوّد', () => {
    expect(toProviderMethod('cash')).toBe('cash');
    expect(toProviderMethod('card')).toBe('card');
    expect(toProviderMethod('wallet')).toBe('wallet');
  });
});

describe('SDK Payments — التحصيل النقدي', () => {
  // المسار السعيد: دفعة مكتملة بباقٍ صحيح.
  it('يحصّل دفعة نقدية ويحسب الباقي', async () => {
    const { service } = setup();
    const result = await service.process({
      saleId: makeSale().id,
      method: 'cash',
      amount: 1000,
      tendered: 1500,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // الحالة مكتملة والباقي 500.
    expect(result.data.status).toBe('succeeded');
    expect(result.data.change.amount).toBe(500);
    expect(result.data.amount.amount).toBe(1000);
  });

  // النقد الناقص يُرفض قبل أي تخزين.
  it('يرفض النقد الناقص عن المستحق', async () => {
    const { service, repository } = setup();
    const result = await service.process({
      saleId: makeSale().id,
      method: 'cash',
      amount: 1000,
      tendered: 600,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
    // ولا دفعة مخزَّنة (الرفض قبل الكتابة).
    const stored = await repository.list();
    if (stored.success) expect(stored.data.items).toHaveLength(0);
  });

  // التحصيل فوق المتبقي ممنوع (لا تحصيل زائد).
  it('يرفض التحصيل فوق المتبقي على الفاتورة', async () => {
    const { service } = setup();
    const result = await service.process({
      saleId: makeSale().id,
      method: 'cash',
      amount: 5000,
      tendered: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
  });

  // الفاتورة الملغاة لا تُحصَّل.
  it('يرفض التحصيل على فاتورة ملغاة', async () => {
    const { service } = setup({ sales: [makeSale({ status: 'cancelled' })] });
    const result = await service.process({
      saleId: makeSale().id,
      method: 'cash',
      amount: 1000,
      tendered: 1000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
  });

  // الفاتورة الغائبة تُعيد NotFound.
  it('يرفض التحصيل على فاتورة غير موجودة', async () => {
    const { service } = setup();
    const result = await service.process({
      saleId: 'sale-غائبة' as ReturnType<typeof makeSale>['id'],
      method: 'cash',
      amount: 100,
      tendered: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });

  // نجاح التحصيل ينشر حدثًا ويسجّل تدقيقًا.
  it('ينشر حدثًا ويسجّل تدقيقًا عند النجاح', async () => {
    const { service, events, audit } = setup();
    await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    // حدث دفع منشور.
    expect(events.events.some((event) => event.name.includes('payment'))).toBe(true);
    // وأثر تدقيق مسجَّل.
    expect(audit.entries.length).toBeGreaterThan(0);
  });

  // الدفعة المحصَّلة تُربط بالفاتورة وتحدّث حالتها.
  it('يربط الدفعة بالفاتورة ويحدّث حالة الدفع', async () => {
    const { service, sales } = setup();
    await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    // الفاتورة صارت مدفوعة بالكامل.
    const sale = await sales.get(makeSale().id);
    if (!sale.success) return;
    expect(sale.data.paymentStatus).toBe('paid');
    expect(sale.data.paidAmount.amount).toBe(1000);
  });

  // الدفع الجزئي يترك الفاتورة جزئية.
  it('يترك الفاتورة جزئية عند الدفع الجزئي', async () => {
    const { service, sales } = setup();
    await service.process({ saleId: makeSale().id, method: 'cash', amount: 400, tendered: 400 });
    const sale = await sales.get(makeSale().id);
    if (!sale.success) return;
    expect(sale.data.paymentStatus).toBe('partial');
  });
});

describe('SDK Payments — مزوّد البوابة', () => {
  // البطاقة بلا مزوّد مسجَّل تُرفض صراحة.
  it('يرفض البطاقة عند غياب مزوّد', async () => {
    const { service } = setup({ providers: [] });
    const result = await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
  });

  // المسار السعيد: تفويض ثم تحصيل بهذا الترتيب.
  it('يفوّض ثم يحصّل بهذا الترتيب', async () => {
    const provider = createTestPaymentProvider();
    const { service } = setup({ providers: [provider] });
    const result = await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    expect(result.success).toBe(true);
    // الترتيب محفوظ: التفويض قبل التحصيل.
    expect(provider.calls).toEqual(['authorize', 'capture']);
  });

  // رفض البوابة يُخزَّن كدفعة فاشلة (أثر تدقيق مالي).
  it('يخزّن المحاولة المرفوضة كدفعة فاشلة', async () => {
    const provider = createTestPaymentProvider({ approve: false });
    const { service, repository } = setup({ providers: [provider] });
    const result = await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    // العملية تفشل...
    expect(result.success).toBe(false);
    // ...لكن الأثر محفوظ.
    const stored = await repository.list();
    if (!stored.success) return;
    expect(stored.data.items).toHaveLength(1);
    expect(stored.data.items[0]?.status).toBe('failed');
  });

  // الرفض لا يحصّل ولا يمس الفاتورة.
  it('لا يحصّل ولا يحدّث الفاتورة عند الرفض', async () => {
    const provider = createTestPaymentProvider({ approve: false });
    const { service, sales } = setup({ providers: [provider] });
    await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    // لا نداء تحصيل.
    expect(provider.calls).not.toContain('capture');
    // والفاتورة ما زالت غير مدفوعة.
    const sale = await sales.get(makeSale().id);
    if (sale.success) expect(sale.data.paymentStatus).toBe('unpaid');
  });

  // تعذّر الوصول للبوابة خطأ تقني لا يُخزَّن كدفعة فاشلة.
  it('يميّز تعذّر الوصول للبوابة عن رفضها', async () => {
    const provider = createTestPaymentProvider({ unreachable: true });
    const { service, repository } = setup({ providers: [provider] });
    const result = await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    // العملية تفشل بخطأ المزوّد.
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('PAYMENT_ERROR');
    // ولا دفعة مخزَّنة (لم تقع واقعة تجارية أصلًا).
    const stored = await repository.list();
    if (stored.success) expect(stored.data.items).toHaveLength(0);
  });

  // فشل التحصيل بعد تفويض ناجح خطأ صريح لا صمت.
  it('يُبلغ عن فشل التحصيل بعد تفويض ناجح', async () => {
    const provider = createTestPaymentProvider({ failCapture: true });
    const { service } = setup({ providers: [provider] });
    const result = await service.process({ saleId: makeSale().id, method: 'card', amount: 1000 });
    expect(result.success).toBe(false);
    // التفويض جرى فعلًا ثم فشل التحصيل.
    expect(provider.calls).toEqual(['authorize', 'capture']);
  });
});

describe('SDK Payments — الاسترجاع', () => {
  // الاسترجاع الكامل يُغيّر حالة الدفعة.
  it('يسترجع دفعة محصَّلة بالكامل', async () => {
    const { service } = setup();
    // نحصّل أولًا.
    const paid = await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    if (!paid.success) return;
    // ثم نسترجع.
    const refunded = await service.refund({ paymentId: paid.data.id, reasonKey: 'sdk.payments.reason.customer' });
    expect(refunded.success).toBe(true);
    if (!refunded.success) return;
    expect(refunded.data.status).toBe('refunded');
    expect(refunded.data.refundedAmount.amount).toBe(1000);
  });

  // الاسترجاع الجزئي يُسجَّل جزئيًا.
  it('يسترجع جزءًا من الدفعة', async () => {
    const { service } = setup();
    const paid = await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    if (!paid.success) return;
    const refunded = await service.refund({
      paymentId: paid.data.id,
      amount: 400,
      reasonKey: 'sdk.payments.reason.partial',
    });
    expect(refunded.success).toBe(true);
    if (refunded.success) expect(refunded.data.refundedAmount.amount).toBe(400);
  });

  // الاسترجاع فوق المحصَّل ممنوع.
  it('يرفض استرجاعًا يتجاوز المبلغ المحصَّل', async () => {
    const { service } = setup();
    const paid = await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    if (!paid.success) return;
    const refunded = await service.refund({
      paymentId: paid.data.id,
      amount: 5000,
      reasonKey: 'sdk.payments.reason.overreach',
    });
    expect(refunded.success).toBe(false);
  });

  // الاسترجاع يتطلب سببًا (لا استرجاع مجهول السبب).
  it('يرفض الاسترجاع بلا سبب', async () => {
    const { service } = setup();
    const paid = await service.process({ saleId: makeSale().id, method: 'cash', amount: 1000, tendered: 1000 });
    if (!paid.success) return;
    const refunded = await service.refund({ paymentId: paid.data.id, reasonKey: '' });
    expect(refunded.success).toBe(false);
    if (!refunded.success) expect(refunded.error.code).toBe('VALIDATION_ERROR');
  });

  // دفعة غير موجودة لا تُسترجع.
  it('يرفض استرجاع دفعة غير موجودة', async () => {
    const { service } = setup();
    const refunded = await service.refund({
      paymentId: 'pay-غائبة' as Awaited<ReturnType<typeof service.process>> extends never ? never : never,
      reasonKey: 'sdk.payments.reason.customer',
    });
    expect(refunded.success).toBe(false);
  });
});
