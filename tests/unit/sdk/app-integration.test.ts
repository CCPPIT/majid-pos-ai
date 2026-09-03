/**
 * اختبارات جسر التكامل مع التطبيق القائم — PHASE 31 · أقسام 65 و66.
 *
 * هذه المجموعة تحرس **حدود الترحيل**: أن السياق يُشتق من الجلسة بأمانة،
 * وأن غياب الجلسة يمنع العمليات (لا تنفيذ بلا هوية)، وأن أحداث الـSDK
 * تصل فعلًا لناقل التطبيق القائم دون تعديل أي مشترك حالي.
 */
import { appEventBus } from '@/core/events/EventBus';
import { asProductId } from '@/sdk/core';
import { contextFromSession, createAppSDK } from '@/shared/sdk-container';
import type { Session } from '@/domain/identity/types';
import {
  createInMemoryCustomerRepository,
  createInMemoryInventoryRepository,
  createInMemoryPaymentRepository,
  createInMemorySaleRepository,
  createInMemoryTenancyRepository,
  makeStockLevel,
} from '../../helpers/sdk-mocks';

// جلسة اختبارية مطابقة لشكل جلسة التطبيق.
const makeSession = (over: Partial<Session['user']> = {}): Session => ({
  token: 'test-token',
  user: {
    id: 'u-1' as Session['user']['id'],
    // نطابق مستأجر الكتالوج التجريبي: أي معرّف آخر يُخفي المنتجات بحق العزل.
    tenantId: 'tenant-local' as Session['user']['tenantId'],
    storeId: 's-1' as Session['user']['storeId'],
    fullName: 'مستخدم الاختبار',
    roleId: 'role-cashier' as Session['user']['roleId'],
    roleCode: 'cashier',
    roleName: 'كاشير',
    ...over,
  },
  permissions: ['pos.sale.create', 'products.read'],
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-31T00:00:00.000Z',
});

// المستودعات التي لم تُغلَّف بعد (تُمرَّر كما هي).
const pendingRepositories = () => ({
  sales: createInMemorySaleRepository(),
  payments: createInMemoryPaymentRepository(),
  inventory: createInMemoryInventoryRepository([makeStockLevel({ productId: asProductId('p-1') })]),
  customers: createInMemoryCustomerRepository(),
  tenancy: createInMemoryTenancyRepository(),
});

describe('تكامل التطبيق — اشتقاق السياق من الجلسة', () => {
  // الجلسة تملأ كل حقول الهوية والنطاق.
  it('يشتق الهوية والنطاق من الجلسة', () => {
    const context = contextFromSession(makeSession());
    expect(String(context.userId)).toBe('u-1');
    expect(String(context.tenantId)).toBe('tenant-local');
    expect(String(context.storeId)).toBe('s-1');
    // الأدوار والصلاحيات تُنقل كما هي.
    expect(context.roleIds).toHaveLength(1);
    expect(context.permissions).toContain('pos.sale.create');
  });

  // غياب الجلسة يعني سياقًا بلا مستأجر (يمنع كل عملية نطاقية).
  it('يُنتج سياقًا بلا مستأجر عند غياب الجلسة', () => {
    const context = contextFromSession(null);
    expect(context.tenantId).toBeUndefined();
    expect(context.userId).toBeUndefined();
    // ولا صلاحيات (Fail-Closed).
    expect(context.permissions).toHaveLength(0);
  });

  // الحقول الاختيارية الغائبة لا تُختلق.
  it('لا يختلق حقول نطاق غير موجودة في الجلسة', () => {
    const context = contextFromSession(makeSession({ organizationId: undefined, branchId: undefined }));
    expect(context.organizationId).toBeUndefined();
    expect(context.branchId).toBeUndefined();
  });
});

describe('تكامل التطبيق — تركيب الـSDK', () => {
  // التركيب ينجح ويُنتج كل الخدمات فوق المستودعات الحقيقية.
  it('يركّب الـSDK فوق مستودعات التطبيق', () => {
    const sdk = createAppSDK({ session: makeSession(), repositories: pendingRepositories() });
    // الخدمات جاهزة.
    expect(sdk.products).toBeDefined();
    expect(sdk.pos).toBeDefined();
    expect(sdk.rbac).toBeDefined();
  });

  // المنتجات تُقرأ فعلًا من كتالوج التطبيق الحقيقي عبر المحوّل.
  it('يقرأ منتجات التطبيق الحقيقية عبر المحوّل', async () => {
    const sdk = createAppSDK({ session: makeSession(), repositories: pendingRepositories() });
    const result = await sdk.products.list();
    expect(result.success).toBe(true);
    // الكتالوج التجريبي للتطبيق غير فارغ.
    if (result.success) expect(result.data.items.length).toBeGreaterThan(0);
  });

  /**
   * يحسم دور المستخدم من فهرس المنصّة الحقيقي بكوده.
   *
   * هذا الاختبار يحرس عطبًا حقيقيًا: الجلسة تحمل معرّفًا مبسّطًا
   * ('role-cashier') بينما الفهرس يولّد معرّفات مرقّمة ('role-cashier-23').
   * المطابقة بالمعرّف كانت تفشل صامتة فيهبط النطاق إلى 'own' وتُمنع كل
   * عملية — عطل تفويض لا يظهر كخطأ بل كصلاحيات مفقودة.
   */
  it('يحسم دور المستخدم من فهرس المنصّة بكوده', async () => {
    const sdk = createAppSDK({ session: makeSession(), repositories: pendingRepositories() });
    const roles = await sdk.rbac.getRoles();
    expect(roles.success).toBe(true);
    if (!roles.success) return;
    // دور واحد هو دور المستخدم (لا فهرس المنصّة كاملًا).
    expect(roles.data).toHaveLength(1);
    expect(roles.data[0]?.code).toBe('cashier');
    // ونطاقه الفعّال 'store' لا 'own'.
    expect(await sdk.rbac.getScope()).toBe('store');
  });

  // بلا جلسة: العمليات النطاقية مرفوضة.
  it('يمنع العمليات النطاقية بلا جلسة', async () => {
    const sdk = createAppSDK({ session: null, repositories: pendingRepositories() });
    // إنشاء منتج يحتاج مستأجرًا وصلاحية.
    const result = await sdk.products.create({
      sku: 'X',
      barcode: '6291000000123',
      nameAr: 'منتج',
      nameEn: 'Product',
      categoryId: 'cat-1' as never,
      priceAmount: 100,
      currency: 'YER' as never,
      taxIncluded: true,
      initialQuantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('تكامل التطبيق — جسر الأحداث', () => {
  // حدث الـSDK يصل لمشتركي ناقل التطبيق بالاسم المسطّح.
  it('يوصل أحداث الـSDK لناقل التطبيق', async () => {
    // مشترك على اسم الحدث القديم.
    const received: unknown[] = [];
    const unsubscribe = appEventBus.on('product.created', (event) => {
      received.push(event.payload);
    });

    // نُنشئ منتجًا عبر الـSDK بصلاحيات كافية.
    const session = makeSession();
    const sdk = createAppSDK({
      session: { ...session, permissions: ['*'] },
      repositories: pendingRepositories(),
    });
    await sdk.products.create({
      sku: 'SKU-BRIDGE',
      barcode: '6291000000456',
      nameAr: 'منتج الجسر',
      nameEn: 'Bridge Product',
      categoryId: 'cat-beverages' as never,
      priceAmount: 500,
      currency: 'YER' as never,
      taxIncluded: true,
      initialQuantity: 3,
    });

    // المشترك القديم استلم الحدث دون أي تعديل عليه.
    expect(received.length).toBeGreaterThan(0);
    unsubscribe();
  });

  // فشل النشر لا يُسقط العملية (الحدث أثر جانبي لا شرط نجاح).
  it('لا يُسقط العملية عند تعذّر نشر الحدث', async () => {
    // مشترك يرمي استثناء عمدًا.
    const unsubscribe = appEventBus.on('product.created', () => {
      throw new Error('مشترك معطوب');
    });

    const sdk = createAppSDK({
      session: { ...makeSession(), permissions: ['*'] },
      repositories: pendingRepositories(),
    });
    // العملية تنجح رغم عطب المشترك.
    const result = await sdk.products.create({
      sku: 'SKU-RESILIENT',
      barcode: '6291000000789',
      nameAr: 'منتج صامد',
      nameEn: 'Resilient Product',
      categoryId: 'cat-beverages' as never,
      priceAmount: 500,
      currency: 'YER' as never,
      taxIncluded: true,
      initialQuantity: 3,
    });
    expect(result.success).toBe(true);
    unsubscribe();
  });
});
