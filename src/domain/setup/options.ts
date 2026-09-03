/**
 * قوائم الاختيار للمعالج (PHASE 09).
 * أنواع النشاط · الدول · العملات — القيم ثابتة والتسميات عبر مفاتيح ترجمة.
 */
import type { BusinessTypeCode, CountryCode, CurrencyCode, SetupOption } from './types';

// خيارات نوع النشاط التجاري (مع أيقونات).
export const BUSINESS_TYPE_OPTIONS: SetupOption<BusinessTypeCode>[] = [
  { value: 'retail', labelKey: 'setup.type.retail', icon: 'storefront-outline' }, // تجزئة.
  { value: 'grocery', labelKey: 'setup.type.grocery', icon: 'cart-outline' }, // بقالة.
  { value: 'restaurant', labelKey: 'setup.type.restaurant', icon: 'restaurant-outline' }, // مطعم/مقهى.
  { value: 'pharmacy', labelKey: 'setup.type.pharmacy', icon: 'medkit-outline' }, // صيدلية.
  { value: 'electronics', labelKey: 'setup.type.electronics', icon: 'phone-portrait-outline' }, // إلكترونيات.
  { value: 'fashion', labelKey: 'setup.type.fashion', icon: 'shirt-outline' }, // ألبسة.
  { value: 'services', labelKey: 'setup.type.services', icon: 'construct-outline' }, // خدمات.
  { value: 'other', labelKey: 'setup.type.other', icon: 'ellipsis-horizontal-circle-outline' }, // أخرى.
];

// خيارات الدول.
export const COUNTRY_OPTIONS: SetupOption<CountryCode>[] = [
  { value: 'YE', labelKey: 'setup.country.YE', icon: 'location-outline' }, // اليمن.
  { value: 'SA', labelKey: 'setup.country.SA', icon: 'location-outline' }, // السعودية.
  { value: 'AE', labelKey: 'setup.country.AE', icon: 'location-outline' }, // الإمارات.
  { value: 'EG', labelKey: 'setup.country.EG', icon: 'location-outline' }, // مصر.
  { value: 'JO', labelKey: 'setup.country.JO', icon: 'location-outline' }, // الأردن.
  { value: 'OTHER', labelKey: 'setup.country.OTHER', icon: 'globe-outline' }, // دولة أخرى.
];

// خيارات العملات (مع رموز العرض).
export const CURRENCY_OPTIONS: (SetupOption<CurrencyCode> & { symbol: string })[] = [
  { value: 'YER', labelKey: 'setup.currency.YER', symbol: 'ر.ي' }, // ريال يمني.
  { value: 'SAR', labelKey: 'setup.currency.SAR', symbol: 'ر.س' }, // ريال سعودي.
  { value: 'AED', labelKey: 'setup.currency.AED', symbol: 'د.إ' }, // درهم إماراتي.
  { value: 'EGP', labelKey: 'setup.currency.EGP', symbol: 'ج.م' }, // جنيه مصري.
  { value: 'USD', labelKey: 'setup.currency.USD', symbol: '$' }, // دولار.
];

// العملة الافتراضية المقترحة لكل دولة (اختيار مسبق ذكي).
export const DEFAULT_CURRENCY_BY_COUNTRY: Record<CountryCode, CurrencyCode> = {
  YE: 'YER', // اليمن → ريال يمني.
  SA: 'SAR', // السعودية → ريال سعودي.
  AE: 'AED', // الإمارات → درهم.
  EG: 'EGP', // مصر → جنيه.
  JO: 'USD', // الأردن → دولار (تسهيلًا للتجربة؛ دينار لاحقًا).
  OTHER: 'USD', // أخرى → دولار.
};

// نسبة الضريبة الافتراضية لكل دولة (%).
export const DEFAULT_TAX_BY_COUNTRY: Record<CountryCode, number> = {
  YE: 5, // اليمن: 5%.
  SA: 15, // السعودية: 15% VAT.
  AE: 5, // الإمارات: 5% VAT.
  EG: 14, // مصر: 14% VAT.
  JO: 16, // الأردن: 16%.
  OTHER: 5, // أخرى: 5%.
};

// حدود نسبة الضريبة المسموحة.
export const TAX_RATE_MIN = 0; // لا ضريبة حدًا أدنى.
export const TAX_RATE_MAX = 100; // 100% حدًا أقصى.

// الطول الأقصى للنصوص المدخلة.
export const NAME_MAX_LENGTH = 80; // اسم العمل/الفرع/المتجر.
export const CODE_MAX_LENGTH = 12; // كود المتجر.
