/**
 * تنفيذات وهمية (Mocks) لعقود الـSDK — PHASE 31 · قسم 62.
 * تُستخدم في الاختبارات وحدها ولا تُشحن في التطبيق. كل تنفيذ هنا يحقق
 * العقد كاملًا بسلوك حقيقي في الذاكرة (لا دوال فارغة ولا قيم ثابتة كاذبة)،
 * حتى تكون اختبارات العقد ذات معنى.
 */
import {
  BusinessRuleError,
  NotFoundError,
  PaymentError,
  asBranchId,
  asCategoryId,
  asOrganizationId,
  asProductId,
  asRoleId,
  asStoreId,
  asTenantId,
  asUserId,
  createContextStore,
  failure,
  money,
  paginate,
  success,
  type AsyncResult,
  type AuditEvent,
  type AuditLogger,
  type CategoryId,
  type Clock,
  type CurrencyCode,
  type EventPublisher,
  type PaginatedResult,
  type PaymentAuthorizationRequest,
  type PaymentMethodKind,
  type PaymentProvider,
  type PaymentProviderResult,
  type ProductId,
  type SDKContext,
  type SDKContextStore,
  type SDKDomainEvent,
  type ScopeFilter,
  type StoreId,
} from '@/sdk/core';
import type {
  Barcode,
  CreateProductCommand,
  Product,
  ProductCategory,
  ProductListQuery,
  ProductRepository,
  ProductSearchQuery,
  ProductBarcodeQuery,
  UpdateProductCommand,
} from '@/sdk/products';
import { applyProductQuery, applyProductSearch, deriveStockStatus } from '@/sdk/products';
import type { Customer, CustomerRepository } from '@/sdk/customers';
import { calculatePoints, deriveTier } from '@/sdk/customers';
import type {
  InventoryRepository,
  StockLevel,
  StockMovement,
} from '@/sdk/inventory';
import { alertSeverity, deriveStockLevelStatus } from '@/sdk/inventory';
import type { Payment, PaymentRepository } from '@/sdk/payments';
import type { Permission, Policy, RbacRepository, Role } from '@/sdk/rbac';
import type { Sale, SalePaymentStatus, SaleRepository } from '@/sdk/sales';
import type { TenancyRepository } from '@/sdk/tenancy';

// اختصار اشتقاق حالة المخزون (نفس منطق الـSDK — لا تكرار قاعدة).
const deriveStatus = (quantity: number, threshold: number) => deriveStockStatus(quantity, threshold);

// ساعة ثابتة: تجعل كل الاختبارات حتمية بلا اعتماد على الوقت الحقيقي.
export const fixedClock = (iso = '2026-01-01T00:00:00.000Z'): Clock => ({
  // اللحظة الثابتة كنص ISO.
  now: () => iso,
  // نفس اللحظة كطابع رقمي.
  timestamp: () => new Date(iso).getTime(),
});

// ناشر أحداث يجمع ما نُشر (للتحقق من أن الطفرات تُصدر أحداثها).
export interface RecordingEventPublisher extends EventPublisher {
  readonly events: SDKDomainEvent<string, unknown>[]; // الأحداث المنشورة.
  // يمسح المجموعة بين الاختبارات.
  reset(): void;
}

// ينشئ ناشرًا مسجّلًا.
export const recordingEvents = (): RecordingEventPublisher => {
  // مخزن الأحداث.
  const events: SDKDomainEvent<string, unknown>[] = [];
  // الناشر.
  return {
    events,
    publish: (event) => {
      events.push(event);
    },
    reset: () => {
      events.length = 0;
    },
  };
};

// مُسجّل تدقيق يجمع الأحداث (للتحقق من أثر التدقيق).
export interface RecordingAuditLogger extends AuditLogger {
  readonly entries: AuditEvent[]; // أحداث التدقيق.
  // يمسح المجموعة.
  reset(): void;
}

// ينشئ مُسجّل تدقيق مسجّلًا.
export const recordingAudit = (): RecordingAuditLogger => {
  // مخزن الأحداث.
  const entries: AuditEvent[] = [];
  // المُسجّل.
  return {
    entries,
    record: (event) => {
      entries.push(event);
    },
    reset: () => {
      entries.length = 0;
    },
  };
};

// سياق اختبار كامل الصلاحيات (مستأجر ومتجر نشطان).
export const testContext = (overrides: Partial<SDKContext> = {}): SDKContextStore =>
  createContextStore({
    userId: asUserId('u-test'),
    tenantId: asTenantId('t-test'),
    organizationId: asOrganizationId('o-test'),
    branchId: asBranchId('b-test'),
    storeId: asStoreId('s-test'),
    roleIds: [asRoleId('owner')],
    permissions: ['*'],
    locale: 'ar',
    currency: 'YER',
    ...overrides,
  });

// يبني باركودًا كامل الحقول (الصيغة الافتراضية EAN13 أساسي).
export const makeBarcode = (value: string, isPrimary = true): Barcode => ({
  value,
  format: 'EAN13',
  isPrimary,
});

// يبني منتج اختبار بقيم معقولة قابلة للتخصيص.
export const makeSDKProduct = (over: Partial<Product> = {}): Product => ({
  id: asProductId('p-1'),
  tenantId: asTenantId('t-test'),
  sku: 'SKU-1',
  barcodes: [makeBarcode('6291000000011')],
  nameAr: 'منتج تجريبي',
  nameEn: 'Test Product',
  categoryId: asCategoryId('cat-1'),
  price: {
    amount: money(1000, 'YER' as CurrencyCode),
    taxIncluded: true,
  },
  stock: {
    quantity: 100,
    status: 'in_stock',
    lowStockThreshold: 10,
  },
  variants: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

// مستودع منتجات في الذاكرة يحقق العقد كاملًا بسلوك حقيقي.
export const createInMemoryProductRepository = (
  seed: readonly Product[] = [],
  categories: readonly ProductCategory[] = [],
): ProductRepository & { readonly items: Product[] } => {
  // النسخة القابلة للتعديل من البيانات.
  const items: Product[] = [...seed];
  // عدّاد المعرّفات الجديدة.
  let sequence = seed.length;

  return {
    items,

    // السرد يستخدم نفس منطق الاستعلام النقي المستخدم في التنفيذ الحقيقي.
    list: async (query?: ProductListQuery): AsyncResult<PaginatedResult<Product>> =>
      success(applyProductQuery(items, query ?? {})),

    // الجلب بالمعرّف.
    get: async (id: ProductId) => {
      // نبحث عن المنتج.
      const found = items.find((item) => String(item.id) === String(id));
      // غيابه خطأ صريح.
      return found ? success(found) : failure(new NotFoundError('product', String(id)));
    },

    // البحث النصي.
    search: async (query: ProductSearchQuery) => success(applyProductSearch(items, query)),

    // الجلب بالباركود (null عند عدم التطابق — ليس خطأً).
    getByBarcode: async (query: ProductBarcodeQuery) => {
      // مطابقة تامة على أي من باركودات المنتج.
      const found = items.find((item) => item.barcodes.some((code) => code.value === query.barcode));
      return success(found ?? null);
    },

    // الإنشاء.
    create: async (command: CreateProductCommand, scope: ScopeFilter) => {
      // منتج جديد بمعرّف متسلسل.
      const created: Product = {
        id: asProductId(`p-${(sequence += 1)}`),
        tenantId: scope.tenantId ?? asTenantId('t-test'),
        storeId: scope.storeId,
        branchId: scope.branchId,
        organizationId: scope.organizationId,
        sku: command.sku,
        barcodes: [makeBarcode(command.barcode)],
        nameAr: command.nameAr,
        nameEn: command.nameEn,
        categoryId: command.categoryId,
        price: {
          amount: money(command.priceAmount, command.currency),
          taxIncluded: command.taxIncluded,
        },
        stock: {
          // الرصيد الافتتاحي وحالته المشتقة من حدّ التنبيه.
          quantity: command.initialQuantity,
          status: deriveStatus(command.initialQuantity, command.lowStockThreshold ?? 10),
          lowStockThreshold: command.lowStockThreshold ?? 10,
        },
        icon: command.icon,
        variants: [],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      // نخزّنه.
      items.push(created);
      return success(created);
    },

    // التعديل.
    update: async (command: UpdateProductCommand) => {
      // موضع المنتج.
      const index = items.findIndex((item) => String(item.id) === String(command.productId));
      // غيابه خطأ.
      if (index === -1) return failure(new NotFoundError('product', String(command.productId)));
      // النسخة الحالية (موجودة قطعًا بعد الفحص أعلاه).
      const current = items[index] as Product;
      // النسخة المعدَّلة (الحقول المُمرَّرة فقط).
      const updated: Product = {
        ...current,
        nameAr: command.nameAr ?? current.nameAr,
        nameEn: command.nameEn ?? current.nameEn,
        sku: command.sku ?? current.sku,
        barcodes: command.barcode === undefined ? current.barcodes : [makeBarcode(command.barcode)],
        categoryId: command.categoryId ?? current.categoryId,
        price:
          command.priceAmount === undefined
            ? current.price
            : {
                // العملة تبقى عملة المنتج (التعديل لا يغيّر العملة).
                amount: money(command.priceAmount, current.price.amount.currency),
                taxIncluded: command.taxIncluded ?? current.price.taxIncluded,
              },
        stock:
          command.lowStockThreshold === undefined
            ? current.stock
            : {
                ...current.stock,
                lowStockThreshold: command.lowStockThreshold,
                status: deriveStatus(current.stock.quantity, command.lowStockThreshold),
              },
        active: command.active ?? current.active,
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      // نستبدلها.
      items[index] = updated;
      return success(updated);
    },

    // الحذف.
    delete: async (id: ProductId) => {
      // موضع المنتج.
      const index = items.findIndex((item) => String(item.id) === String(id));
      // غيابه خطأ.
      if (index === -1) return failure(new NotFoundError('product', String(id)));
      // نحذفه فعليًا.
      items.splice(index, 1);
      return success(undefined);
    },

    // التصنيفات.
    getCategories: async () => success(categories),

    // فحص تكرار الباركود.
    isBarcodeTaken: async (barcode: string, exceptProductId?: ProductId) =>
      success(
        items.some(
          (item) =>
            item.barcodes.some((code) => code.value === barcode)
            && (exceptProductId === undefined || String(item.id) !== String(exceptProductId)),
        ),
      ),

    // ضبط الرصيد.
    setStockQuantity: async (id: ProductId, quantity: number) => {
      // موضع المنتج.
      const index = items.findIndex((item) => String(item.id) === String(id));
      // غيابه خطأ.
      if (index === -1) return failure(new NotFoundError('product', String(id)));
      // النسخة الحالية.
      const current = items[index] as Product;
      // النسخة بالرصيد الجديد وحالته المشتقة.
      const updated: Product = {
        ...current,
        stock: {
          ...current.stock,
          quantity,
          status: deriveStatus(quantity, current.stock.lowStockThreshold),
        },
      };
      // نستبدلها.
      items[index] = updated;
      return success(updated);
    },

    // الجلب الجماعي.
    getMany: async (ids: readonly ProductId[]) =>
      success(items.filter((item) => ids.some((id) => String(id) === String(item.id)))),

    // السرد بالتصنيف.
    listByCategory: async (categoryId: CategoryId, query?: ProductListQuery) =>
      success(applyProductQuery(items, { ...query, categoryId })),
  };
};

// مستودع صلاحيات في الذاكرة (دور واحد بكل الصلاحيات افتراضيًا).
export const createInMemoryRbacRepository = (
  roles: readonly Role[] = [],
  policies: readonly Policy[] = [],
  permissions: readonly Permission[] = [],
): RbacRepository => ({
  // كل الأدوار.
  getRoles: async () => success(roles),
  // الأدوار المطلوبة بمعرّفاتها (المفقود يُتجاهل).
  getRolesByIds: async (ids) =>
    success(roles.filter((role) => ids.some((id) => String(id) === String(role.id)))),
  // دور بكوده (null عند الغياب).
  getRoleByCode: async (code) => success(roles.find((role) => role.code === code) ?? null),
  // فهرس الأذونات.
  getPermissions: async () => success(permissions),
  // السياسات المطبَّقة.
  getPolicies: async () => success(policies),
});

// دور مالك بكل الصلاحيات (يستخدمه معظم الاختبارات).
export const ownerRole = (): Role => ({
  id: asRoleId('owner'),
  code: 'owner',
  nameAr: 'المالك',
  nameEn: 'Owner',
  scope: 'tenant',
  permissions: ['*'],
  isSystem: true,
});

// دور كاشير بصلاحيات محدودة (لاختبار الرفض).
export const cashierRole = (): Role => ({
  id: asRoleId('cashier'),
  code: 'cashier',
  nameAr: 'كاشير',
  nameEn: 'Cashier',
  scope: 'store',
  permissions: ['pos.sale.create', 'products.read', 'payment.process', 'orders.read', 'receipt.read'],
  isSystem: true,
});

// مستودع هرمية في الذاكرة (مستأجر واحد بمتجر واحد) — كامل الحقول.
export const createInMemoryTenancyRepository = (): TenancyRepository => {
  // المتجر النشط المحفوظ بين الاستدعاءات (سلوك تخزين حقيقي).
  let activeStore: StoreId | null = asStoreId('s-test');
  // المستودع.
  return {
  // الهرمية الكاملة للمستأجر المطلوب.
  getHierarchy: async (tenantId) =>
    success({
      // المستأجر بكل حقوله الإلزامية.
      tenant: {
        id: tenantId,
        name: 'مستأجر الاختبار',
        slug: 'test-tenant',
        plan: 'standard',
        status: 'active',
        defaultCurrency: 'YER',
        defaultLocale: 'ar',
        timezone: 'Asia/Aden',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      // مؤسسة واحدة.
      organizations: [
        {
          id: asOrganizationId('o-test'),
          tenantId,
          name: 'مؤسسة الاختبار',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      // فرع واحد.
      branches: [
        {
          id: asBranchId('b-test'),
          tenantId,
          organizationId: asOrganizationId('o-test'),
          name: 'فرع الاختبار',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      // متجر واحد بعملة ونسبة ضريبة.
      stores: [
        {
          id: asStoreId('s-test'),
          tenantId,
          organizationId: asOrganizationId('o-test'),
          branchId: asBranchId('b-test'),
          name: 'متجر الاختبار',
          code: 'ST-1',
          currency: 'YER',
          taxRatePercent: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),

  // السياق النشط للمتجر المطلوب داخل المستأجر.
  getActiveTenancy: async (tenantId, storeId) =>
    success({
      tenantId,
      tenantName: 'مستأجر الاختبار',
      organizationId: asOrganizationId('o-test'),
      organizationName: 'مؤسسة الاختبار',
      branchId: asBranchId('b-test'),
      branchName: 'فرع الاختبار',
      storeId,
      storeName: 'متجر الاختبار',
      storeCode: 'ST-1',
      currency: 'YER',
      taxRatePercent: 5,
    }),

  // المتاجر المتاحة (متجر واحد في بيئة الاختبار).
  getAccessibleStores: async (_tenantId, _userScope, activeStoreId) =>
    success([
      {
        storeId: asStoreId('s-test'),
        name: 'متجر الاختبار',
        code: 'ST-1',
        branchName: 'فرع الاختبار',
        isActive: String(activeStoreId ?? '') === 's-test',
      },
    ]),

  // المتجر النشط المحفوظ.
  getActiveStore: async () => success(activeStore),

    // حفظ المتجر النشط (تخزين حقيقي في الذاكرة).
    setActiveStore: async (storeId) => {
      activeStore = storeId;
      return success(undefined);
    },
  };
};

// ── مستودع الفواتير في الذاكرة ──────────────────────────────────────────
/**
 * تنفيذ كامل لعقد `SaleRepository` في الذاكرة.
 * يحفظ الفواتير فعليًا ويولّد أرقامًا تسلسلية حقيقية، حتى تختبر خدمات
 * المبيعات والدفع والـPOS سلوكًا واقعيًا لا قيمًا ثابتة.
 */
export const createInMemorySaleRepository = (seed: readonly Sale[] = []): SaleRepository => {
  // مخزن الفواتير مفهرسًا بالمعرّف.
  const store = new Map<string, Sale>(seed.map((sale) => [String(sale.id), sale]));
  // عدّاد الترقيم التسلسلي للفواتير.
  let sequence = seed.length;

  return {
    // يخزّن فاتورة جديدة كما بُنيت في طبقة المجال.
    create: async (sale) => {
      store.set(String(sale.id), sale);
      return success(sale);
    },

    // يجلب فاتورة أو يفشل بـNotFound.
    get: async (id) => {
      // الفاتورة المطلوبة.
      const found = store.get(String(id));
      // الغياب خطأ صريح.
      if (!found) return failure(new NotFoundError('sale', String(id)));
      return success(found);
    },

    // يسرد الفواتير مع ترشيح أساسي مطابق للعقد.
    list: async (query) => {
      // كل الفواتير.
      let items = [...store.values()];
      // ترشيح بالحالة.
      if (query?.status) items = items.filter((sale) => sale.status === query.status);
      // ترشيح بحالة الدفع.
      if (query?.paymentStatus) items = items.filter((sale) => sale.paymentStatus === query.paymentStatus);
      // ترشيح بالعميل.
      if (query?.customerId) {
        items = items.filter((sale) => String(sale.customer.customerId ?? '') === String(query.customerId));
      }
      return success(paginate(items, query?.pagination));
    },

    // يحدّث فاتورة قائمة.
    update: async (sale) => {
      // التعديل يشترط وجودها مسبقًا.
      if (!store.has(String(sale.id))) return failure(new NotFoundError('sale', String(sale.id)));
      store.set(String(sale.id), sale);
      return success(sale);
    },

    // الرقم التسلسلي التالي (يتقدّم فعليًا).
    nextSequence: async () => {
      sequence += 1;
      return success(sequence);
    },

    // يبني إيصالًا من الفاتورة المحفوظة.
    getReceipt: async (id) => {
      // الفاتورة المصدر.
      const sale = store.get(String(id));
      // بلا فاتورة لا إيصال.
      if (!sale) return failure(new NotFoundError('sale', String(id)));
      // الباقي للعميل = المدفوع ناقص الإجمالي (صفر إن لم يزد).
      const change = Math.max(0, sale.paidAmount.amount - sale.total.amount);
      return success({
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        storeName: 'متجر الاختبار',
        storeCode: 'ST-1',
        cashierName: sale.cashierName,
        customerName: sale.customer.name,
        lines: sale.lines.map((line) => ({
          labelAr: line.nameAr,
          labelEn: line.nameEn,
          quantity: line.quantity,
          amount: line.lineTotal,
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.taxAmount,
        total: sale.total,
        paidAmount: sale.paidAmount,
        changeDue: money(change, sale.currency),
        issuedAt: sale.soldAt,
      });
    },

    // يربط دفعة بفاتورة ويحدّث المُحصَّل وحالة الدفع.
    attachPayment: async (id, paymentId, amount) => {
      // الفاتورة المستهدفة.
      const sale = store.get(String(id));
      // لا ربط بلا فاتورة.
      if (!sale) return failure(new NotFoundError('sale', String(id)));
      // المُحصَّل الجديد.
      const paid = sale.paidAmount.amount + amount.amount;
      // حالة الدفع تُشتق من المُحصَّل مقابل الإجمالي.
      const paymentStatus: SalePaymentStatus =
        paid >= sale.total.amount - 0.005 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      // الفاتورة المحدَّثة (كائن جديد — لا طفرة).
      const updated: Sale = {
        ...sale,
        paidAmount: money(paid, sale.currency),
        paymentIds: [...sale.paymentIds, paymentId],
        paymentStatus,
      };
      store.set(String(id), updated);
      return success(updated);
    },

    // سجل المبيعات ضمن نطاق زمني.
    getHistory: async (range) => {
      // كل الفواتير.
      const items = [...store.values()];
      // بلا نطاق: الكل.
      if (!range) return success(items);
      // ضمن النطاق فقط.
      return success(
        items.filter((sale) => String(sale.soldAt) >= String(range.from) && String(sale.soldAt) <= String(range.to)),
      );
    },
  };
};

// ── مستودع الدفعات في الذاكرة ───────────────────────────────────────────
/**
 * تنفيذ كامل لعقد `PaymentRepository` في الذاكرة.
 * يحفظ الدفعات الناجحة والفاشلة معًا — لأن العقد يوجب تخزين المحاولة
 * المرفوضة كدفعة فاشلة لا إسقاطها.
 */
export const createInMemoryPaymentRepository = (seed: readonly Payment[] = []): PaymentRepository => {
  // مخزن الدفعات.
  const store = new Map<string, Payment>(seed.map((payment) => [String(payment.id), payment]));

  return {
    // يخزّن دفعة جديدة.
    create: async (payment) => {
      store.set(String(payment.id), payment);
      return success(payment);
    },

    // يجلب دفعة أو يفشل بـNotFound.
    get: async (id) => {
      // الدفعة المطلوبة.
      const found = store.get(String(id));
      // الغياب خطأ صريح.
      if (!found) return failure(new NotFoundError('payment', String(id)));
      return success(found);
    },

    // يحدّث دفعة قائمة (تغيّر حالة أو استرجاع).
    update: async (payment) => {
      // التعديل يشترط وجودها.
      if (!store.has(String(payment.id))) return failure(new NotFoundError('payment', String(payment.id)));
      store.set(String(payment.id), payment);
      return success(payment);
    },

    // يسرد الدفعات مع الترشيح المتاح في العقد.
    list: async (query) => {
      // كل الدفعات.
      let items = [...store.values()];
      // ترشيح بالفاتورة.
      if (query?.saleId) items = items.filter((payment) => String(payment.saleId) === String(query.saleId));
      // ترشيح بالطريقة.
      if (query?.method) items = items.filter((payment) => payment.method === query.method);
      // ترشيح بالحالة.
      if (query?.status) items = items.filter((payment) => payment.status === query.status);
      return success(paginate(items, query?.pagination));
    },

    // كل دفعات فاتورة محددة.
    listBySale: async (saleId) =>
      success([...store.values()].filter((payment) => String(payment.saleId) === String(saleId))),
  };
};

// ── مزوّد دفع اختباري ───────────────────────────────────────────────────
/**
 * مزوّد دفع في الذاكرة يحقق عقد `PaymentProvider` كاملًا.
 * سلوكه قابل للتوجيه (`approve`) لاختبار مسارَي القبول والرفض،
 * ويسجّل كل نداء لإثبات ترتيب `authorize` ثم `capture`.
 */
export const createTestPaymentProvider = (
  options: {
    readonly id?: string;
    readonly approve?: boolean;
    readonly failCapture?: boolean;
    readonly unreachable?: boolean;
  } = {},
): PaymentProvider & { readonly calls: readonly string[] } => {
  // سجل النداءات بالترتيب (يثبت أن التفويض يسبق التحصيل).
  const calls: string[] = [];
  // هل توافق البوابة على التفويض؟ (الافتراض: نعم).
  const approve = options.approve ?? true;
  // هل يفشل التحصيل بعد تفويض ناجح؟
  const failCapture = options.failCapture ?? false;
  // هل البوابة نفسها غير قابلة للوصول؟ (خطأ اتصال لا رفض).
  const unreachable = options.unreachable ?? false;
  // معرّف المزوّد.
  const id = options.id ?? 'test-provider';
  // لحظة ثابتة لكل العمليات (حتمية الاختبار).
  const at = '2026-01-01T00:00:00.000Z' as PaymentProviderResult['at'];

  return {
    id,
    // يدعم البطاقة والمحفظة ورمز الاستجابة السريعة.
    supports: (method: PaymentMethodKind) => method === 'card' || method === 'wallet' || method === 'qr',

    /**
     * التفويض: يحجز المبلغ دون تحصيله.
     * تمييز جوهري في العقد: تعذّر الوصول للبوابة خطأ (`failure`)، أما
     * رفضها للعملية فنتيجة ناجحة الاتصال بحقل `authorized: false` —
     * لأن الرفض واقعة تجارية تُخزَّن وتُدقَّق لا عطل تقني.
     */
    authorize: async (request: PaymentAuthorizationRequest) => {
      calls.push('authorize');
      // تعذّر الوصول = خطأ تقني.
      if (unreachable) return failure(new PaymentError('sdk.payments.error.unreachable'));
      // الرفض = نتيجة تجارية غير مفوَّضة.
      if (!approve) {
        return success({
          providerReference: `declined-${String(request.paymentId)}`,
          authorized: false,
          captured: false,
          at,
        });
      }
      // القبول: تفويض بلا تحصيل.
      return success({
        providerReference: `auth-${String(request.paymentId)}`,
        authorized: true,
        captured: false,
        at,
      });
    },

    // التحصيل: يقبض مبلغًا مُفوَّضًا سابقًا.
    capture: async (providerReference: string) => {
      calls.push('capture');
      // فشل التحصيل بعد تفويض ناجح: مُفوَّض لكن غير مُحصَّل (حالة تتطلب تدخّلًا).
      if (failCapture) return success({ providerReference, authorized: true, captured: false, at });
      // النجاح: مُفوَّض ومُحصَّل.
      return success({ providerReference, authorized: true, captured: true, at });
    },

    // الإلغاء قبل التحصيل.
    cancel: async (providerReference: string) => {
      calls.push('cancel');
      return success({ providerReference, authorized: false, captured: false, at });
    },

    // الاسترجاع بعد التحصيل.
    refund: async (providerReference: string) => {
      calls.push('refund');
      return success({ providerReference, authorized: true, captured: true, at });
    },

    calls,
  };
};

// ── فاتورة اختبارية ─────────────────────────────────────────────────────
/**
 * يبني فاتورة كاملة الحقول بمبالغ متسقة داخليًا.
 * الاتساق مقصود: الإجمالي = المجموع − الخصم + الضريبة، حتى لا تُختبر
 * الخدمات ببيانات مستحيلة لا تنتجها طبقة المجال أصلًا.
 */
export const makeSale = (over: Partial<Sale> = {}): Sale => {
  // العملة الافتراضية.
  const currency = 'YER' as CurrencyCode;
  // فاتورة أساسية ببند واحد بقيمة 1000.
  const base: Sale = {
    id: 'sale-1' as Sale['id'],
    tenantId: asTenantId('t-test'),
    storeId: asStoreId('s-test'),
    saleNumber: 'ORD-0001',
    transactionId: 'txn-1',
    cashierId: asUserId('u-test'),
    cashierName: 'كاشير الاختبار',
    customer: { kind: 'walk_in', name: 'زائر' },
    lines: [
      {
        id: 'line-1' as Sale['lines'][number]['id'],
        productId: asProductId('p-1'),
        sku: 'SKU-1',
        nameAr: 'منتج تجريبي',
        nameEn: 'Test Product',
        quantity: 1,
        unitPrice: money(1000, currency),
        lineTotal: money(1000, currency),
        taxIncluded: true,
      },
    ],
    currency,
    subtotal: money(1000, currency),
    discount: money(0, currency),
    taxAmount: money(0, currency),
    total: money(1000, currency),
    paidAmount: money(0, currency),
    refundedAmount: money(0, currency),
    taxRatePercent: 0,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentIds: [],
    soldAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  // التخصيصات تُطبَّق فوق الأساس.
  return { ...base, ...over };
};

// ── مستودع المخزون في الذاكرة ───────────────────────────────────────────
/**
 * تنفيذ كامل لعقد `InventoryRepository` في الذاكرة.
 * السجل هنا **append-only** فعلًا: `recordMovement` يضيف ولا يعدّل أبدًا،
 * والمستويات تُحدَّث عبر `setQuantity` وحده — تمامًا كما يوجب العقد،
 * حتى تكون اختبارات الجرد وإعادة البناء ذات معنى.
 */
export const createInMemoryInventoryRepository = (
  seed: readonly StockLevel[] = [],
): InventoryRepository => {
  // مستويات المخزون مفهرسة بالمنتج.
  const levels = new Map<string, StockLevel>(seed.map((level) => [String(level.productId), level]));
  // سجل الحركات (لا يُحذف منه شيء).
  const movements: StockMovement[] = [];

  // يعيد بناء مستوى بعد تغيّر رصيده (الحالة والقيمة مشتقتان لا مُدخلتان).
  const withQuantity = (level: StockLevel, quantity: number): StockLevel => ({
    ...level,
    quantity,
    // المتاح = الرصيد ناقص المحجوز.
    available: Math.max(0, quantity - level.reserved),
    // الحالة تُشتق بمنطق الـSDK نفسه (لا تكرار للقاعدة).
    status: deriveStockLevelStatus(quantity, level.lowStockThreshold),
    // قيمة الرصيد تتبع الكمية.
    stockValue: money(quantity * level.unitValue.amount, level.currency),
  });

  return {
    // يسرد المستويات مع ترشيح المنتج إن طُلب.
    listLevels: async (query) => {
      // كل المستويات.
      let items = [...levels.values()];
      // ترشيح بمنتج محدد.
      if (query?.productId) items = items.filter((level) => String(level.productId) === String(query.productId));
      return success(paginate(items, query?.pagination));
    },

    // يقرأ مستوى منتج أو يفشل بـNotFound.
    getLevel: async (productId) => {
      // المستوى المطلوب.
      const level = levels.get(String(productId));
      // الغياب خطأ صريح.
      if (!level) return failure(new NotFoundError('stockLevel', String(productId)));
      return success(level);
    },

    // يضيف حركة للسجل (إضافة فقط — لا تعديل ولا حذف).
    recordMovement: async (movement) => {
      movements.push(movement);
      return success(movement);
    },

    // يقرأ حركة واحدة بالمعرّف.
    getMovement: async (id) => {
      // الحركة المطلوبة.
      const found = movements.find((movement) => String(movement.id) === String(id));
      // الغياب خطأ صريح.
      if (!found) return failure(new NotFoundError('stockMovement', String(id)));
      return success(found);
    },

    // يسرد الحركات مع الترشيح المتاح في العقد.
    listMovements: async (query) => {
      // كل الحركات.
      let items = [...movements];
      // ترشيح بالمنتج.
      if (query?.productId) items = items.filter((movement) => String(movement.productId) === String(query.productId));
      // ترشيح بالنوع.
      if (query?.type) items = items.filter((movement) => movement.type === query.type);
      return success(paginate(items, query?.pagination));
    },

    // يضبط رصيد منتج (الطريق الوحيد لتغيير الرصيد).
    setQuantity: async (productId, quantity) => {
      // المستوى المستهدف.
      const level = levels.get(String(productId));
      // لا ضبط لمنتج غير مُتتبَّع.
      if (!level) return failure(new NotFoundError('stockLevel', String(productId)));
      // المستوى المحدَّث (كائن جديد — لا طفرة).
      const updated = withQuantity(level, quantity);
      levels.set(String(productId), updated);
      return success(updated);
    },

    // ملخص المخزون محسوبًا من المستويات الفعلية.
    getSummary: async () => {
      // كل المستويات.
      const items = [...levels.values()];
      // العملة من أول مستوى (أو الافتراضية).
      const currency = items[0]?.currency ?? ('YER' as CurrencyCode);
      return success({
        totalProducts: items.length,
        totalQuantity: items.reduce((sum, level) => sum + level.quantity, 0),
        totalValue: money(
          items.reduce((sum, level) => sum + level.stockValue.amount, 0),
          currency,
        ),
        lowStockCount: items.filter((level) => level.status === 'low_stock').length,
        outOfStockCount: items.filter((level) => level.status === 'out_of_stock').length,
        currency,
      });
    },

    // تنبيهات النقص مشتقة من الحالة الفعلية.
    getLowStockAlerts: async () =>
      success(
        [...levels.values()]
          .filter((level) => level.status === 'low_stock' || level.status === 'out_of_stock')
          .map((level) => ({
            productId: level.productId,
            nameAr: level.nameAr,
            quantity: level.quantity,
            threshold: level.lowStockThreshold,
            severity: alertSeverity(level.quantity),
          })),
      ),
  };
};

// يبني مستوى مخزون كامل الحقول بقيم متسقة.
export const makeStockLevel = (over: Partial<StockLevel> = {}): StockLevel => {
  // العملة الافتراضية.
  const currency = 'YER' as CurrencyCode;
  // الرصيد المطلوب (أو الافتراضي).
  const quantity = over.quantity ?? 100;
  // حدّ التنبيه المطلوب (أو الافتراضي).
  const lowStockThreshold = over.lowStockThreshold ?? 10;
  // المحجوز.
  const reserved = over.reserved ?? 0;
  // قيمة الوحدة.
  const unitValue = over.unitValue ?? money(1000, currency);
  return {
    productId: asProductId('p-1'),
    nameAr: 'منتج تجريبي',
    nameEn: 'Test Product',
    sku: 'SKU-1',
    quantity,
    reserved,
    // المتاح مشتق لا مُدخل.
    available: Math.max(0, quantity - reserved),
    lowStockThreshold,
    // الحالة مشتقة بمنطق الـSDK.
    status: deriveStockLevelStatus(quantity, lowStockThreshold),
    unitValue,
    stockValue: money(quantity * unitValue.amount, currency),
    currency,
    ...over,
  };
};

// ── مستودع العملاء في الذاكرة ───────────────────────────────────────────
/**
 * تنفيذ كامل لعقد `CustomerRepository` في الذاكرة.
 * الولاء يُحسب هنا بمنطق الـSDK نفسه (`deriveTier` و`calculatePoints`)
 * لا بقواعد مكرَّرة، حتى لا تنحرف نتيجة الاختبار عن نتيجة الإنتاج.
 */
export const createInMemoryCustomerRepository = (seed: readonly Customer[] = []): CustomerRepository => {
  // مخزن العملاء.
  const store = new Map<string, Customer>(seed.map((customer) => [String(customer.id), customer]));
  // عدّاد المعرّفات.
  let sequence = seed.length;

  return {
    // يسرد العملاء مع بحث نصي بسيط.
    list: async (query) => {
      // كل العملاء.
      let items = [...store.values()];
      // بحث نصي في الاسم أو الهاتف.
      if (query?.search) {
        // النص المطلوب بحروف صغيرة.
        const term = query.search.toLowerCase();
        items = items.filter(
          (customer) =>
            customer.fullName.toLowerCase().includes(term) || (customer.phone ?? '').includes(term),
        );
      }
      return success(paginate(items, query?.pagination));
    },

    // يجلب عميلًا أو يفشل بـNotFound.
    get: async (id) => {
      // العميل المطلوب.
      const found = store.get(String(id));
      // الغياب خطأ صريح.
      if (!found) return failure(new NotFoundError('customer', String(id)));
      return success(found);
    },

    // البحث بالهاتف: الغياب ليس خطأ (null نتيجة مشروعة).
    findByPhone: async (phone) =>
      success([...store.values()].find((customer) => customer.phone === phone) ?? null),

    // ينشئ عميلًا جديدًا بقيم ولاء ابتدائية.
    create: async (command) => {
      // معرّف تسلسلي حتمي.
      sequence += 1;
      // العملة الافتراضية للإنفاق.
      const currency = 'YER' as CurrencyCode;
      // العميل الجديد.
      const customer: Customer = {
        id: `cust-${sequence}` as Customer['id'],
        tenantId: asTenantId('t-test'),
        storeId: asStoreId('s-test'),
        kind: command.kind ?? 'individual',
        fullName: command.fullName,
        phone: command.phone,
        email: command.email,
        address: command.address,
        totalSpent: money(0, currency),
        orderCount: 0,
        pointsBalance: 0,
        totalPointsEarned: 0,
        // الشريحة الابتدائية تُشتق من إنفاق صفري.
        tier: deriveTier(0),
        preferredChannel: command.preferredChannel ?? 'sms',
        tags: command.tags ?? [],
        purchases: [],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      store.set(String(customer.id), customer);
      return success(customer);
    },

    // يعدّل الحقول المُمرَّرة وحدها.
    update: async (command) => {
      // العميل المستهدف.
      const existing = store.get(String(command.id));
      // لا تعديل لغير الموجود.
      if (!existing) return failure(new NotFoundError('customer', String(command.id)));
      // النسخة المحدَّثة (الحقول غير المُمرَّرة تبقى).
      const updated: Customer = {
        ...existing,
        fullName: command.fullName ?? existing.fullName,
        phone: command.phone ?? existing.phone,
        email: command.email ?? existing.email,
        address: command.address ?? existing.address,
        kind: command.kind ?? existing.kind,
        preferredChannel: command.preferredChannel ?? existing.preferredChannel,
        tags: command.tags ?? existing.tags,
      };
      store.set(String(command.id), updated);
      return success(updated);
    },

    // يسجّل شراءً ويحدّث الإنفاق والنقاط والشريحة معًا.
    recordPurchase: async (id, purchase) => {
      // العميل المستهدف.
      const existing = store.get(String(id));
      // لا تسجيل لغير الموجود.
      if (!existing) return failure(new NotFoundError('customer', String(id)));
      // الإنفاق التراكمي الجديد.
      const totalSpent = existing.totalSpent.amount + purchase.total.amount;
      // النقاط المكتسبة من هذه العملية (منطق الـSDK).
      const earned = calculatePoints(purchase.total.amount);
      // النسخة المحدَّثة.
      const updated: Customer = {
        ...existing,
        totalSpent: money(totalSpent, existing.totalSpent.currency),
        orderCount: existing.orderCount + 1,
        pointsBalance: existing.pointsBalance + earned,
        totalPointsEarned: existing.totalPointsEarned + earned,
        // الشريحة تُعاد اشتقاقها من الإنفاق الجديد.
        tier: deriveTier(totalSpent),
        purchases: [...existing.purchases, purchase],
        lastVisitAt: purchase.at,
      };
      store.set(String(id), updated);
      return success(updated);
    },

    // يستبدل نقاطًا (يخصمها من الرصيد).
    redeemPoints: async (id, points) => {
      // العميل المستهدف.
      const existing = store.get(String(id));
      // لا استبدال لغير الموجود.
      if (!existing) return failure(new NotFoundError('customer', String(id)));
      // لا استبدال فوق الرصيد.
      if (points > existing.pointsBalance) {
        return failure(new BusinessRuleError('sdk.customers.error.insufficientPoints'));
      }
      // النسخة المحدَّثة (المكتسب التراكمي لا ينقص).
      const updated: Customer = { ...existing, pointsBalance: existing.pointsBalance - points };
      store.set(String(id), updated);
      return success(updated);
    },
  };
};

// يبني حركة مخزون كاملة الحقول (بديل التحويلات الجزئية في الاختبارات).
export const makeMovement = (over: Partial<StockMovement> = {}): StockMovement => ({
  id: 'mov-1' as StockMovement['id'],
  tenantId: asTenantId('t-test'),
  storeId: asStoreId('s-test'),
  productId: asProductId('p-1'),
  type: 'receive',
  quantity: 10,
  previousQuantity: 0,
  resultingQuantity: 10,
  reasonKey: 'sdk.inventory.reason.purchase',
  status: 'completed',
  performedBy: asUserId('u-test'),
  occurredAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
