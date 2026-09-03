/**
 * منطق سياسة القفل النقي (PHASE 26).
 * دوال خالصة تقرّر متى يُقفل التطبيق وتبني تقرير سلامة الجهاز، دون منصات
 * أو تخزين. سهلة الاختبار؛ الخدمة المنصّية تُغذّيها بالطوابع الزمنية.
 */
import type {
  AutoLockTimeout,
  DeviceSecurityReport,
  DeviceTrustLevel,
  SecuritySettings,
} from './types';

// الإعدادات الافتراضية الآمنة (قفل مفعّل بعد دقيقة، بصمة إن وُجدت).
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  autoLockEnabled: true,
  lockTimeout: 1,
  biometricUnlockEnabled: true,
  requirePinForSensitive: true,
};

// خيارات المهلة المعروضة (للقائمة المنسدلة) — قيمة بالميلي ثانية للراحة.
export const TIMEOUT_MINUTES: AutoLockTimeout[] = ['immediate', 1, 5, 15, 30, 60];

// يحوّل خيار المهلة إلى ميلي ثوانٍ (0 = فوري).
export function timeoutMs(timeout: AutoLockTimeout): number {
  if (timeout === 'immediate') return 0;
  return timeout * 60 * 1000;
}

// مدخلات قرار القفل.
export interface LockDecisionInput {
  settings: SecuritySettings; // إعدادات الأمان.
  hasCredential: boolean; // هل توجد بيانات اعتماد (PIN)؟
  lastBackgroundAt: number | null; // لحظة آخر انتقال للخلفية (ms epoch).
  now: number; // اللحظة الحالية.
}

// هل يجب القفل عند العودة للمقدمة؟ (قاعدة: بيانات اعتماد + قفل مفعّل + تجاوز المهلة).
export function shouldLockOnForeground(input: LockDecisionInput): boolean {
  const { settings, hasCredential, lastBackgroundAt, now } = input;
  // لا قفل بلا بيانات اعتماد (التسجيل) أو إن عُطّل القفل.
  if (!hasCredential || !settings.autoLockEnabled) return false;
  // لم يذهب للخلفية بعد → لا قفل.
  if (lastBackgroundAt === null) return false;
  const elapsed = now - lastBackgroundAt;
  // الفوري: أي ذهاب للخلفية يستوجب القفل.
  if (settings.lockTimeout === 'immediate') return true;
  return elapsed >= timeoutMs(settings.lockTimeout);
}

// بيانات فحص الجهاز الخام (من خدمة المنصة).
export interface DeviceFacts {
  isDevice: boolean; // جهاز حقيقي؟
  hasBiometricHardware: boolean; // عتاد بصمة؟
  biometricEnrolled: boolean; // بصمة مسجّلة؟
  biometricKind: DeviceSecurityReport['biometricKind']; // النوع.
}

// يبني تقرير سلامة الجهاز ومستى ثقته + تحذيرات (نقي).
export function buildDeviceReport(facts: DeviceFacts): DeviceSecurityReport {
  const warnings: string[] = [];
  let trustLevel: DeviceTrustLevel;

  if (!facts.isDevice) {
    // محاكاة/ويب → ثقة منخفضة (لا خزنة حقيقية).
    trustLevel = 'low';
    warnings.push('security.deviceWarningEmulator');
  } else if (facts.biometricEnrolled) {
    // جهاز حقيقي وبصمة مسجّلة → ثقة عالية.
    trustLevel = 'high';
  } else if (facts.hasBiometricHardware) {
    // عتاد موجود لكن بلا بصمة مسجّلة → ثقة متوسطة.
    trustLevel = 'medium';
    warnings.push('security.deviceWarningNoEnroll');
  } else {
    // جهاز بلا عتاد بصمة إطلاقًا → متوسط (يبقى PIN).
    trustLevel = 'medium';
    warnings.push('security.deviceWarningNoHardware');
  }

  return {
    isDevice: facts.isDevice,
    hasBiometricHardware: facts.hasBiometricHardware,
    biometricEnrolled: facts.biometricEnrolled,
    biometricKind: facts.biometricKind,
    trustLevel,
    warnings,
  };
}

// يدمج إعدادات محفوظة (جزئية) مع الافتراضية بأمان.
export function normalizeSettings(raw: Partial<SecuritySettings> | null): SecuritySettings {
  if (!raw) return { ...DEFAULT_SECURITY_SETTINGS };
  return {
    autoLockEnabled: raw.autoLockEnabled ?? DEFAULT_SECURITY_SETTINGS.autoLockEnabled,
    lockTimeout: raw.lockTimeout ?? DEFAULT_SECURITY_SETTINGS.lockTimeout,
    biometricUnlockEnabled: raw.biometricUnlockEnabled ?? DEFAULT_SECURITY_SETTINGS.biometricUnlockEnabled,
    requirePinForSensitive: raw.requirePinForSensitive ?? DEFAULT_SECURITY_SETTINGS.requirePinForSensitive,
  };
}
