/**
 * نظام أخطاء الـSDK — PHASE 31 · قسم 07.
 * كل خطأ أعمال يحمل: code · message · details · cause · retryable.
 * الأخطاء لا تُرمى كآلية وحيدة؛ تُعاد داخل Result (قسم 06)، والاستثناءات
 * تُحوَّل إلى SDKError عند حدود النظام فقط.
 */
import { AppError } from '@/core/errors/AppError';

// أكواد الأخطاء القانونية للـSDK (اتحاد مُميَّز — قسم 43).
export type SDKErrorCode =
  | 'SDK_ERROR' // خطأ عام غير مصنّف داخل الـSDK.
  | 'AUTHENTICATION_ERROR' // لا توجد جلسة صالحة.
  | 'AUTHORIZATION_ERROR' // الجلسة موجودة لكن الصلاحية/النطاق غير كافٍ.
  | 'VALIDATION_ERROR' // مدخلات غير صالحة (Zod أو قاعدة مجال).
  | 'NOT_FOUND' // المورد المطلوب غير موجود.
  | 'CONFLICT' // تعارض حالة (تكرار/سباق كتابة).
  | 'NETWORK_ERROR' // فشل نقل شبكي قابل لإعادة المحاولة.
  | 'OFFLINE' // الجهاز دون اتصال والعملية تحتاج شبكة.
  | 'TIMEOUT' // انتهت المهلة قبل اكتمال العملية.
  | 'RATE_LIMIT' // تجاوز حد معدّل الاستدعاء.
  | 'PAYMENT_ERROR' // فشل في مسار الدفع/البوابة.
  | 'INVENTORY_ERROR' // خرق قاعدة مخزون (رصيد غير كافٍ…).
  | 'BUSINESS_RULE_ERROR' // خرق قاعدة عمل عامة.
  | 'CONTEXT_ERROR' // سياق الـSDK ناقص (مستأجر/متجر غير محدد — قسم 10).
  | 'UNKNOWN_ERROR'; // خطأ غير معروف المصدر.

// خيارات بناء الخطأ (كلها اختيارية عدا الرسالة).
export interface SDKErrorOptions {
  // تفاصيل آلية آمنة للتسجيل والتدقيق (بدون بيانات حساسة — قسم 65).
  readonly details?: Readonly<Record<string, unknown>>;
  // الخطأ الأصلي الذي تسبب في هذا الخطأ (سلسلة الأسباب).
  readonly cause?: unknown;
  // هل يمكن إعادة المحاولة تلقائيًا/يدويًا؟ (يقود واجهة إعادة المحاولة).
  readonly retryable?: boolean;
}

/**
 * الخطأ الأساسي لكل أخطاء الـSDK.
 * صنف مجرّد: كل خطأ فعلي يرث منه ويحدد كوده الثابت.
 */
export abstract class SDKError extends Error {
  // كود الخطأ الثابت لكل صنف مشتق (يُستخدم في التفريع البرمجي والترجمة).
  abstract readonly code: SDKErrorCode;
  // تفاصيل مجمّدة لمنع التعديل بعد الإنشاء.
  readonly details: Readonly<Record<string, unknown>>;
  // هل العملية قابلة لإعادة المحاولة؟
  readonly retryable: boolean;
  // السبب الجذري (خطأ آخر أو قيمة خام).
  readonly cause: unknown;

  // المُنشئ محمي: لا يُنشأ الخطأ الأساسي مباشرة، بل عبر الأصناف المشتقة.
  protected constructor(message: string, options?: SDKErrorOptions) {
    // نمرر الرسالة والسبب لمُنشئ Error القياسي.
    super(message);
    // اسم الخطأ يساوي اسم الصنف المشتق فعليًا (مفيد في التسجيل).
    this.name = new.target.name;
    // نجمّد التفاصيل حتى لا يعدّلها مستهلك لاحقًا.
    this.details = Object.freeze({ ...(options?.details ?? {}) });
    // إعادة المحاولة معطّلة افتراضيًا (الأخطاء المنطقية لا تُعاد).
    this.retryable = options?.retryable ?? false;
    // نحتفظ بالسبب الجذري كما هو للتشخيص.
    this.cause = options?.cause;
  }

  // تمثيل آمن قابل للتسلسل (يُستخدم في التدقيق والسجلات دون كشف السبب الخام).
  toJSON(): Record<string, unknown> {
    return {
      code: this.code, // كود الخطأ.
      name: this.name, // اسم الصنف.
      message: this.message, // الرسالة البشرية/المفتاح.
      details: this.details, // التفاصيل الآمنة.
      retryable: this.retryable, // قابلية إعادة المحاولة.
    };
  }
}

// خطأ مصادقة: لا جلسة أو الجلسة منتهية (قسم 11).
export class AuthenticationError extends SDKError {
  readonly code = 'AUTHENTICATION_ERROR' as const;
  constructor(message = 'sdk.error.authentication', options?: SDKErrorOptions) {
    // المصادقة قابلة لإعادة المحاولة بعد تسجيل الدخول من جديد.
    super(message, { retryable: false, ...options });
  }
}

// خطأ تفويض: الجلسة صالحة لكن الإذن/النطاق ناقص (قسم 12 و57).
export class AuthorizationError extends SDKError {
  readonly code = 'AUTHORIZATION_ERROR' as const;
  constructor(message = 'sdk.error.authorization', options?: SDKErrorOptions) {
    // نقص الصلاحية لا يُصلَح بإعادة المحاولة.
    super(message, { retryable: false, ...options });
  }
}

// خطأ تحقّق من المدخلات (مخرجات Zod أو قواعد المجال — قسم 42).
export class ValidationError extends SDKError {
  readonly code = 'VALIDATION_ERROR' as const;
  // خريطة أخطاء الحقول (اسم الحقل ← رسالة/مفتاح) لعرضها في النماذج.
  readonly fieldErrors: Readonly<Record<string, string>>;
  constructor(
    message = 'sdk.error.validation',
    fieldErrors: Record<string, string> = {},
    options?: SDKErrorOptions,
  ) {
    // نضع أخطاء الحقول ضمن التفاصيل أيضًا لتظهر في التدقيق.
    super(message, { ...options, details: { ...(options?.details ?? {}), fieldErrors } });
    // نجمّد خريطة الحقول.
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

// المورد غير موجود (منتج/طلب/عميل…).
export class NotFoundError extends SDKError {
  readonly code = 'NOT_FOUND' as const;
  constructor(resource: string, id?: string, options?: SDKErrorOptions) {
    // الرسالة تحمل اسم المورد ومعرّفه لتسهيل التشخيص.
    super(`sdk.error.notFound:${resource}`, {
      ...options,
      details: { ...(options?.details ?? {}), resource, id },
    });
  }
}

// تعارض حالة (باركود مكرّر، تعديل متزامن، إعادة استخدام رقم…).
export class ConflictError extends SDKError {
  readonly code = 'CONFLICT' as const;
  constructor(message = 'sdk.error.conflict', options?: SDKErrorOptions) {
    // التعارض قد يُحل بإعادة القراءة ثم المحاولة.
    super(message, { retryable: true, ...options });
  }
}

// فشل نقل شبكي (يُعاد تلقائيًا وفق سياسة إعادة المحاولة).
export class NetworkError extends SDKError {
  readonly code = 'NETWORK_ERROR' as const;
  constructor(message = 'sdk.error.network', options?: SDKErrorOptions) {
    // أخطاء الشبكة قابلة لإعادة المحاولة دائمًا.
    super(message, { retryable: true, ...options });
  }
}

// الجهاز دون اتصال والعملية تحتاج مصدرًا بعيدًا (قسم 56).
export class OfflineError extends SDKError {
  readonly code = 'OFFLINE' as const;
  constructor(message = 'sdk.error.offline', options?: SDKErrorOptions) {
    // العملية تُعاد عند عودة الاتصال.
    super(message, { retryable: true, ...options, details: { ...(options?.details ?? {}), offline: true } });
  }
}

// انتهت المهلة الزمنية للعملية.
export class TimeoutError extends SDKError {
  readonly code = 'TIMEOUT' as const;
  constructor(message = 'sdk.error.timeout', options?: SDKErrorOptions) {
    // المهلة قابلة لإعادة المحاولة.
    super(message, { retryable: true, ...options });
  }
}

// تجاوز حد معدّل الاستدعاء (يفيد عند ربط MAJID API لاحقًا).
export class RateLimitError extends SDKError {
  readonly code = 'RATE_LIMIT' as const;
  // عدد الثواني المقترح للانتظار قبل إعادة المحاولة.
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds = 1, options?: SDKErrorOptions) {
    // نضع مدة الانتظار في التفاصيل ليقرأها المتصل.
    super('sdk.error.rateLimit', {
      retryable: true,
      ...options,
      details: { ...(options?.details ?? {}), retryAfterSeconds },
    });
    // نخزّن المدة كخاصية مباشرة أيضًا.
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// فشل في مسار الدفع (بوابة/مبلغ/طريقة غير مدعومة — قسم 19).
export class PaymentError extends SDKError {
  readonly code = 'PAYMENT_ERROR' as const;
  constructor(message = 'sdk.error.payment', options?: SDKErrorOptions) {
    // الفشل التقني للبوابة قابل لإعادة المحاولة؛ يحدده المتصل.
    super(message, { retryable: false, ...options });
  }
}

// خرق قاعدة مخزون (رصيد غير كافٍ، تحويل لنفس المتجر…) — قسم 20.
export class InventoryError extends SDKError {
  readonly code = 'INVENTORY_ERROR' as const;
  constructor(message = 'sdk.error.inventory', options?: SDKErrorOptions) {
    // قواعد المخزون منطقية ولا تُصلَح بإعادة المحاولة.
    super(message, { retryable: false, ...options });
  }
}

// خرق قاعدة عمل عامة (استرجاع يتجاوز الإجمالي، حالة غير مسموحة…).
export class BusinessRuleError extends SDKError {
  readonly code = 'BUSINESS_RULE_ERROR' as const;
  constructor(message = 'sdk.error.businessRule', options?: SDKErrorOptions) {
    // قواعد العمل لا تُعاد تلقائيًا.
    super(message, { retryable: false, ...options });
  }
}

// سياق الـSDK ناقص: لا مستأجر/متجر محدد لعملية تتطلبه (قسم 10 و58).
export class ContextError extends SDKError {
  readonly code = 'CONTEXT_ERROR' as const;
  // أسماء الحقول الناقصة في السياق.
  readonly missing: readonly string[];
  constructor(missing: readonly string[], options?: SDKErrorOptions) {
    // نضع الحقول الناقصة في الرسالة والتفاصيل معًا.
    super('sdk.error.contextMissing', {
      ...options,
      details: { ...(options?.details ?? {}), missing: [...missing] },
    });
    // نحتفظ بالقائمة كخاصية مقروءة.
    this.missing = Object.freeze([...missing]);
  }
}

// خطأ غير معروف (آخر خط دفاع عند تحويل الاستثناءات).
export class UnknownError extends SDKError {
  readonly code = 'UNKNOWN_ERROR' as const;
  constructor(message = 'sdk.error.unknown', options?: SDKErrorOptions) {
    // غير معروف الأصل → لا نفترض قابلية إعادة المحاولة.
    super(message, { retryable: false, ...options });
  }
}

// خريطة تحويل أكواد AppError (الطبقة القديمة) إلى أخطاء الـSDK (قسم 75).
const APP_ERROR_FACTORIES: Record<string, (error: AppError) => SDKError> = {
  // خطأ تحقّق قديم → خطأ تحقّق SDK مع الاحتفاظ بالتفاصيل.
  VALIDATION_ERROR: (error) => new ValidationError(error.message, {}, { cause: error, details: error.details }),
  // غير موجود → NotFoundError مع اسم المورد من التفاصيل إن وُجد.
  NOT_FOUND: (error) =>
    new NotFoundError(String(error.details?.resource ?? 'resource'), String(error.details?.id ?? ''), { cause: error }),
  // منع صلاحية → خطأ تفويض.
  PERMISSION_DENIED: (error) => new AuthorizationError(error.message, { cause: error, details: error.details }),
  // مطلوب تسجيل دخول → خطأ مصادقة.
  AUTHENTICATION_REQUIRED: (error) => new AuthenticationError(error.message, { cause: error }),
  // خطأ شبكة.
  NETWORK_ERROR: (error) => new NetworkError(error.message, { cause: error }),
  // دون اتصال.
  OFFLINE: (error) => new OfflineError(error.message, { cause: error }),
  // تعارض.
  CONFLICT: (error) => new ConflictError(error.message, { cause: error, details: error.details }),
  // خرق قاعدة عمل.
  BUSINESS_RULE_VIOLATION: (error) =>
    new BusinessRuleError(error.message, { cause: error, details: error.details }),
};

/**
 * يحوّل أي قيمة مرمية إلى SDKError مصنّف.
 * يُستخدم عند حدود الـSDK (Adapters/Providers) لتغليف الاستثناءات القديمة.
 */
export const toSDKError = (error: unknown): SDKError => {
  // خطأ SDK أصلًا → نعيده كما هو دون تغليف.
  if (error instanceof SDKError) return error;
  // خطأ التطبيق القديم → نطابقه بخريطة التحويل.
  if (error instanceof AppError) {
    // نبحث عن مصنع مطابق لكود الخطأ القديم.
    const factory = APP_ERROR_FACTORIES[error.code];
    // إن وُجد مصنع نستخدمه، وإلا نُرجع خطأ غير معروف يحمل الرسالة.
    return factory ? factory(error) : new UnknownError(error.message, { cause: error, details: error.details });
  }
  // خطأ JS قياسي → نغلّفه كخطأ غير معروف مع الاحتفاظ بالرسالة.
  if (error instanceof Error) return new UnknownError(error.message, { cause: error });
  // قيمة خام (نص/رقم) → نحوّلها لنص في التفاصيل.
  return new UnknownError('sdk.error.unknown', { cause: error, details: { raw: String(error) } });
};

// يتحقق أن قيمة ما هي خطأ SDK من كود محدد (حارس نوع مفيد في الاختبارات والواجهة).
export const isSDKErrorCode = (error: unknown, code: SDKErrorCode): error is SDKError =>
  error instanceof SDKError && error.code === code;
