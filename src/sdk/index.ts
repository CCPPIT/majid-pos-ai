/**
 * الواجهة العلنية لماجد SDK — PHASE 31 · أقسام 49 و51.
 *
 * هذا هو الحاجز الوحيد الذي يستورد منه التطبيق. الاستيراد من مسارات
 * داخلية عميقة (‎@/sdk/products/services/…‎) ممنوع: يكسر قابلية إعادة
 * الهيكلة ويخلق اقترانًا لا يظهر في العقود.
 */

// ── النواة ──
export * from './core';

// ── عميل الـSDK (نقطة الدخول) ──
export {
  createMajidSDK,
  type MajidSDK,
  type CreateMajidSDKOptions,
  type SDKRepositories,
  type SDKProviders,
} from './client/majid-sdk';

// ── المجالات ──
export * from './rbac';
export * from './tenancy';
export * from './products';
export * from './cart';
export * from './sales';
export * from './inventory';
export * from './customers';
export * from './pos';
export * from './ai';
export * from './identity';

/**
 * المجالات التالية تعيد تصدير عقودًا مملوكة لطبقة أدنى (النواة أو tenancy)
 * تيسيرًا على من يستورد من المجال مباشرة. تصديرها هنا بـ‎export *‎ يُنتج
 * اسمًا واحدًا من مصدرين، فنُصدّر ما يملكه كل مجال حصرًا ونترك العقود
 * المشتركة للنواة وحدها — مصدر واحد لكل اسم في الحاجز العلني.
 */

// المدفوعات: عقود المزوّد مملوكة للنواة، وما دونها مملوك للمجال.
export {
  createPaymentService,
  toProviderMethod,
  AMOUNT_TOLERANCE,
  calculateChange,
  isSufficient,
  requiresProvider,
  requiresTendered,
  splitsCoverTotal,
  splitsShortfall,
  splitsTotal,
  suggestQuickCash,
  paymentSplit,
  zeroAmount,
  processPaymentSchema,
  refundPaymentSchema,
  type Payment,
  type PaymentMethod,
  type PaymentRepository,
  type PaymentService,
  type PaymentServiceDependencies,
  type PaymentSplit,
  type PaymentStatus,
  type PaymentListQuery,
  type ProcessPaymentCommand,
  type RefundPaymentCommand,
} from './payments';

// المصادقة: عقود المزوّد والجلسة مملوكة للنواة، والخدمة مملوكة للمجال.
export { createAuthService, isSessionValid, authFailure, type AuthService } from './auth';

// المؤسسة والمتجر: الكيانات مملوكة لمجال tenancy، والمستودعات مملوكة لهما.
export { type OrganizationRepository } from './organization';
export { DEFAULT_STORE_SETTINGS, type StoreRepository, type StoreSettings } from './store';
export * from './procurement';
export * from './finance';
export * from './crm';
export * from './hr';
export * from './analytics';
export * from './notifications';
