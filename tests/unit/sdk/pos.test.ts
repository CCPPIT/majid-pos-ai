/**
 * اختبارات نقطة البيع والتركيب الكامل — PHASE 31 · أقسام 37 و58 و59.
 *
 * هذه المجموعة تختبر الـSDK **مُركَّبًا كاملًا** عبر `createMajidSDK`،
 * لا خدمة معزولة: كل حالة تمر بالسلسلة الحقيقية
 * (سلة → فاتورة → دفع → مخزون → إيصال)، فتُثبت أن الحقن يعمل
 * وأن الخدمات تتكامل فعلًا لا نظريًا.
 */
import { createMajidSDK } from '@/sdk';
import { API_VERSION, CONTRACT_VERSION, SDK_VERSION, asProductId } from '@/sdk/core';
import {
  createInMemoryCustomerRepository,
  createInMemoryInventoryRepository,
  createInMemoryPaymentRepository,
  createInMemoryProductRepository,
  createInMemoryRbacRepository,
  createInMemorySaleRepository,
  createInMemoryTenancyRepository,
  createTestPaymentProvider,
  fixedClock,
  makeSDKProduct,
  makeStockLevel,
  ownerRole,
  recordingAudit,
  recordingEvents,
  testContext,
} from '../../helpers/sdk-mocks';

// يركّب نسخة SDK كاملة ببيانات اختبار متسقة.
const setupSDK = (
  options: {
    readonly stock?: number;
    readonly providers?: readonly ReturnType<typeof createTestPaymentProvider>[];
    readonly permissions?: readonly string[];
  } = {},
) => {
  // رصيد المنتج الابتدائي.
  const stock = options.stock ?? 100;
  // السياق.
  const contextStore = testContext(options.permissions ? { permissions: options.permissions } : {});
  // المسجّلات.
  const events = recordingEvents();
  const audit = recordingAudit();
  // المنتج محل الاختبار (سعره 1000 شامل الضريبة).
  const product = makeSDKProduct({
    id: asProductId('p-1'),
    stock: { quantity: stock, status: 'in_stock', lowStockThreshold: 10 },
  });
  // مستودعات في الذاكرة تحقق العقود كاملة.
  const repositories = {
    products: createInMemoryProductRepository([product]),
    sales: createInMemorySaleRepository(),
    payments: createInMemoryPaymentRepository(),
    inventory: createInMemoryInventoryRepository([makeStockLevel({ productId: asProductId('p-1'), quantity: stock })]),
    customers: createInMemoryCustomerRepository(),
    rbac: createInMemoryRbacRepository([ownerRole()]),
    tenancy: createInMemoryTenancyRepository(),
  };
  // التركيب الكامل عبر نقطة الدخول الرسمية.
  const sdk = createMajidSDK({
    context: contextStore.get(),
    repositories,
    providers: options.providers ? { payment: options.providers } : undefined,
    events,
    audit,
    clock: fixedClock(),
  });
  return { sdk, repositories, events, audit };
};

describe('SDK — التركيب الكامل', () => {
  // الإصدارات معلنة صراحةً (تعاقد مع المستهلك).
  it('يعلن إصداراته الثلاثة', () => {
    const { sdk } = setupSDK();
    expect(sdk.version).toBe(SDK_VERSION);
    expect(sdk.apiVersion).toBe(API_VERSION);
    expect(sdk.contractVersion).toBe(CONTRACT_VERSION);
  });

  // كل المجالات الإلزامية مُركَّبة وجاهزة.
  it('يُركّب كل الخدمات الإلزامية', () => {
    const { sdk } = setupSDK();
    // الخدمات التي لا تعتمد على مزوّد خارجي حاضرة دائمًا.
    expect(sdk.rbac).toBeDefined();
    expect(sdk.tenancy).toBeDefined();
    expect(sdk.products).toBeDefined();
    expect(sdk.cart).toBeDefined();
    expect(sdk.sales).toBeDefined();
    expect(sdk.payments).toBeDefined();
    expect(sdk.inventory).toBeDefined();
    expect(sdk.customers).toBeDefined();
    expect(sdk.pos).toBeDefined();
    expect(sdk.analytics).toBeDefined();
  });

  // الخدمات المعتمدة على مزوّد غائب لا تُركَّب (لا تنفيذ وهمي).
  it('لا يُركّب خدمات بلا مزوّديها', () => {
    const { sdk } = setupSDK();
    // بلا مزوّد مصادقة لا خدمة مصادقة.
    expect(sdk.auth).toBeUndefined();
    // وبلا مزوّد ذكاء لا خدمة ذكاء.
    expect(sdk.ai).toBeUndefined();
  });

  // إنهاء الجلسة يمسح السياق (لا تسرّب بين المستخدمين).
  it('يمسح السياق عند إنهاء الجلسة', () => {
    const { sdk } = setupSDK();
    // قبل الإنهاء المستأجر موجود.
    expect(sdk.context.get().tenantId).toBeDefined();
    // بعده يُمسح.
    sdk.dispose();
    expect(sdk.context.get().tenantId).toBeUndefined();
  });
});

describe('SDK POS — إدارة السلة', () => {
  // اللقطة الابتدائية سلة فارغة لا يمكن بيعها.
  it('يبدأ بسلة فارغة لا تقبل البيع', () => {
    const { sdk } = setupSDK();
    const snapshot = sdk.pos.snapshot();
    expect(snapshot.totals.isEmpty).toBe(true);
    // لا بيع لسلة فارغة.
    expect(snapshot.canCheckout).toBe(false);
  });

  // إضافة منتج تُحدّث اللقطة فورًا.
  it('يضيف منتجًا فتتحدّث اللقطة', async () => {
    const { sdk } = setupSDK();
    const result = await sdk.pos.addToCart(asProductId('p-1'), 2);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // بند واحد بكمية 2.
    expect(result.data.cart.items).toHaveLength(1);
    expect(result.data.cart.items[0]?.quantity).toBe(2);
    // وصارت قابلة للبيع.
    expect(result.data.canCheckout).toBe(true);
  });

  // منتج غير موجود يُرفض.
  it('يرفض إضافة منتج غير موجود', async () => {
    const { sdk } = setupSDK();
    const result = await sdk.pos.addToCart(asProductId('غائب'), 1);
    expect(result.success).toBe(false);
  });

  // مسح باركود يضيف المنتج مباشرة.
  it('يمسح باركودًا فيضيف المنتج للسلة', async () => {
    const { sdk } = setupSDK();
    const result = await sdk.pos.scanBarcode('6291000000011');
    expect(result.success).toBe(true);
    // والسلة صارت تحوي بندًا.
    expect(sdk.pos.snapshot().cart.items).toHaveLength(1);
  });

  // باركود مجهول يُرفض بلا إضافة.
  it('يرفض باركودًا مجهولًا بلا تعديل السلة', async () => {
    const { sdk } = setupSDK();
    const result = await sdk.pos.scanBarcode('0000000000000');
    expect(result.success).toBe(false);
    // السلة لم تتأثر.
    expect(sdk.pos.snapshot().cart.items).toHaveLength(0);
  });

  // تفريغ السلة يُعيدها فارغة.
  it('يفرّغ السلة', async () => {
    const { sdk } = setupSDK();
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    // التفريغ يُعيد لقطة فارغة.
    expect(sdk.pos.clearCart().totals.isEmpty).toBe(true);
  });
});

describe('SDK POS — إتمام البيع الكامل', () => {
  // المسار السعيد كاملًا: فاتورة + دفعة + خصم مخزون + إيصال.
  it('ينفّذ البيع كاملًا من السلة إلى الإيصال', async () => {
    const { sdk } = setupSDK();
    // بندان بسعر 1000 لكل وحدة.
    await sdk.pos.addToCart(asProductId('p-1'), 2);
    // إتمام البيع نقدًا بمبلغ كافٍ.
    const result = await sdk.pos.checkout({ method: 'cash', tendered: 5000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // فاتورة مُنشأة بإجمالي 2000.
    expect(result.data.sale.total.amount).toBe(2000);
    // دفعة ناجحة.
    expect(result.data.payment.status).toBe('succeeded');
    // إيصال جاهز بالبند نفسه.
    expect(result.data.receipt.lines).toHaveLength(1);
    // والباقي 3000.
    expect(result.data.change.amount).toBe(3000);
  });

  // البيع يخصم المخزون فعليًا.
  it('يخصم المخزون بعد البيع', async () => {
    const { sdk, repositories } = setupSDK({ stock: 100 });
    await sdk.pos.addToCart(asProductId('p-1'), 3);
    await sdk.pos.checkout({ method: 'cash', tendered: 5000 });
    // الرصيد نقص ثلاث وحدات.
    const level = await repositories.inventory.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(97);
  });

  // البيع يفرّغ السلة بعد النجاح (استعداد للعملية التالية).
  it('يفرّغ السلة بعد بيع ناجح', async () => {
    const { sdk } = setupSDK();
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    await sdk.pos.checkout({ method: 'cash', tendered: 1000 });
    // السلة فارغة الآن.
    expect(sdk.pos.snapshot().totals.isEmpty).toBe(true);
  });

  // السلة الفارغة لا تُباع.
  it('يرفض إتمام بيع بسلة فارغة', async () => {
    const { sdk } = setupSDK();
    const result = await sdk.pos.checkout({ method: 'cash', tendered: 1000 });
    expect(result.success).toBe(false);
  });

  // النقد الناقص يُرفض ولا يترك أثرًا.
  it('يرفض النقد الناقص بلا خصم مخزون', async () => {
    const { sdk, repositories } = setupSDK({ stock: 100 });
    await sdk.pos.addToCart(asProductId('p-1'), 2);
    // المُسلَّم أقل من المستحق (2000).
    const result = await sdk.pos.checkout({ method: 'cash', tendered: 500 });
    expect(result.success).toBe(false);
    // المخزون لم يُمس.
    const level = await repositories.inventory.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(100);
  });

  // البيع فوق الرصيد ممنوع قبل أي إنشاء فاتورة.
  it('يرفض بيع كمية تتجاوز الرصيد', async () => {
    const { sdk, repositories } = setupSDK({ stock: 2 });
    // نضيف أكثر من الرصيد.
    await sdk.pos.addToCart(asProductId('p-1'), 5);
    const result = await sdk.pos.checkout({ method: 'cash', tendered: 99_000 });
    expect(result.success).toBe(false);
    // ولا فاتورة مُنشأة.
    const sales = await repositories.sales.list();
    if (sales.success) expect(sales.data.items).toHaveLength(0);
  });

  // البيع بالبطاقة يمر عبر المزوّد بالترتيب الصحيح.
  it('يُتم البيع بالبطاقة عبر المزوّد', async () => {
    const provider = createTestPaymentProvider();
    const { sdk } = setupSDK({ providers: [provider] });
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    const result = await sdk.pos.checkout({ method: 'card' });
    expect(result.success).toBe(true);
    // التفويض ثم التحصيل.
    expect(provider.calls).toEqual(['authorize', 'capture']);
  });

  // رفض البوابة يوقف البيع ولا يخصم مخزونًا.
  it('يوقف البيع عند رفض البوابة بلا خصم مخزون', async () => {
    const provider = createTestPaymentProvider({ approve: false });
    const { sdk, repositories } = setupSDK({ providers: [provider], stock: 50 });
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    const result = await sdk.pos.checkout({ method: 'card' });
    expect(result.success).toBe(false);
    // المخزون سليم.
    const level = await repositories.inventory.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(50);
  });

  // البيع ينشر أحداثًا ويترك أثر تدقيق.
  it('ينشر أحداثًا ويسجّل تدقيقًا عبر السلسلة', async () => {
    const { sdk, events, audit } = setupSDK();
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    await sdk.pos.checkout({ method: 'cash', tendered: 1000 });
    // أحداث البيع والدفع والمخزون منشورة.
    const names = events.events.map((event) => event.name);
    expect(names.some((name) => name.includes('sale'))).toBe(true);
    expect(names.some((name) => name.includes('payment'))).toBe(true);
    // وأثر التدقيق يغطي أكثر من عملية.
    expect(audit.entries.length).toBeGreaterThan(1);
  });
});

describe('SDK POS — حراسة الصلاحيات', () => {
  // بلا صلاحية بيع لا إتمام (الحراسة على مستوى الخدمة لا الواجهة).
  it('يمنع إتمام البيع بلا صلاحية', async () => {
    // صلاحيات قراءة فقط.
    const { sdk } = setupSDK({ permissions: ['products.read', 'pos.read'] });
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    const result = await sdk.pos.checkout({ method: 'cash', tendered: 1000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('AUTHORIZATION_ERROR');
  });

  // منع البيع لا يترك أثرًا في المخزون ولا في الفواتير.
  it('لا يترك أثرًا عند منع الصلاحية', async () => {
    const { sdk, repositories } = setupSDK({ permissions: ['products.read'], stock: 20 });
    await sdk.pos.addToCart(asProductId('p-1'), 1);
    await sdk.pos.checkout({ method: 'cash', tendered: 1000 });
    // لا فواتير.
    const sales = await repositories.sales.list();
    if (sales.success) expect(sales.data.items).toHaveLength(0);
    // ولا خصم مخزون.
    const level = await repositories.inventory.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(20);
  });
});
