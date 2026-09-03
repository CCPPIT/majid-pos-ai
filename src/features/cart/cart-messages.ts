/**
 * ترجمة أخطاء محرك السلة إلى مفاتيح i18n (PHASE 12).
 * طبقة المجال تُرمي ValidationError بسبب آلي؛ الواجهة تترجمه هنا لرسالة محلية.
 */
import type { CartErrorReason } from '@/domain/cart';

// سبب الخطأ ← مفتاح رسالة الترجمة.
const REASON_KEYS: Record<CartErrorReason, string> = {
  EMPTY_CART: 'cart.error.emptyCart', // سلة فارغة.
  LINE_NOT_FOUND: 'cart.error.lineNotFound', // بند غير موجود.
  EXCEEDS_STOCK: 'cart.error.exceedsStock', // تجاوز المخزون.
  INVALID_QUANTITY: 'cart.error.invalidQuantity', // كمية غير صالحة.
  INVALID_DISCOUNT: 'cart.error.invalidDiscount', // خصم غير صالح.
  CURRENCY_MISMATCH: 'cart.error.currencyMismatch', // اختلاف العملة.
};

// يُرجع مفتاح الترجمة لسبب خطأ.
export function cartErrorKey(reason: CartErrorReason): string {
  return REASON_KEYS[reason] ?? 'cart.error.invalidQuantity';
}
