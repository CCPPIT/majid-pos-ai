/**
 * سياق الـSDK — PHASE 31 · أقسام 09 و10 و58.
 * الـSDK واعٍ بالسياق: من المستخدم؟ أي مستأجر/مؤسسة/فرع/متجر؟ ما صلاحياته؟
 * أي لغة وعملة ومنطقة زمنية؟ أي جهاز؟
 * قاعدة صارمة: يُمنع تنفيذ أي عملية أعمال إن كان السياق المطلوب لها ناقصًا،
 * فلا تتسرب بيانات مستأجر إلى آخر (Tenant Isolation).
 */
import { ContextError } from '../errors/sdk-error';
import { failure, success, type Result } from '../result/result';
import type { CurrencyCode } from '../types/money';
import type { TimeZoneId } from '../types/datetime';
import type {
  BranchId,
  DeviceId,
  OrganizationId,
  RoleId,
  StoreId,
  TenantId,
  UserId,
} from '../identifiers/ids';

// لغات الواجهة المدعومة (العربية أولًا — RTL أولًا).
export type SDKLocale = 'ar' | 'en';

// سياق الـSDK الكامل (كل الحقول اختيارية لأن التطبيق يمر بمراحل تمهيد).
export interface SDKContext {
  readonly userId?: UserId; // المستخدم صاحب الجلسة.
  readonly tenantId?: TenantId; // المستأجر (جذر العزل).
  readonly organizationId?: OrganizationId; // المؤسسة.
  readonly branchId?: BranchId; // الفرع.
  readonly storeId?: StoreId; // المتجر النشط.
  readonly roleIds: readonly RoleId[]; // أدوار المستخدم.
  readonly permissions: readonly string[]; // صلاحياته المسطّحة.
  readonly locale: SDKLocale; // لغة العرض.
  readonly currency: CurrencyCode; // عملة العمليات.
  readonly timezone: TimeZoneId; // المنطقة الزمنية.
  readonly deviceId?: DeviceId; // معرّف الجهاز (تدقيق/أمان).
}

// الحقول المطلوبة في عملية معيّنة (تُستخدم في الحراسة قبل التنفيذ).
export type SDKContextRequirement = 'userId' | 'tenantId' | 'organizationId' | 'branchId' | 'storeId';

// سياق افتراضي فارغ: لا مستأجر ولا مستخدم — عمليات الأعمال محجوبة عليه.
export const EMPTY_CONTEXT: SDKContext = Object.freeze({
  roleIds: Object.freeze([]) as readonly RoleId[],
  permissions: Object.freeze([]) as readonly string[],
  locale: 'ar' as const,
  currency: 'YER' as const,
  timezone: 'UTC',
});

// يبني سياقًا جديدًا بدمج قيم جزئية فوق الافتراضي (Immutable).
export const createContext = (partial: Partial<SDKContext> = {}): SDKContext =>
  // التجميد يمنع أي تعديل لاحق على السياق بعد بنائه.
  Object.freeze({ ...EMPTY_CONTEXT, ...partial });

// يدمج تحديثًا جزئيًا فوق سياق قائم ويُعيد سياقًا جديدًا (لا تعديل في المكان).
export const mergeContext = (base: SDKContext, patch: Partial<SDKContext>): SDKContext =>
  Object.freeze({ ...base, ...patch });

/**
 * يتحقق أن السياق يحتوي كل الحقول المطلوبة لعملية ما.
 * يُعيد Result: الفشل يحمل ContextError بأسماء الحقول الناقصة (قسم 10).
 */
export const requireContext = (
  context: SDKContext,
  required: readonly SDKContextRequirement[],
): Result<SDKContext> => {
  // نجمع أسماء الحقول الناقصة فعلًا.
  const missing = required.filter((field) => {
    // نقرأ قيمة الحقل من السياق.
    const value = context[field];
    // الحقل ناقص إن كان غير معرّف أو نصًّا فارغًا.
    return value === undefined || String(value).trim().length === 0;
  });
  // وجود أي نقص يمنع تنفيذ العملية تمامًا.
  if (missing.length > 0) return failure(new ContextError(missing));
  // السياق مكتمل.
  return success(context);
};

// اختصار: هل السياق صالح لعمليات المستأجر (يحوي tenantId)؟
export const hasTenant = (context: SDKContext): boolean =>
  context.tenantId !== undefined && String(context.tenantId).trim().length > 0;

// اختصار: هل السياق صالح لعمليات نقطة البيع (مستأجر + متجر)؟
export const hasStore = (context: SDKContext): boolean =>
  hasTenant(context) && context.storeId !== undefined && String(context.storeId).trim().length > 0;

// اختصار: هل هناك مستخدم مُصادَق عليه في السياق؟
export const isAuthenticated = (context: SDKContext): boolean =>
  context.userId !== undefined && String(context.userId).trim().length > 0;

/**
 * حاوية السياق القابلة للتغيير المضبوط (Context Holder).
 * الـSDK يقرأ منها في كل عملية، وتُحدَّث من طبقة التطبيق عند تبديل المتجر
 * أو تسجيل الدخول/الخروج — لا تُحدَّث أبدًا من داخل مجال أعمال.
 */
export interface SDKContextStore {
  // يقرأ السياق الحالي (نسخة مجمّدة).
  get(): SDKContext;
  // يستبدل السياق بالكامل.
  set(context: Partial<SDKContext>): SDKContext;
  // يدمج تحديثًا جزئيًا فوق الحالي.
  patch(partial: Partial<SDKContext>): SDKContext;
  // يعيد السياق للحالة الفارغة (عند تسجيل الخروج).
  clear(): SDKContext;
  // يشترك في تغيّرات السياق ويُعيد دالة إلغاء الاشتراك.
  subscribe(listener: (context: SDKContext) => void): () => void;
}

// ينشئ حاوية سياق في الذاكرة (التنفيذ الافتراضي داخل عميل الـSDK).
export const createContextStore = (initial: Partial<SDKContext> = {}): SDKContextStore => {
  // السياق الحالي المحفوظ داخل الإغلاق (Closure) — لا وصول خارجي مباشر.
  let current = createContext(initial);
  // مجموعة المشتركين في التغيّرات.
  const listeners = new Set<(context: SDKContext) => void>();
  // يُخطر كل المشتركين بالسياق الجديد.
  const notify = (): void => {
    // نمرّ على نسخة من المجموعة حتى يصح إلغاء الاشتراك أثناء الإخطار.
    for (const listener of [...listeners]) listener(current);
  };
  // نُرجع الواجهة العلنية للحاوية.
  return {
    // قراءة السياق الحالي.
    get: () => current,
    // استبدال كامل ثم إخطار.
    set: (context) => {
      current = createContext(context);
      notify();
      return current;
    },
    // دمج جزئي ثم إخطار.
    patch: (partial) => {
      current = mergeContext(current, partial);
      notify();
      return current;
    },
    // تفريغ السياق (تسجيل الخروج) ثم إخطار.
    clear: () => {
      current = EMPTY_CONTEXT;
      notify();
      return current;
    },
    // تسجيل مشترك وإعادة دالة الإلغاء.
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
