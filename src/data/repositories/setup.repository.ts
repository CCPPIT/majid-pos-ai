/**
 * مستودع إعداد المتجر (PHASE 09).
 * يقرأ/يحفظ الملف التعريفي ويبني منه هرمية المستأجر.
 * الواجهة ثابتة عند استبدال المصدر المحلي بخادم حقيقي.
 */
import type { ID } from '@/core/types/domain';
import { buildTenancyFromProfile, type BuiltTenancy } from '@/domain/setup/builder';
import { isProfileComplete } from '@/domain/setup/validation';
import type { StoreSetupProfile } from '@/domain/setup/types';
import type { SetupSource } from '../sources/setup.source';

// واجهة المستودع.
export interface SetupRepository {
  // هل أُكمل الإعداد سابقًا؟ (ملف صالح محفوظ).
  isSetupComplete(): Promise<boolean>;
  // قراءة الملف التعريفي المحفوظ.
  getProfile(): Promise<StoreSetupProfile | null>;
  // حفظ ملف مكتمل → يبني الهرمية ويعيد المتجر النشط.
  submitProfile(profile: StoreSetupProfile): Promise<BuiltTenancy>;
}

// التنفيذ المحلي.
export class AppSetupRepository implements SetupRepository {
  constructor(private readonly source: SetupSource) {} // نستقبل المصدر.

  async isSetupComplete(): Promise<boolean> {
    const profile = await this.source.getProfile(); // نقرأ المحفوظ.
    return profile !== null && isProfileComplete(profile); // مكتمل؟
  }

  getProfile(): Promise<StoreSetupProfile | null> {
    return this.source.getProfile();
  }

  async submitProfile(profile: StoreSetupProfile): Promise<BuiltTenancy> {
    // نرفض ملفًا ناقصًا (حماية طبقة بيانات أيضًا، لا الواجهة فقط).
    if (!isProfileComplete(profile)) {
      throw new Error('Store setup profile is incomplete');
    }
    // نبني الهرمية من الملف.
    const built = buildTenancyFromProfile(profile);
    // نحفظ الملف التعريفي.
    await this.source.saveProfile(profile);
    // نعيد الهرمية + المتجر النشط.
    return built;
  }
}

// مساعد: يستخرج معرف المتجر النشط من نتيجة البناء (لاستخدامه في التبديل).
export function activeStoreIdOf(built: BuiltTenancy): ID {
  return built.activeStoreId;
}
