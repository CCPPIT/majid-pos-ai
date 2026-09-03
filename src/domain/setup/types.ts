/**
 * أنواع معالج إعداد المتجر (PHASE 09).
 * الملف التعريفي (Profile) يجمع إجابات المعالج كاملة ويُحوَّل لاحقًا
 * إلى هرمية مستأجر (Tenant → Organization → Branch → Store).
 */
import type { ISODateString } from '@/core/types/domain';

// رموز أنواع النشاط التجاري المدعومة في المعالج.
export type BusinessTypeCode =
  | 'retail' // تجزئة عامة.
  | 'grocery' // بقالة/سوبر ماركت.
  | 'restaurant' // مطعم/مقهى.
  | 'pharmacy' // صيدلية.
  | 'electronics' // إلكترونيات.
  | 'fashion' // ألبسة/موضة.
  | 'services' // خدمات.
  | 'other'; // أخرى.

// رموز الدول المتاحة للاختيار (ISO-3166 alpha-2).
export type CountryCode = 'YE' | 'SA' | 'AE' | 'EG' | 'JO' | 'OTHER';

// رموز العملات المتاحة (ISO-4217).
export type CurrencyCode = 'YER' | 'SAR' | 'AED' | 'EGP' | 'USD';

// خيار اختيار عام (للـ Chips) — التسمية عبر مفتاح ترجمة (لا نصوص خام).
export interface SetupOption<T extends string = string> {
  value: T; // القيمة المخزنة.
  labelKey: string; // مفتاح الترجمة للاسم المعروض.
  icon?: string; // أيقونة اختيارية (Ionicons).
}

// الملف التعريفي الكامل لإعداد المتجر.
export interface StoreSetupProfile {
  businessName: string; // اسم العمل/السلسلة.
  businessType: BusinessTypeCode; // نوع النشاط.
  country: CountryCode; // الدولة.
  currency: CurrencyCode; // العملة.
  taxRatePercent: number; // نسبة الضريبة (0..100).
  branchName: string; // اسم الفرع الأول.
  branchCity: string; // مدينة الفرع.
  storeName: string; // اسم المتجر/نقطة البيع.
  storeCode: string; // كود المتجر (للإيصالات والكاشير).
  managerName: string; // اسم المدير/الموظف الأول (اختياري).
  completedAt: ISODateString; // لحظة إتمام الإعداد.
}

// معرّفات خطوات المعالج بالترتيب.
export type SetupStepId =
  | 'business' // خطوة العمل.
  | 'location' // خطوة الدولة/العملة.
  | 'tax' // خطوة الضريبة.
  | 'store' // خطوة الفرع/المتجر.
  | 'manager' // خطوة المدير.
  | 'review'; // خطوة المراجعة والإتمام.

// ترتيب الخطوات (ثابت).
export const SETUP_STEPS: SetupStepId[] = [
  'business', // 1) بيانات العمل.
  'location', // 2) الدولة والعملة.
  'tax', // 3) الضريبة.
  'store', // 4) الفرع والمتجر.
  'manager', // 5) المدير.
  'review', // 6) المراجعة.
];

// نتيجة تحقق خطوة: سليمة أم لا + رسالة الخطأ (مفتاح ترجمة).
export interface StepValidation {
  valid: boolean; // هل البيانات سليمة؟
  errorKey?: string; // مفتاح ترجمة رسالة الخطأ إن وُجد.
}

// بيانات خطوة لأغراض العرض (شريط التقدم).
export interface StepMeta {
  id: SetupStepId; // معرف الخطوة.
  titleKey: string; // مفتاح ترجمة عنوان الخطوة.
  icon: string; // أيقونة الخطوة.
}
