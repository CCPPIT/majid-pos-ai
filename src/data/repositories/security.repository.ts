/**
 * مستودع الأمان (PHASE 26).
 * يدير إعدادات القفل التطبيق (تحفظ محليًا) وينسّق فتح القفل بـ PIN أو البصمة
 * عبر مستودع الجلسة وخدمة القياس الحيوي. لا منطق قواعد هنا — القرارات النقية
 * في domain/security-lock؛ هذا الحد للبنية التحتية (تخزين/منصات).
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import { normalizeSettings } from '@/domain/security-lock';
import type { SecuritySettings, UnlockResult } from '@/domain/security-lock';
import { promptBiometric } from '@/security/biometric/biometric';
import type { PreferencesSource } from '../sources/preferences.source';
import type { SessionRepository } from './session.repository';

// واجهة مستودع الأمان.
export interface SecurityRepository {
  getSettings(): Promise<SecuritySettings>; // يقرأ الإعدادات (مع الافتراضي).
  saveSettings(settings: SecuritySettings): Promise<void>; // يحفظ الإعدادات.
  hasCredential(): Promise<boolean>; // هل يوجد PIN مسجّل؟
  isBiometricEnabled(): Promise<boolean>; // هل فتح البصمة مفعّل (إعداد + جهاز)؟
  unlockWithPin(pin: string): Promise<UnlockResult>; // فتح بـ PIN.
  unlockWithBiometric(promptMessage: string): Promise<UnlockResult>; // فتح بالبصمة.
}

export class AppSecurityRepository implements SecurityRepository {
  constructor(
    private readonly prefs: PreferencesSource, // تخزين الإعدادات.
    private readonly session: SessionRepository, // الجلسة (للتحقق من PIN).
  ) {}

  // يقرأ الإعدادات ويدمجها مع الافتراضية بأمان.
  async getSettings(): Promise<SecuritySettings> {
    try {
      const raw = await this.prefs.getString(STORAGE_KEYS.securitySettings);
      if (!raw) return normalizeSettings(null);
      return normalizeSettings(JSON.parse(raw) as Partial<SecuritySettings>);
    } catch (error) {
      logger.warn('Security settings read failed', { error: String(error) });
      return normalizeSettings(null);
    }
  }

  // يحفظ الإعدادات كاملة (كتابة ذرّية).
  async saveSettings(settings: SecuritySettings): Promise<void> {
    await this.prefs.setString(STORAGE_KEYS.securitySettings, JSON.stringify(settings));
  }

  // هل سجّل المستخدم بيانات اعتماد (PIN)؟
  async hasCredential(): Promise<boolean> {
    return this.session.hasCredential();
  }

  // هل البصمة متاحة ومفعّلة من إعدادات الجلسة؟
  async isBiometricEnabled(): Promise<boolean> {
    return this.session.getBiometricEnabled();
  }

  // فتح القفل بـ PIN (يتحقق عبر بصمة PIN المخزّنة في الخزنة الآمنة).
  async unlockWithPin(pin: string): Promise<UnlockResult> {
    const session = await this.session.verifyPin?.(pin);
    if (session) return { ok: true };
    return { ok: false, reason: 'wrong-pin' };
  }

  // فتح القفل بالبصمة/الوجه (يتطلب وجود جلسة وبصمة مفعّلة).
  async unlockWithBiometric(promptMessage: string): Promise<UnlockResult> {
    const [credential, biometricOn] = await Promise.all([this.hasCredential(), this.isBiometricEnabled()]);
    if (!credential) return { ok: false, reason: 'no-credential' };
    if (!biometricOn) return { ok: false, reason: 'unavailable' };
    const result = await promptBiometric(promptMessage, undefined);
    if (result.success) return { ok: true };
    // إلغاء المستخدم مقابل عدم الإتاحة.
    if (result.reason === 'user_cancel' || result.reason === 'system_cancel' || result.reason === 'app_cancel') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}
