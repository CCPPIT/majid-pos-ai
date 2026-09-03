/**
 * أنواع مجال الأمان: القفل التلقائي، إعدادات الأمان، وسلامة الجهاز (PHASE 26).
 * هذا المجال منطق نقطي بحت (مهلات/قرار قفل/مستوى سلامة) لا يلمس منصات ولا
 * تخزينًا — التنفيذ عبر الخدمات والمستودع. كل سطر بتعليق عربي.
 */

// خيارات مهلة القفل التلقائي (بالدقائق)؛ 'immediate' فور مغادرة التطبيق.
export type AutoLockTimeout = 'immediate' | 1 | 5 | 15 | 30 | 60;

// إعدادات أمان التطبيق (يختارها المستخدم وتُحفظ).
export interface SecuritySettings {
  autoLockEnabled: boolean; // هل القفل التلقائي مفعّل؟
  lockTimeout: AutoLockTimeout; // المهلة قبل القفل.
  biometricUnlockEnabled: boolean; // فتح القفل بالبصمة/الوجه.
  requirePinForSensitive: boolean; // طلب PIN قبل الإجراءات الحساسة (إعدادات/استرجاع).
}

// حالة القفل الحالية للتطبيق.
export type LockState =
  | 'unlocked' // مفتوح (الجلسة نشطة).
  | 'locked' // مقفل (يلزم PIN/بصمة).
  | 'no-credential'; // لا توجد بيانات اعتماد بعد (التسجيل فقط).

// نتيجة محاولة فتح القفل.
export interface UnlockResult {
  ok: boolean; // هل نجح؟
  reason?: 'wrong-pin' | 'cancelled' | 'unavailable' | 'no-credential'; // سبب الفشل.
}

// مستوى سلامة/أمان الجهاز.
export type DeviceTrustLevel = 'high' | 'medium' | 'low';

// تقرير سلامة الجهاز (يُشتق من فحوصات المنصة).
export interface DeviceSecurityReport {
  isDevice: boolean; // هل جهاز حقيقي أم محاكاة/ويب؟
  hasBiometricHardware: boolean; // هل يوجد عتاد بصمة؟
  biometricEnrolled: boolean; // هل سُجّلت بصمة/وجه؟
  biometricKind: 'face' | 'fingerprint' | 'iris' | 'none'; // النوع.
  trustLevel: DeviceTrustLevel; // مستى الثقة المشتق.
  warnings: string[]; // مفاتيح ترجمة التحذيرات.
}

// حدث نشاط المستخدم (لإعادة ضبط مؤقت الخمول).
export type AppActivity =
  | 'foreground' // عاد التطبيق للمقدمة.
  | 'background' // ذهب للخلفية.
  | 'user-interaction'; // لمس/تفاعل داخل التطبيق.
