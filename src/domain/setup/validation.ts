/**
 * منطق التحقق لخطوات معالج إعداد المتجر (PHASE 09).
 * دوال نقية بلا آثار جانبية — تُختبر بسهولة وتستخدمها الواجهة لتفعيل/تعطيل الأزرار.
 */
import { CODE_MAX_LENGTH, NAME_MAX_LENGTH, TAX_RATE_MAX, TAX_RATE_MIN } from './options';
import type { BusinessTypeCode, CountryCode, CurrencyCode, SetupStepId, StepValidation, StoreSetupProfile } from './types';

// نصّ مقصوص من مدخل المستخدم (إزالة فراغات البداية/النهاية).
function cleanText(value: string): string {
  return value.trim();
}

// اسم نصي صالح: غير فارغ ولا يتجاوز الحد.
export function isValidName(value: string): boolean {
  const name = cleanText(value);
  return name.length > 0 && name.length <= NAME_MAX_LENGTH;
}

// كود متجر صالح: أحرف/أرقام/شرطة فقط، ضمن الحد، بدون فراغات.
export function isValidStoreCode(value: string): boolean {
  const code = cleanText(value).toUpperCase();
  if (code.length === 0 || code.length > CODE_MAX_LENGTH) return false; // الطول.
  return /^[A-Z0-9-]+$/.test(code); // أحرف لاتينية/أرقام/شرطة فقط.
}

// نسبة ضريبة صالحة: رقم ضمن الحدود.
export function isValidTaxRate(value: number): boolean {
  return Number.isFinite(value) && value >= TAX_RATE_MIN && value <= TAX_RATE_MAX;
}

// تحقق خطوة "العمل" (الاسم + النوع).
export function validateBusinessStep(input: {
  businessName: string;
  businessType: BusinessTypeCode | null;
}): StepValidation {
  if (!isValidName(input.businessName)) {
    return { valid: false, errorKey: 'setup.error.businessNameRequired' }; // الاسم مطلوب.
  }
  if (!input.businessType) {
    return { valid: false, errorKey: 'setup.error.businessTypeRequired' }; // النوع مطلوب.
  }
  return { valid: true };
}

// تحقق خطوة "الدولة/العملة".
export function validateLocationStep(input: {
  country: CountryCode | null;
  currency: CurrencyCode | null;
}): StepValidation {
  if (!input.country) {
    return { valid: false, errorKey: 'setup.error.countryRequired' }; // الدولة مطلوبة.
  }
  if (!input.currency) {
    return { valid: false, errorKey: 'setup.error.currencyRequired' }; // العملة مطلوبة.
  }
  return { valid: true };
}

// تحقق خطوة "الضريبة".
export function validateTaxStep(input: { taxRatePercent: number | null }): StepValidation {
  if (input.taxRatePercent === null || !isValidTaxRate(input.taxRatePercent)) {
    return { valid: false, errorKey: 'setup.error.taxRateInvalid' }; // نسبة غير صالحة.
  }
  return { valid: true };
}

// تحقق خطوة "الفرع/المتجر".
export function validateStoreStep(input: {
  branchName: string;
  branchCity: string;
  storeName: string;
  storeCode: string;
}): StepValidation {
  if (!isValidName(input.branchName)) {
    return { valid: false, errorKey: 'setup.error.branchNameRequired' }; // اسم الفرع مطلوب.
  }
  if (!isValidName(input.branchCity)) {
    return { valid: false, errorKey: 'setup.error.branchCityRequired' }; // المدينة مطلوبة.
  }
  if (!isValidName(input.storeName)) {
    return { valid: false, errorKey: 'setup.error.storeNameRequired' }; // اسم المتجر مطلوب.
  }
  if (!isValidStoreCode(input.storeCode)) {
    return { valid: false, errorKey: 'setup.error.storeCodeInvalid' }; // كود المتجر غير صالح.
  }
  return { valid: true };
}

// هل الملف التعريفي مكتمل وجاهز للحفظ؟ (كل الحقول الإلزامية).
export function isProfileComplete(profile: Partial<StoreSetupProfile>): profile is StoreSetupProfile {
  // المدير اختياري؛ الباقي إلزامي.
  return Boolean(
    profile.businessName &&
      profile.businessType &&
      profile.country &&
      profile.currency &&
      typeof profile.taxRatePercent === 'number' &&
      isValidTaxRate(profile.taxRatePercent) &&
      profile.branchName &&
      profile.branchCity &&
      profile.storeName &&
      profile.storeCode &&
      isValidStoreCode(profile.storeCode),
  );
}

// تحقق خطوة حسب المعرف — يسهّل على الواجهة استدعاءً موحدًا.
export function validateStep(step: SetupStepId, draft: Partial<StoreSetupProfile>): StepValidation {
  switch (step) {
    case 'business': // خطوة العمل.
      return validateBusinessStep({
        businessName: draft.businessName ?? '',
        businessType: draft.businessType ?? null,
      });
    case 'location': // خطوة الدولة.
      return validateLocationStep({
        country: draft.country ?? null,
        currency: draft.currency ?? null,
      });
    case 'tax': // خطوة الضريبة.
      return validateTaxStep({
        taxRatePercent: draft.taxRatePercent ?? null,
      });
    case 'store': // خطوة المتجر.
      return validateStoreStep({
        branchName: draft.branchName ?? '',
        branchCity: draft.branchCity ?? '',
        storeName: draft.storeName ?? '',
        storeCode: draft.storeCode ?? '',
      });
    case 'manager': // المدير اختياري → الخطوة دائمًا سليمة.
      return { valid: true };
    case 'review': // المراجعة سليمة فقط باكتمال الملف.
      return { valid: isProfileComplete(draft) };
    default:
      return { valid: false };
  }
}
