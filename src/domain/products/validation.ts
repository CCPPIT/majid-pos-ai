/**
 * تحقق نموذج المنتج (PHASE 16 — Products Management).
 * دوال نقية بلا آثار جانبية: تتحقق من حقول النموذج (الاسم/الباركود/السعر/الكمية)
 * وتُستخدم من الشاشة لتفعيل زر الحفظ ومن المستودع للحماية أيضًا.
 */
import { roundMoney } from '@/core/money/money';

// أقصى طول للباركود.
export const BARCODE_MAX_LENGTH = 20;

// حقول نموذج إنشاء/تعديل منتج.
export interface ProductDraft {
  nameAr: string; // الاسم بالعربية.
  nameEn: string; // الاسم بالإنجليزية (اختياري).
  barcode: string; // الباركود.
  sku: string; // رمز الصنف (اختياري — يُولّد إن تُرك).
  categoryId: string; // التصنيف.
  priceAmount: string; // السعر كنص (يُحوّل لرقم).
  currency: string; // العملة.
  taxIncluded: boolean; // السعر شامل الضريبة؟
  stockQuantity: string; // الكمية كنص.
  imageIcon?: string; // أيقونة (اختياري).
}

// نتيجة تحقق الحقل.
export interface FieldValidation {
  valid: boolean;
  errorKey?: string; // مفتاح رسالة الخطأ.
}

// طول الاسم الأقصى.
export const NAME_MAX = 80;
// أقل سعر مقبول.
export const PRICE_MIN = 0;
// أقصى كمية مخزون.
export const STOCK_MAX = 999999;

// تطبيع النص (إزالة فراغات البداية/النهاية).
function clean(v: string): string {
  return v.trim();
}

// تحقق الاسم العربي (إلزامي).
export function validateNameAr(name: string): FieldValidation {
  const value = clean(name);
  if (!value) return { valid: false, errorKey: 'products.error.nameRequired' };
  if (value.length > NAME_MAX) return { valid: false, errorKey: 'products.error.nameTooLong' };
  return { valid: true };
}

// تحقق الباركود (أرقام/أحرف، طول معقول، بدون فراغات).
export function validateBarcode(code: string): FieldValidation {
  const value = clean(code);
  if (!value) return { valid: false, errorKey: 'products.error.barcodeRequired' };
  if (value.length > BARCODE_MAX_LENGTH) return { valid: false, errorKey: 'products.error.barcodeTooLong' };
  if (/\s/.test(value)) return { valid: false, errorKey: 'products.error.barcodeNoSpaces' };
  return { valid: true };
}

// تحقق السعر (رقم موجب).
export function validatePrice(priceText: string): FieldValidation {
  const value = clean(priceText);
  if (!value) return { valid: false, errorKey: 'products.error.priceRequired' };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < PRICE_MIN) {
    return { valid: false, errorKey: 'products.error.priceInvalid' };
  }
  return { valid: true };
}

// تحقق الكمية (عدد صحيح غير سالب).
export function validateStock(stockText: string): FieldValidation {
  const value = clean(stockText);
  if (!value) return { valid: false, errorKey: 'products.error.stockRequired' };
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 0 || qty > STOCK_MAX || !Number.isInteger(qty)) {
    return { valid: false, errorKey: 'products.error.stockInvalid' };
  }
  return { valid: true };
}

// تحقق النموذج كاملًا.
export function validateDraft(draft: ProductDraft): FieldValidation {
  const checks = [
    validateNameAr(draft.nameAr),
    validateBarcode(draft.barcode),
    validatePrice(draft.priceAmount),
    validateStock(draft.stockQuantity),
  ];
  const firstFailure = checks.find((c) => !c.valid);
  return firstFailure ?? { valid: true };
}

// يحول النموذج إلى قيم منتج خام (سعر مرقّم وكمية).
export function draftValues(draft: ProductDraft): {
  priceAmount: number;
  stockQuantity: number;
  sku: string;
} {
  return {
    priceAmount: roundMoney(Number(clean(draft.priceAmount))),
    stockQuantity: Number(clean(draft.stockQuantity)),
    sku: clean(draft.sku) || `SKU-${clean(draft.barcode).slice(-5)}`,
  };
}
