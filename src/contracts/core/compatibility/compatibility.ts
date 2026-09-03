/**
 * محرّك التوافق (Compatibility Matrix) — PHASE 32 · أقسام 14 و15.
 *
 * يقرّر هل مجموعة نسخ (SDK · عقد · API · مزوّد) قادرة على العمل معًا.
 * القواعد مركزية هنا بدل فحوصات متناثرة، فتُختبر مرّة واحدة وتُطبَّق في
 * كل الحدود (استجابات API · أوامر غير متصلة · مزوّدون).
 */
import { compareSemVer, isSemVerCompatible, parseSemVer } from '../versioning/semver';

// أبعاد التوافق التي تُفحص (قسم 14).
export interface CompatibilityContext {
  readonly sdkVersion: string; // نسخة الـSDK المنتِجة/المستهلكة.
  readonly contractVersion: string; // نسخة العقد.
  readonly apiVersion?: string; // نسخة الـAPI (مستقبلًا — قسم 11).
  readonly providerVersion?: string; // نسخة المزوّد (قسم 36).
}

// نتيجة فحص التوافق.
export interface CompatibilityResult {
  readonly compatible: boolean; // هل المجموعة متوافقة؟
  readonly reason?: string; // سبب عدم التوافق (للعرض والسجلات).
  readonly requiresMigration?: boolean; // هل يلزم ترحيل قبل الاستهلاك؟
}

/**
 * مصفوفة توافق SDK ← API (قسم 14).
 * المفتاح: رقم رئيسي للـSDK، القيمة: مدى أرقام API الرئيسية المدعومة.
 * مثال المفهوم: «SDK 2.x يدعم API 1.x و2.x». اليوم ندعم API v1 فقط.
 */
export const SDK_API_COMPATIBILITY: Readonly<Record<number, readonly number[]>> = {
  1: [1], // SDK رئيسي 1 ← API رئيسي 1.
};

// يفحص توافق رقمين رئيسيين لـSDK وAPI وفق المصفوفة.
const isApiMajorCompatible = (sdkMajor: number, apiVersion: string): boolean => {
  // نفكّ نسخة الـAPI الدلالية.
  const api = parseSemVer(apiVersion);
  // نبحث عن صف الرقم الرئيسي للـSDK.
  const supportedApiMajors = SDK_API_COMPATIBILITY[sdkMajor];
  // لا صفّ أو الرقم الرئيسي للـAPI غير مدرج → غير متوافق.
  return supportedApiMajors?.includes(api.major) ?? false;
};

// يفحص التوافق الكامل لمجموعة نسخ مقابل بعضها (SDK ومكوّناته).
export const checkCompatibility = (
  expected: CompatibilityContext,
  actual: CompatibilityContext,
): CompatibilityResult => {
  // (1) توافق SDK: نفس الرقم الرئيسي والفعلي ليس أقدم من المتوقع.
  if (!isSemVerCompatible(expected.sdkVersion, actual.sdkVersion)) {
    return {
      compatible: false,
      reason: `SDK ${actual.sdkVersion} لا يخدم متطلب ${expected.sdkVersion} (اختلاف رئيسي أو أقدم)`,
    };
  }
  // (2) توافق العقد: اختلاف الرقم الرئيسي كسر لا يُجبَر.
  const expectedContract = parseSemVer(expected.contractVersion);
  const actualContract = parseSemVer(actual.contractVersion);
  if (expectedContract.major !== actualContract.major) {
    return {
      compatible: false,
      reason: `عقد ${actual.contractVersion} كاسر مقابل المتوقع ${expected.contractVersion} (اختلاف رئيسي)`,
    };
  }
  // (3) ضمن نفس الرئيسي: نسخة فعلية أقدم من المطلوب → متوافق بعد الترحيل.
  //     (البيانات/المزوّد أقدم، والمحرّك يرقّيها للنسخة الحالية — قسم 21).
  const needsMigration = compareSemVer(actual.contractVersion, expected.contractVersion) < 0;
  // (4) فحص الـAPI متى حُدد (مؤسَّس لمستقبل v2/v3 — قسم 61).
  if (expected.apiVersion && actual.apiVersion) {
    const sdkMajor = parseSemVer(actual.sdkVersion).major;
    if (!isApiMajorCompatible(sdkMajor, actual.apiVersion)) {
      return {
        compatible: false,
        reason: `API ${actual.apiVersion} غير مدعوم من SDK رئيسي ${sdkMajor}`,
      };
    }
  }
  // (5) فحص نسخة المزوّد متى حُددت (قسم 36 — نفس الرقم الرئيسي).
  if (expected.providerVersion && actual.providerVersion) {
    if (!isSemVerCompatible(expected.providerVersion, actual.providerVersion)) {
      return {
        compatible: false,
        reason: `المزوّد ${actual.providerVersion} غير متوافق مع المتوقع ${expected.providerVersion}`,
      };
    }
  }
  // كل الفحوصات مرّت؛ نعلّم الحاجة للترحيل إن وُجدت.
  return { compatible: true, requiresMigration: needsMigration };
};

// يختار أعلى نسخة متوافقة من قائمة نسخ يعرضها نظير (تفاوض مستقبلي — قسم 61).
export const negotiateVersion = (
  requiredMajor: number,
  offeredVersions: readonly string[],
): string | undefined =>
  // نأخذ أعلى نسخة تشترك بنفس الرقم الرئيسي المطلوب.
  offeredVersions
    .filter((v) => parseSemVer(v).major === requiredMajor)
    .sort(compareSemVer)
    .at(-1);
