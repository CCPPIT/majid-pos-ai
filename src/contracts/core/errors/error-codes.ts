/**
 * كتالوج أكواد الأخطاء المستقرة — PHASE 32 · أقسام 29 و30.
 *
 * الأخطاء نفسها عقود (Error Contracts): كل خطأ علني له كود ثابت لا
 * يتغيّر بين الإصدارات، ورسالة للبشر، وعلم قابلية إعادة المحاولة،
 * ونسخة. المستهلك يتفرّع على `error.code` حصرًا — قسم 30:
 *
 *   switch (error.code) {
 *     case 'PAYMENT_DECLINED': …
 *     case 'INVENTORY_INSUFFICIENT_STOCK': …
 *   }
 *
 * لا تُحذف أكواد قديمة ضمن نفس الرقم الرئيسي (قاعدة الإهمال — قسم 19).
 */

// فضاءات أكواد الأخطاء حسب المجال (بادئة ثابتة لكل مجال).
export const ERROR_NAMESPACES = {
  AUTH: 'AUTH', // المصادقة.
  RBAC: 'RBAC', // الصلاحيات.
  TENANCY: 'TENANCY', // تعدد المستأجرين.
  PRODUCT: 'PRODUCT', // المنتجات.
  CART: 'CART', // السلة.
  SALE: 'SALE', // المبيعات.
  PAYMENT: 'PAYMENT', // المدفوعات.
  INVENTORY: 'INVENTORY', // المخزون.
  CUSTOMER: 'CUSTOMER', // العملاء.
  FINANCE: 'FINANCE', // المالية.
  AI: 'AI', // الذكاء الاصطناعي.
  NETWORK: 'NETWORK', // الشبكة.
  CONTRACT: 'CONTRACT', // طبقة العقود نفسها (توافق/تحقق/ترحيل).
} as const;

// الكتالوج الكامل لأكواد الأخطاء العلنية المستقرة.
export const ERROR_CODES = {
  // ── مصادقة ── (قسم 29).
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS', // بيانات دخول خاطئة.
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED', // الجلسة منتهية.
  AUTH_SESSION_REQUIRED: 'AUTH_SESSION_REQUIRED', // لا توجد جلسة.
  AUTH_BIOMETRIC_FAILED: 'AUTH_BIOMETRIC_FAILED', // فشل التحقق الحيوي.
  // ── صلاحيات ──.
  RBAC_PERMISSION_DENIED: 'RBAC_PERMISSION_DENIED', // الصلاحية غير متاحة.
  RBAC_SCOPE_VIOLATION: 'RBAC_SCOPE_VIOLATION', // تجاوز نطاق مسموح.
  // ── نطاق/مستأجر ──.
  TENANCY_STORE_REQUIRED: 'TENANCY_STORE_REQUIRED', // متجر غير محدد.
  TENANCY_BOUNDARY_VIOLATION: 'TENANCY_BOUNDARY_VIOLATION', // عبور حدود مستأجر — قسم 42.
  // ── منتجات ──.
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND', // منتج غير موجود.
  PRODUCT_BARCODE_DUPLICATE: 'PRODUCT_BARCODE_DUPLICATE', // باركود مكرر.
  // ── سلة ──.
  CART_EMPTY: 'CART_EMPTY', // السلة فارغة عند الدفع.
  // ── مبيعات ──.
  SALE_NOT_FOUND: 'SALE_NOT_FOUND', // فاتورة غير موجودة.
  SALE_ALREADY_PAID: 'SALE_ALREADY_PAID', // الفاتورة مدفوعة فعلًا.
  SALE_NOT_REFUNDABLE: 'SALE_NOT_REFUNDABLE', // الفاتورة غير قابلة للاسترجاع.
  // ── مدفوعات ──.
  PAYMENT_FAILED: 'PAYMENT_FAILED', // فشل عام في الدفع.
  PAYMENT_DECLINED: 'PAYMENT_DECLINED', // البوابة رفضت الدفع.
  PAYMENT_INSUFFICIENT_TENDER: 'PAYMENT_INSUFFICIENT_TENDER', // المبلغ المسلّم أقل من الإجمالي.
  PAYMENT_METHOD_UNSUPPORTED: 'PAYMENT_METHOD_UNSUPPORTED', // طريقة دفع غير مدعومة.
  PAYMENT_PROVIDER_UNAVAILABLE: 'PAYMENT_PROVIDER_UNAVAILABLE', // مزوّد الدفع غير متاح.
  // ── مخزون ──.
  INVENTORY_INSUFFICIENT_STOCK: 'INVENTORY_INSUFFICIENT_STOCK', // رصيد غير كافٍ.
  INVENTORY_ITEM_NOT_FOUND: 'INVENTORY_ITEM_NOT_FOUND', // صنف مخزون غير موجود.
  // ── عملاء ──.
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND', // عميل غير موجود.
  // ── ذكاء اصطناعي ── (قسم 24: المخرجات لا تُقبل بلا تحقق).
  AI_OUTPUT_INVALID: 'AI_OUTPUT_INVALID', // مخرجات الذكاء فشلت في مخطط Zod.
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE', // مزوّد الذكاء غير متاح.
  AI_SAFETY_BLOCKED: 'AI_SAFETY_BLOCKED', // حجبته طبقة الأمان.
  // ── شبكة/اتصال ──.
  NETWORK_OFFLINE: 'NETWORK_OFFLINE', // دون اتصال والعملية تتطلب اتصالًا.
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT', // انتهت المهلة.
  // ── عقود/توافق ──.
  CONTRACT_VALIDATION_FAILED: 'CONTRACT_VALIDATION_FAILED', // فشل تحقق Zod.
  CONTRACT_VERSION_UNSUPPORTED: 'CONTRACT_VERSION_UNSUPPORTED', // نسخة خارج المدى المدعوم — قسم 13.
  CONTRACT_MIGRATION_NOT_FOUND: 'CONTRACT_MIGRATION_NOT_FOUND', // لا مسار ترحيل بين النسختين — قسم 21.
  CONTRACT_MIGRATION_FAILED: 'CONTRACT_MIGRATION_FAILED', // فشل الترحيل أثناء التحويل.
  CONTRACT_DEPRECATED_USED: 'CONTRACT_DEPRECATED_USED', // استُخدم عقد مهجور (تتبّع فقط — قسم 70).
} as const;

// نوع الكود المشتق من الكتالوج (كل القيم المعرّفة).
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// خصائص كل خطأ: هل يقبل إعادة المحاولة، ونسخة عقد الخطأ.
interface ErrorDefinition {
  readonly code: ErrorCode; // الكود الثابت.
  readonly retryable: boolean; // قابلية إعادة المحاولة الافتراضية.
  readonly errorVersion: string; // نسخة عقد الخطأ (تبدأ 1.0.0).
}

// خريطة تعريف الأكواد الثابتة (لا تتغيّر عبر MINOR/PATCH).
const ERROR_DEFINITIONS: Readonly<Record<ErrorCode, ErrorDefinition>> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: { code: ERROR_CODES.AUTH_SESSION_EXPIRED, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.AUTH_SESSION_REQUIRED]: { code: ERROR_CODES.AUTH_SESSION_REQUIRED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.AUTH_BIOMETRIC_FAILED]: { code: ERROR_CODES.AUTH_BIOMETRIC_FAILED, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.RBAC_PERMISSION_DENIED]: { code: ERROR_CODES.RBAC_PERMISSION_DENIED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.RBAC_SCOPE_VIOLATION]: { code: ERROR_CODES.RBAC_SCOPE_VIOLATION, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.TENANCY_STORE_REQUIRED]: { code: ERROR_CODES.TENANCY_STORE_REQUIRED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.TENANCY_BOUNDARY_VIOLATION]: { code: ERROR_CODES.TENANCY_BOUNDARY_VIOLATION, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PRODUCT_NOT_FOUND]: { code: ERROR_CODES.PRODUCT_NOT_FOUND, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PRODUCT_BARCODE_DUPLICATE]: { code: ERROR_CODES.PRODUCT_BARCODE_DUPLICATE, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CART_EMPTY]: { code: ERROR_CODES.CART_EMPTY, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.SALE_NOT_FOUND]: { code: ERROR_CODES.SALE_NOT_FOUND, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.SALE_ALREADY_PAID]: { code: ERROR_CODES.SALE_ALREADY_PAID, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.SALE_NOT_REFUNDABLE]: { code: ERROR_CODES.SALE_NOT_REFUNDABLE, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PAYMENT_FAILED]: { code: ERROR_CODES.PAYMENT_FAILED, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.PAYMENT_DECLINED]: { code: ERROR_CODES.PAYMENT_DECLINED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PAYMENT_INSUFFICIENT_TENDER]: { code: ERROR_CODES.PAYMENT_INSUFFICIENT_TENDER, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PAYMENT_METHOD_UNSUPPORTED]: { code: ERROR_CODES.PAYMENT_METHOD_UNSUPPORTED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE]: { code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.INVENTORY_INSUFFICIENT_STOCK]: { code: ERROR_CODES.INVENTORY_INSUFFICIENT_STOCK, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.INVENTORY_ITEM_NOT_FOUND]: { code: ERROR_CODES.INVENTORY_ITEM_NOT_FOUND, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CUSTOMER_NOT_FOUND]: { code: ERROR_CODES.CUSTOMER_NOT_FOUND, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.AI_OUTPUT_INVALID]: { code: ERROR_CODES.AI_OUTPUT_INVALID, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: { code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.AI_SAFETY_BLOCKED]: { code: ERROR_CODES.AI_SAFETY_BLOCKED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.NETWORK_OFFLINE]: { code: ERROR_CODES.NETWORK_OFFLINE, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.NETWORK_TIMEOUT]: { code: ERROR_CODES.NETWORK_TIMEOUT, retryable: true, errorVersion: '1.0.0' },
  [ERROR_CODES.CONTRACT_VALIDATION_FAILED]: { code: ERROR_CODES.CONTRACT_VALIDATION_FAILED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CONTRACT_VERSION_UNSUPPORTED]: { code: ERROR_CODES.CONTRACT_VERSION_UNSUPPORTED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CONTRACT_MIGRATION_NOT_FOUND]: { code: ERROR_CODES.CONTRACT_MIGRATION_NOT_FOUND, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CONTRACT_MIGRATION_FAILED]: { code: ERROR_CODES.CONTRACT_MIGRATION_FAILED, retryable: false, errorVersion: '1.0.0' },
  [ERROR_CODES.CONTRACT_DEPRECATED_USED]: { code: ERROR_CODES.CONTRACT_DEPRECATED_USED, retryable: false, errorVersion: '1.0.0' },
};

// يُعيد تعريف الخطأ لكود معيّن (يفيد في بناء الأخطاء في طبقة الـSDK).
export const getErrorDefinition = (code: ErrorCode): ErrorDefinition => ERROR_DEFINITIONS[code];

// يبني خطأ عقد بحقوله المطلوبة (للأخطاء الخالصة داخل العقود).
export const defineContractError = (
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly errorVersion: string;
  readonly details?: Readonly<Record<string, unknown>>;
} => {
  // نقرأ تعريف الكود الثابت.
  const def = getErrorDefinition(code);
  // نعيد كائن الخطأ الموصوف كاملًا.
  return Object.freeze({
    code: def.code,
    message,
    retryable: def.retryable,
    errorVersion: def.errorVersion,
    ...(details !== undefined ? { details } : {}),
  });
};
