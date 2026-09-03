/**
 * مصدر تخزين ملف إعداد المتجر (PHASE 09).
 * يخزّن الملف التعريفي JSON على الجهاز عبر واجهة نصية بسيطة (مثل التفضيلات).
 * لاحقًا يُستبدل بمصدر API دون تغيير المستودع.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { StoreSetupProfile } from '@/domain/setup/types';

// واجهة تخزين نصية (تُمرر من الطبقة الأعلى — نفس نمط متجر المتجر النشط).
export interface SetupProfileStore {
  getString(key: string): Promise<string | null>; // قراءة نص.
  setString(key: string, value: string): Promise<void>; // كتابة نص.
}

// واجهة المصدر.
export interface SetupSource {
  // قراءة الملف التعريفي المحفوظ (null إن لم يُحفظ بعد).
  getProfile(): Promise<StoreSetupProfile | null>;
  // حفظ الملف التعريفي.
  saveProfile(profile: StoreSetupProfile): Promise<void>;
}

// مصدر محلي فوق التفضيلات (AsyncStorage اليوم).
export class LocalSetupSource implements SetupSource {
  constructor(private readonly store: SetupProfileStore) {} // نستقبل المخزن النصي.

  async getProfile(): Promise<StoreSetupProfile | null> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.storeSetupProfile); // نقرأ JSON.
      if (!raw) return null; // لا شيء محفوظ.
      return JSON.parse(raw) as StoreSetupProfile; // نفك الترميز.
    } catch (error) {
      // ملف تالف → نسجّل ونعتبره غير موجود (لا نعطّل التطبيق).
      logger.warn('Failed to parse store setup profile', { error: String(error) });
      return null;
    }
  }

  async saveProfile(profile: StoreSetupProfile): Promise<void> {
    // نحفظ النص كـ JSON.
    await this.store.setString(STORAGE_KEYS.storeSetupProfile, JSON.stringify(profile));
  }
}
