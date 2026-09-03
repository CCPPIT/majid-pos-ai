/**
 * إصدارات الـSDK — PHASE 31 · قسم 64.
 * ثلاثة أرقام مستقلة: إصدار الحزمة، إصدار الواجهة، وإصدار العقود.
 * التنفيذ المتقدم (Deprecation · Migration · Compatibility Matrix) في
 * PHASE 32 — SDK CONTRACTS & VERSIONING. هنا نضع الأساس فقط.
 */

// إصدار حزمة الـSDK نفسها (Semantic Versioning).
export const SDK_VERSION = '1.0.0' as const;

// إصدار واجهة الاستدعاء العلنية (يتغيّر عند تغيير توقيع علني).
export const API_VERSION = 'v1' as const;

// إصدار عقود المجال (يتغيّر عند تغيير شكل كيان أو أمر أو استعلام).
export const CONTRACT_VERSION = '2026.09.1' as const;

// رقم المرحلة التي أنشأت هذه الطبقة (توثيق تاريخي داخل الشيفرة).
export const SDK_PHASE = 31 as const;

// بنية رقم إصدار دلالي مفكوك.
export interface SemanticVersion {
  readonly major: number; // تغيير كاسر.
  readonly minor: number; // إضافة متوافقة.
  readonly patch: number; // إصلاح متوافق.
}

// يفكّ نصّ إصدار دلالي إلى أجزائه (يُعيد أصفارًا عند صيغة غير مفهومة).
export const parseVersion = (version: string): SemanticVersion => {
  // نطابق الصيغة major.minor.patch.
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  // صيغة غير مطابقة → إصدار صفري بدل رمي خطأ.
  if (!match) return { major: 0, minor: 0, patch: 0 };
  // نحوّل الأجزاء الثلاثة إلى أرقام.
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
};

// يقارن إصدارين: سالب إن كان الأول أقدم، صفر عند التطابق، موجب إن كان أحدث.
export const compareVersions = (left: string, right: string): number => {
  // نفكّ الإصدارين.
  const a = parseVersion(left);
  const b = parseVersion(right);
  // نقارن الرقم الرئيسي أولًا.
  if (a.major !== b.major) return a.major - b.major;
  // ثم الثانوي.
  if (a.minor !== b.minor) return a.minor - b.minor;
  // ثم رقم الإصلاح.
  return a.patch - b.patch;
};

/**
 * هل إصدار الـSDK متوافق مع الحد الأدنى المطلوب؟
 * قاعدة التوافق الدلالي: نفس الرقم الرئيسي وإصدار أحدث أو مساوٍ.
 */
export const isCompatibleWith = (required: string, current: string = SDK_VERSION): boolean => {
  // نفكّ الإصدارين للمقارنة.
  const requiredVersion = parseVersion(required);
  const currentVersion = parseVersion(current);
  // اختلاف الرقم الرئيسي يعني تغييرًا كاسرًا.
  if (requiredVersion.major !== currentVersion.major) return false;
  // ضمن نفس الرقم الرئيسي: الحالي يجب ألا يكون أقدم من المطلوب.
  return compareVersions(current, required) >= 0;
};

// بطاقة تعريف الـSDK (تُعرض في شاشة "عن التطبيق" والتشخيص).
export interface SDKVersionInfo {
  readonly sdkVersion: string; // إصدار الحزمة.
  readonly apiVersion: string; // إصدار الواجهة.
  readonly contractVersion: string; // إصدار العقود.
  readonly phase: number; // المرحلة.
}

// يبني بطاقة الإصدار الحالية (قيم ثابتة وقت الترجمة).
export const sdkVersionInfo = (): SDKVersionInfo => ({
  sdkVersion: SDK_VERSION,
  apiVersion: API_VERSION,
  contractVersion: CONTRACT_VERSION,
  phase: SDK_PHASE,
});
