/**
 * عميل ماجد SDK — PHASE 31 · أقسام 49 و50 و52.
 *
 * نقطة الدخول الوحيدة للتطبيق. يُركّب المجالات فوق مستودعات ومزوّدين
 * يُحقنون كواجهات فقط: لا يعرف العميل أي تنفيذ ملموس، فيمكن استبدال
 * التخزين المحلي بخادم بعيد دون تعديل سطر في المجالات أو الشاشات.
 *
 * الاتجاه المسموح: UI → Use Case → SDK → Domain Contracts → Repositories.
 * ممنوع: SDK → UI · SDK → Zustand · SDK → Screen.
 */
import {
  API_VERSION,
  CONTRACT_VERSION,
  SDK_VERSION,
  createContextStore,
  noopAuditLogger,
  noopEventPublisher,
  systemClock,
  type AuditLogger,
  type AuthProvider,
  type Clock,
  type PaymentProvider,
  type EventPublisher,
  type SDKContext,
  type SDKContextStore,
} from '@/sdk/core';
import { createRbacService, type RbacRepository, type RbacService } from '@/sdk/rbac';
import { createTenancyService, type TenancyRepository, type TenancyService } from '@/sdk/tenancy';
import { createProductService, type ProductRepository, type ProductService } from '@/sdk/products';
import { createCartService, type CartService } from '@/sdk/cart';
import { createSaleService, type SaleRepository, type SaleService } from '@/sdk/sales';
import { createPaymentService, type PaymentRepository, type PaymentService } from '@/sdk/payments';
import { createInventoryService, type InventoryRepository, type InventoryService } from '@/sdk/inventory';
import { createCustomerService, type CustomerRepository, type CustomerService } from '@/sdk/customers';
import { createPosService, type PosService } from '@/sdk/pos';
import { createAIService, type AIProviderPort, type AIService } from '@/sdk/ai';
import { createAuthService, type AuthService } from '@/sdk/auth';
import { type AnalyticsTrackerPort, noopTracker } from '@/sdk/analytics';
import type { NotificationProviderPort } from '@/sdk/notifications';
// PHASE 32: واجهة العقود المُنسَّخة (سجلّ/توافق/ترحيل/قدرات).
import { createSDKContracts, type SDKContracts } from '@/sdk/contracts';
import { CAPABILITIES, type CapabilityName } from '@/contracts/core';

// المستودعات المطلوبة لتشغيل الـSDK (كلها واجهات).
export interface SDKRepositories {
  readonly products: ProductRepository; // المنتجات.
  readonly sales: SaleRepository; // الفواتير.
  readonly payments: PaymentRepository; // الدفعات.
  readonly inventory: InventoryRepository; // المخزون.
  readonly customers: CustomerRepository; // العملاء.
  readonly rbac: RbacRepository; // الأدوار والصلاحيات.
  readonly tenancy: TenancyRepository; // الهرمية.
}

// المزوّدون الاختياريون (منافذ خارجية).
export interface SDKProviders {
  readonly auth?: AuthProvider; // المصادقة (عقد النواة).
  readonly payment?: readonly PaymentProvider[]; // بوابات الدفع (عقد النواة).
  readonly ai?: AIProviderPort; // محرّك الذكاء.
  readonly notifications?: NotificationProviderPort; // الإشعارات.
  readonly analytics?: AnalyticsTrackerPort; // تتبّع الاستخدام.
}

// خيارات إنشاء الـSDK.
export interface CreateMajidSDKOptions {
  readonly context?: Partial<SDKContext>; // السياق الابتدائي.
  readonly repositories: SDKRepositories; // المستودعات (إلزامية).
  readonly providers?: SDKProviders; // المزوّدون.
  readonly events?: EventPublisher; // ناشر الأحداث (يربطه المضيف بناقله).
  readonly audit?: AuditLogger; // مُسجّل التدقيق.
  readonly clock?: Clock; // الساعة (تُحقن في الاختبارات).
  readonly defaultTaxRatePercent?: number; // نسبة الضريبة الافتراضية.
}

// واجهة الـSDK المُركَّب.
export interface MajidSDK {
  readonly version: string; // إصدار الـSDK.
  readonly apiVersion: string; // إصدار الواجهة.
  readonly contractVersion: string; // إصدار العقود.
  readonly context: SDKContextStore; // حاوية السياق.
  readonly auth?: AuthService; // المصادقة (متى وُجد مزوّدها).
  readonly rbac: RbacService; // الصلاحيات.
  readonly tenancy: TenancyService; // تعدد المستأجرين.
  readonly products: ProductService; // المنتجات.
  readonly cart: CartService; // السلة.
  readonly sales: SaleService; // المبيعات.
  readonly payments: PaymentService; // المدفوعات.
  readonly inventory: InventoryService; // المخزون.
  readonly customers: CustomerService; // العملاء.
  readonly pos: PosService; // نقطة البيع.
  readonly ai?: AIService; // الذكاء (متى وُجد مزوّده).
  readonly analytics: AnalyticsTrackerPort; // تتبّع الاستخدام.
  readonly contracts: SDKContracts; // طبقة العقود المُنسَّخة (PHASE 32).
  readonly capabilities: SDKContracts['capabilities']; // اكتشاف القدرات (قسم 64).
  // ينهي الجلسة ويمسح كل الحالة الداخلية.
  dispose(): void;
}

/**
 * يُركّب الـSDK كاملًا بحقن التبعيات.
 * ترتيب التركيب مقصود: الخدمات الأساسية (سياق/صلاحيات/نطاق) أولًا،
 * ثم مجالات البيانات، ثم نقطة البيع التي تعتمد عليها جميعًا.
 */
export const createMajidSDK = (options: CreateMajidSDKOptions): MajidSDK => {
  // (1) حاوية السياق — مصدر الحقيقة الوحيد للمستأجر والصلاحيات.
  const contextStore = createContextStore(options.context ?? {});
  // (2) البنية التحتية المشتركة (بدائل صامتة تُبقي الـSDK قابلًا للتشغيل منفردًا).
  const events = options.events ?? noopEventPublisher;
  const audit = options.audit ?? noopAuditLogger;
  const clock = options.clock ?? systemClock;
  const analytics = options.providers?.analytics ?? noopTracker;

  // (3) خدمات الأساس: الصلاحيات والنطاق (تعتمد عليهما كل المجالات).
  const rbac = createRbacService({ repository: options.repositories.rbac, contextStore });
  const tenancy = createTenancyService({ repository: options.repositories.tenancy, contextStore });

  // (4) المصادقة (اختيارية — تُركَّب متى وُجد منفذها).
  const auth = options.providers?.auth
    ? createAuthService({ provider: options.providers.auth, contextStore, audit, clock })
    : undefined;

  // (5) مجال المنتجات.
  const products = createProductService({
    repository: options.repositories.products,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
  });

  // (6) السلة (تقرأ الأسعار من مستودع المنتجات مباشرة — لا تكرار منطق).
  const cart = createCartService({
    products: options.repositories.products,
    tenancy,
    contextStore,
    clock,
    defaultTaxRatePercent: options.defaultTaxRatePercent,
  });

  // (7) المبيعات.
  const sales = createSaleService({
    repository: options.repositories.sales,
    products: options.repositories.products,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
    clock,
    defaultTaxRatePercent: options.defaultTaxRatePercent,
  });

  // (8) المدفوعات (بوابات الدفع تُحقن كمنافذ — لا بوابة مكوّدة صلبًا).
  const payments = createPaymentService({
    repository: options.repositories.payments,
    sales: options.repositories.sales,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
    providers: options.providers?.payment,
    clock,
  });

  // (9) المخزون.
  const inventory = createInventoryService({
    repository: options.repositories.inventory,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
    clock,
  });

  // (10) العملاء.
  const customers = createCustomerService({
    repository: options.repositories.customers,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
  });

  // (11) نقطة البيع: طبقة تنسيق فوق كل ما سبق.
  const pos = createPosService({
    cart,
    sales,
    salesRepository: options.repositories.sales,
    payments,
    inventory,
    products: options.repositories.products,
    contextStore,
    clock,
  });

  // (12) الذكاء (اختياري — يُركَّب متى وُجد مزوّده).
  const ai = options.providers?.ai
    ? createAIService({ provider: options.providers.ai, rbac, contextStore, audit, clock })
    : undefined;

  // (13) طبقة العقود المُنسَّخة — PHASE 32 (سجلّ/توافق/ترحيل/قدرات).
  // نحسب القدرات المتاحة فعلًا بناءً على المزوّدين المُحقنين.
  const availableCapabilities: CapabilityName[] = [
    CAPABILITIES.POS,
    CAPABILITIES.INVENTORY,
    CAPABILITIES.PAYMENTS,
    CAPABILITIES.FINANCE,
    CAPABILITIES.PROCUREMENT,
    CAPABILITIES.HR,
    CAPABILITIES.ANALYTICS,
    CAPABILITIES.OFFLINE,
    // الذكاء متاح فقط عند حقن مزوّده.
    ...(options.providers?.ai ? [CAPABILITIES.AI as CapabilityName] : []),
    // الإشعارات متاحة عند حقن مزوّدها.
    ...(options.providers?.notifications ? [CAPABILITIES.NOTIFICATIONS as CapabilityName] : []),
  ];
  const contracts = createSDKContracts({ availableCapabilities });

  // (14) الـSDK المُركَّب.
  return {
    version: SDK_VERSION,
    apiVersion: API_VERSION,
    contractVersion: CONTRACT_VERSION,
    context: contextStore,
    contracts,
    capabilities: contracts.capabilities,
    auth,
    rbac,
    tenancy,
    products,
    cart,
    sales,
    payments,
    inventory,
    customers,
    pos,
    ai,
    analytics,
    // إنهاء الجلسة: مسح السياق يُبطل مؤقتات الصلاحيات ويفرّغ السلة ضمنًا.
    dispose: () => {
      // مسح السياق يُشغّل مشتركي التغيّر فتُبطَل النسخ المؤقتة.
      contextStore.clear();
    },
  };
};
