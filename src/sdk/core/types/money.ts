/**
 * نوع المال في الـSDK — PHASE 31 · قسم 16.
 * ممنوع تمثيل المال برقم خام غير منظّم: كل مبلغ يحمل عملته معه.
 * الحساب الفعلي يتم في core/money (مصدر الحقيقة الحسابي منذ PHASE 01)،
 * وهذا الملف يضيف طبقة أنواع مغلقة (CurrencyCode) وأدوات آمنة تُعيد Result.
 */
import {
  addMoney as addRaw, // جمع مبلغين بنفس العملة.
  money as makeRaw, // إنشاء مبلغ مقرّب.
  multiplyMoney as multiplyRaw, // ضرب سعر × كمية.
  percentageOf as percentRaw, // نسبة مئوية من مبلغ.
  roundMoney, // تقريب آمن لخانتين.
  subtractMoney as subtractRaw, // طرح مبلغين.
  sumMoney as sumRaw, // جمع قائمة مبالغ.
  toMinorUnits as minorRaw, // تحويل للوحدات الصغرى.
  type Money as RawMoney, // شكل المال في النواة.
} from '@/core/money/money';
import { attempt, type Result } from '../result/result';

// العملات المدعومة رسميًا (قابلة للتوسّع دون كسر — قسم 16).
export const SUPPORTED_CURRENCIES = ['YER', 'USD', 'SAR', 'AED', 'EUR', 'GBP'] as const;

// كود العملة كنوع مغلق مشتق من القائمة أعلاه.
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

// مبلغ نقدي: قيمة + عملة (الشكل مطابق لنواة المال فيتبادلان مباشرة).
export interface Money {
  readonly amount: number; // القيمة العددية (بالوحدة الكبرى، مقرّبة لخانتين).
  readonly currency: CurrencyCode; // عملة المبلغ.
}

// القيمة العددية للمبلغ فقط (تُستخدم في العقود التي تُمرَّر فيها العملة منفصلة).
export type MoneyAmount = number;

// بيانات وصفية لكل عملة (رمز · عدد الخانات · مقام الوحدة الصغرى).
export interface CurrencyInfo {
  readonly code: CurrencyCode; // الكود.
  readonly symbolAr: string; // الرمز بالعربية.
  readonly symbolEn: string; // الرمز بالإنجليزية.
  readonly decimalDigits: number; // عدد الخانات العشرية للعرض.
  readonly minorUnitFactor: number; // مقام الوحدة الصغرى (100 = فلس/سنت).
}

// فهرس العملات المدعومة (للعرض والتحويل للوحدات الصغرى للبوابات).
export const CURRENCY_REGISTRY: Readonly<Record<CurrencyCode, CurrencyInfo>> = Object.freeze({
  YER: { code: 'YER', symbolAr: 'ر.ي', symbolEn: 'YER', decimalDigits: 0, minorUnitFactor: 100 },
  USD: { code: 'USD', symbolAr: '$', symbolEn: '$', decimalDigits: 2, minorUnitFactor: 100 },
  SAR: { code: 'SAR', symbolAr: 'ر.س', symbolEn: 'SAR', decimalDigits: 2, minorUnitFactor: 100 },
  AED: { code: 'AED', symbolAr: 'د.إ', symbolEn: 'AED', decimalDigits: 2, minorUnitFactor: 100 },
  EUR: { code: 'EUR', symbolAr: '€', symbolEn: '€', decimalDigits: 2, minorUnitFactor: 100 },
  GBP: { code: 'GBP', symbolAr: '£', symbolEn: '£', decimalDigits: 2, minorUnitFactor: 100 },
});

// حارس نوع: هل النص كود عملة مدعوم؟
export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);

// يحوّل نصًّا خامًا إلى كود عملة، مع الرجوع لعملة افتراضية عند عدم الدعم.
export const toCurrencyCode = (value: string, fallback: CurrencyCode = 'YER'): CurrencyCode =>
  isCurrencyCode(value) ? value : fallback;

// ينشئ مبلغًا (يرمي عند قيمة غير منتهية — يُستخدم داخل السياقات المضمونة).
export const money = (amount: number, currency: CurrencyCode): Money =>
  // نعيد استخدام نواة المال لضمان تقريب موحّد عبر التطبيق كله.
  makeRaw(amount, currency) as Money;

// ينشئ مبلغًا بأمان ويُعيد Result بدل رمي الاستثناء (قسم 06).
export const tryMoney = (amount: number, currency: CurrencyCode): Result<Money> =>
  attempt(() => money(amount, currency));

// مبلغ صفري بعملة محددة (نقطة بداية كل تجميع).
export const zeroMoney = (currency: CurrencyCode): Money => money(0, currency);

// يجمع مبلغين (يرمي عند اختلاف العملة — الحماية من الخلط النقدي).
export const addMoney = (left: Money, right: Money): Money => addRaw(left, right) as Money;

// يطرح مبلغين بنفس العملة.
export const subtractMoney = (left: Money, right: Money): Money => subtractRaw(left, right) as Money;

// يضرب سعر وحدة في كمية غير سالبة.
export const multiplyMoney = (unitPrice: Money, quantity: number): Money =>
  multiplyRaw(unitPrice, quantity) as Money;

// يحسب نسبة مئوية (0..100) من مبلغ.
export const percentageOf = (base: Money, ratePercent: number): Money =>
  percentRaw(base, ratePercent) as Money;

// يجمع قائمة مبالغ بعملة محددة (يبدأ من الصفر فيصحّ حتى مع قائمة فارغة).
export const sumMoney = (values: readonly Money[], currency: CurrencyCode): Money =>
  sumRaw(values as readonly RawMoney[], currency) as Money;

// يحوّل المبلغ للوحدات الصغرى (للبوابات التي تستقبل أعدادًا صحيحة).
export const toMinorUnits = (value: Money): number => minorRaw(value);

// يقارن مبلغين: سالب إن كان الأول أصغر، صفر عند التساوي، موجب إن كان أكبر.
export const compareMoney = (left: Money, right: Money): number => {
  // مقارنة مبالغ بعملتين مختلفتين خطأ منطقي؛ نرمي لكشفه فورًا في التطوير.
  if (left.currency !== right.currency) {
    throw new Error(`Currency mismatch: ${left.currency} vs ${right.currency}`);
  }
  // فرق مقرّب يتجنّب مشاكل الفاصلة العائمة.
  return roundMoney(left.amount - right.amount);
};

// هل المبلغان متساويان قيمة وعملة؟
export const moneyEquals = (left: Money, right: Money): boolean =>
  left.currency === right.currency && roundMoney(left.amount - right.amount) === 0;

// هل المبلغ صفر؟
export const isZeroMoney = (value: Money): boolean => value.amount === 0;

// هل المبلغ سالب؟ (يُستخدم في حراسات قواعد العمل).
export const isNegativeMoney = (value: Money): boolean => value.amount < 0;

// هل المبلغ موجب فعلًا (أكبر من صفر)؟
export const isPositiveMoney = (value: Money): boolean => value.amount > 0;

// يحوّل مبلغ النواة الخام (عملة كنص) إلى مبلغ SDK بعملة مغلقة النوع.
export const fromRawMoney = (value: RawMoney, fallback: CurrencyCode = 'YER'): Money =>
  money(value.amount, toCurrencyCode(value.currency, fallback));

// يحوّل مبلغ SDK إلى الشكل الخام لنواة المال (للطبقات القديمة).
export const toRawMoney = (value: Money): RawMoney => ({ amount: value.amount, currency: value.currency });
