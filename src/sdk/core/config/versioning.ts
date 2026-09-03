/**
 * إصدارات الـSDK — PHASE 31 أساس · PHASE 32 تطوير (أقسام 09 · 10 · 11).
 * ثلاثة أرقام مستقلة: إصدار الحزمة، إصدار الواجهة، وإصدار العقود.
 *
 * PHASE 32 جعلت مصدر الحقيقة الموحّد في طبقة العقود (@/contracts/core):
 *  • SDK_VERSION و API_VERSION يُعاد تصديرهما من هناك (مصدر واحد — قسم 09).
 *  • نسخ المجالات المستقلة تعيش في DOMAIN_CONTRACT_VERSIONS (قسم 10).
 *  • نظام الإهمال/الترحيل/التوافق الكامل يأتي من طبقة العقود.
 * هذا الملف يبقى نقطة الاستيراد القديمة نفسها (توافق خلفي بلا كسر — قسم 83).
 */
// نستورد مصدر الحقيقة الموحّد من طبقة العقود (الاتجاه: SDK → Contracts).
import {
  API_VERSION as CONTRACTS_API_VERSION,
  CONTRACTS_VERSION,
  SDK_PHASE as CONTRACTS_SDK_PHASE,
  SDK_VERSION as CONTRACTS_SDK_VERSION,
} from '@/contracts/core';

// إصدار حزمة الـSDK نفسها (مصدره الموحّد طبقة العقود — قسم 09).
export const SDK_VERSION = CONTRACTS_SDK_VERSION;

// إصدار واجهة الاستدعاء العلنية (يتغيّر عند تغيير توقيع علني).
export const API_VERSION = CONTRACTS_API_VERSION;

// إصدار عقود المجال الكلي (مظلة فوق نسخ المجالات المستقلة — قسم 10).
export const CONTRACT_VERSION = CONTRACTS_VERSION;

// رقم المرحلة الحالية (توثيق تاريخي داخل الشيفرة).
export const SDK_PHASE = CONTRACTS_SDK_PHASE;

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
