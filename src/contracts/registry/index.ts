/**
 * تسجيل كل العقود في السجلّ الموحّد — PHASE 32 · أقسام 12 · 13 · 19.
 *
 * يُستدعى مرة واحدة عند إقلاع الـSDK فيسجّل كل عقد علني بنسخته ومدى
 * دعمه وحالة إهماله، ويسجّل الإهمالات بمصدر واحد. هذا الملف بيانات فقط.
 */
import {
  contractRegistry,
  deprecationRegistry,
  DOMAIN_CONTRACT_VERSIONS,
  type RegisterContractOptions,
} from '../core';

// نسخة المجال الحالية (اختصار).
const v = (domain: keyof typeof DOMAIN_CONTRACT_VERSIONS): string =>
  DOMAIN_CONTRACT_VERSIONS[domain];

/**
 * يعرّف عقدًا في السجلّ (idempotent: لا يكرّر التسجيل).
 * كل العقود تبدأ 1.0.0 ما لم يُذكر مدى أوسع.
 */
const define = (options: RegisterContractOptions): void => {
  if (!contractRegistry.has(options.name)) {
    contractRegistry.register(options);
  }
};

/**
 * يسجّل كل عقود المنصّة. يُستدعى من تركيب الـSDK ومن اختبارات الجودة.
 */
export const registerAllContracts = (): void => {
  // ── المنتجات ──.
  define({ name: '@majid/contracts/products/Product', domain: 'products', kind: 'entity', current: v('products') });
  define({ name: '@majid/contracts/products/CreateProductCommand', domain: 'products', kind: 'command', current: v('products') });
  define({ name: '@majid/contracts/products/SearchProductsQuery', domain: 'products', kind: 'query', current: v('products') });
  define({ name: '@majid/contracts/products/ProductRepository', domain: 'products', kind: 'repository', current: v('products') });

  // ── المبيعات: V1 مهجورة (تُقرأ عبر ترحيل) وV2 حالية ──.
  define({
    name: '@majid/contracts/sales/Sale',
    domain: 'sales',
    kind: 'entity',
    current: v('sales'),
    minimumSupported: '1.0.0',
    deprecatedVersions: ['1.0.0'],
    migrationsAvailable: ['1.0.0->2.0.0'],
  });
  define({ name: '@majid/contracts/sales/SaleRepository', domain: 'sales', kind: 'repository', current: v('sales') });

  // ── المدفوعات ──.
  define({ name: '@majid/contracts/payments/Payment', domain: 'payments', kind: 'entity', current: v('payments') });
  define({ name: '@majid/contracts/payments/CreatePaymentCommand', domain: 'payments', kind: 'command', current: v('payments') });
  define({ name: '@majid/contracts/payments/PaymentProvider', domain: 'payments', kind: 'provider', current: v('payments') });

  // ── المخزون ──.
  define({ name: '@majid/contracts/inventory/StockItem', domain: 'inventory', kind: 'entity', current: v('inventory') });
  define({ name: '@majid/contracts/inventory/AdjustStockCommand', domain: 'inventory', kind: 'command', current: v('inventory') });
  define({ name: '@majid/contracts/inventory/InventoryRepository', domain: 'inventory', kind: 'repository', current: v('inventory') });

  // ── العملاء ──.
  define({ name: '@majid/contracts/customers/Customer', domain: 'customers', kind: 'entity', current: v('customers') });
  define({ name: '@majid/contracts/customers/CustomerRepository', domain: 'customers', kind: 'repository', current: v('customers') });

  // ── السلة ونقطة البيع ──.
  define({ name: '@majid/contracts/cart/Cart', domain: 'cart', kind: 'entity', current: v('cart') });
  define({ name: '@majid/contracts/pos/CheckoutCommand', domain: 'pos', kind: 'command', current: v('pos') });

  // ── الصلاحيات والنطاق ──.
  define({ name: '@majid/contracts/rbac/Authorization', domain: 'rbac', kind: 'contract', current: v('rbac') });
  define({ name: '@majid/contracts/tenancy/TenantScope', domain: 'tenancy', kind: 'contract', current: v('tenancy') });

  // ── المصادقة ──.
  define({ name: '@majid/contracts/auth/Session', domain: 'auth', kind: 'entity', current: v('auth') });

  // ── الذكاء (تجريبي) ──.
  define({ name: '@majid/contracts/ai/AIResult', domain: 'ai', kind: 'result', current: v('ai'), stability: 'experimental' });
  define({ name: '@majid/contracts/ai/AIProvider', domain: 'ai', kind: 'provider', current: v('ai'), stability: 'experimental' });

  // ── بقية المجالات (عقود أساسية مسجّلة لتغطية المنصّة) ──.
  define({ name: '@majid/contracts/identity/Identity', domain: 'identity', kind: 'entity', current: v('identity') });
  define({ name: '@majid/contracts/organization/Organization', domain: 'organization', kind: 'entity', current: v('organization') });
  define({ name: '@majid/contracts/store/Store', domain: 'store', kind: 'entity', current: v('store') });
  define({ name: '@majid/contracts/procurement/PurchaseOrder', domain: 'procurement', kind: 'entity', current: v('procurement') });
  define({ name: '@majid/contracts/finance/Transaction', domain: 'finance', kind: 'entity', current: v('finance') });
  define({ name: '@majid/contracts/crm/Lead', domain: 'crm', kind: 'entity', current: v('crm') });
  define({ name: '@majid/contracts/hr/Employee', domain: 'hr', kind: 'entity', current: v('hr') });
  define({ name: '@majid/contracts/analytics/Report', domain: 'analytics', kind: 'query', current: v('analytics') });
  define({ name: '@majid/contracts/notifications/Notification', domain: 'notifications', kind: 'event', current: v('notifications') });

  // ── عقد الـAPI الأساسي (بلا خادم) ──.
  define({ name: '@majid/contracts/api/APIRequest', domain: 'core', kind: 'api', current: '1.0.0' });

  registerDeprecations();
};

/**
 * يسجّل الإهمالات (قسم 19). كل عنصر مهجور يحدد: منذ نسخة · يُزال بعد ·
 * البديل · دليل الترحيل. لا إهمال بلا بديل.
 */
const registerDeprecations = (): void => {
  // مثال: حقل totalAmount القديم في Sale V1 مهجور لصالح total (Money).
  deprecationRegistry.deprecate({
    kind: 'field',
    owner: '@majid/contracts/sales/Sale',
    target: 'totalAmount',
    deprecatedSince: '2.0.0',
    removeAfter: '3.0.0',
    replacement: 'total',
    migrationGuide: 'Migrate Sale V1→V2: total = { amount: totalAmount, currency }',
    lifecycle: 'deprecated',
    message: 'استخدم total (Money) بدل totalAmount الخام.',
  });

  // مثال: نسخة Sale 1.0.0 مهجورة بالكامل.
  deprecationRegistry.deprecate({
    kind: 'version',
    owner: '@majid/contracts/sales/Sale',
    target: '1.0.0',
    deprecatedSince: '2.0.0',
    removeAfter: '3.0.0',
    replacement: '@majid/contracts/sales/Sale@2.0.0',
    migrationGuide: 'مرّر البيانات عبر migrateSaleV1ToV2',
    lifecycle: 'migration_window',
  });
};
