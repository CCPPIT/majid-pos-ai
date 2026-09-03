/**
 * محرك السلة النقي (PHASE 12 — Cart Engine).
 * كل الدوال بلا آثار جانبية: تستقبل Cart وتُعيد Cart جديدة (Immutable).
 * الحسابات النقدية تمر حصريًا عبر core/money (لا جمع floating خام).
 * يُرمى ValidationError عند خرق قاعدة عمل؛ الواجهة تترجمه لرسالة محلية.
 */
import { ValidationError } from '@/core/errors/AppError';
import { asId, type ID } from '@/core/types/domain';
import {
  addMoney, // جمع مبلغين.
  money, // إنشاء مبلغ.
  multiplyMoney, // ضرب سعر × كمية.
  percentageOf, // نسبة من مبلغ.
  roundMoney, // تقريب آمن لخانتين.
  subtractMoney, // طرح مبلغين.
  sumMoney, // جمع قائمة مبالغ.
  type Money, // كائن المال.
} from '@/core/money/money';
import type { Product } from '@/domain/products/types';
import type { Cart, CartErrorReason, CartLine, CartTotals } from './types';

// حد أدنى للكمية وأقصى نسبة خصم (قواعد مشتركة).
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 999;
export const MAX_DISCOUNT_PERCENT = 100;

// سلة فارغة جديدة بعملة محددة.
export function emptyCart(currency: string, storeId?: ID, now: string = new Date().toISOString()): Cart {
  return {
    id: `cart-${Date.now()}`, // معرف فريد (يُستبدل بخادم لاحقًا).
    storeId,
    currency,
    lines: [],
    discountPercent: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// إنشاء بند سلة من منتج (لقطة السعر لحظة البيع).
export function createLine(product: Product, quantity: number = 1): CartLine {
  if (quantity < MIN_QUANTITY || quantity > MAX_QUANTITY || !Number.isFinite(quantity)) {
    throw new ValidationError('Invalid cart quantity', { reason: 'INVALID_QUANTITY' as CartErrorReason });
  }
  return {
    productId: product.id,
    sku: product.sku,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    unitPrice: money(product.price.amount, product.price.currency),
    taxIncluded: product.taxIncluded,
    quantity,
    maxStock: product.stockQuantity,
  };
}

// يجد بندًا بمعرف المنتج (أو undefined).
export function findLine(cart: Cart, productId: ID): CartLine | undefined {
  return cart.lines.find((line) => String(line.productId) === String(productId));
}

// إضافة منتج للسلة (يزيد الكمية إن وُجد البند) — يفحص المخزون.
export function addItem(cart: Cart, product: Product, quantity: number = 1): Cart {
  // فحص عملة المنتج مقابل عملة السلة.
  if (product.price.currency !== cart.currency) {
    throw new ValidationError('Cart currency mismatch', { reason: 'CURRENCY_MISMATCH' as CartErrorReason });
  }
  const existing = findLine(cart, product.id);
  // الكمية الإجمالية بعد الإضافة.
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  // لا نتجاوز المخزون المتاح (إن كان محدودًا).
  const available = product.stockQuantity;
  if (available > 0 && nextQuantity > available) {
    throw new ValidationError('Quantity exceeds available stock', { reason: 'EXCEEDS_STOCK' as CartErrorReason });
  }
  if (nextQuantity > MAX_QUANTITY) {
    throw new ValidationError('Quantity exceeds maximum', { reason: 'INVALID_QUANTITY' as CartErrorReason });
  }
  // نبني قائمة البنود الجديدة.
  const lines = existing
    ? cart.lines.map((line) =>
        String(line.productId) === String(product.id) ? { ...line, quantity: nextQuantity } : line,
      )
    : [...cart.lines, createLine(product, nextQuantity)];
  return { ...cart, lines, updatedAt: new Date().toISOString() };
}

// تعيين كمية بند مباشرة (مع فحص المخزون والحدود).
export function setQuantity(cart: Cart, productId: ID, quantity: number): Cart {
  const existing = findLine(cart, productId);
  if (!existing) {
    throw new ValidationError('Cart line not found', { reason: 'LINE_NOT_FOUND' as CartErrorReason });
  }
  // كمية صفر أو أقل تعني إزالة البند.
  if (quantity <= 0) return removeItem(cart, productId);
  if (quantity > MAX_QUANTITY || !Number.isFinite(quantity)) {
    throw new ValidationError('Invalid quantity', { reason: 'INVALID_QUANTITY' as CartErrorReason });
  }
  if (existing.maxStock > 0 && quantity > existing.maxStock) {
    throw new ValidationError('Quantity exceeds stock', { reason: 'EXCEEDS_STOCK' as CartErrorReason });
  }
  return {
    ...cart,
    lines: cart.lines.map((line) =>
      String(line.productId) === String(productId) ? { ...line, quantity } : line,
    ),
    updatedAt: new Date().toISOString(),
  };
}

// زيادة كمية بند بمقدار (1 افتراضيًا).
export function incrementItem(cart: Cart, productId: ID, by: number = 1): Cart {
  const existing = findLine(cart, productId);
  if (!existing) throw new ValidationError('Cart line not found', { reason: 'LINE_NOT_FOUND' as CartErrorReason });
  return setQuantity(cart, productId, existing.quantity + by);
}

// إنقاص كمية بند (يُزال عند الوصول لصفر).
export function decrementItem(cart: Cart, productId: ID, by: number = 1): Cart {
  const existing = findLine(cart, productId);
  if (!existing) throw new ValidationError('Cart line not found', { reason: 'LINE_NOT_FOUND' as CartErrorReason });
  return setQuantity(cart, productId, existing.quantity - by);
}

// إزالة بند كاملًا.
export function removeItem(cart: Cart, productId: ID): Cart {
  return {
    ...cart,
    lines: cart.lines.filter((line) => String(line.productId) !== String(productId)),
    updatedAt: new Date().toISOString(),
  };
}

// تعيين نسبة الخصم الإجمالي (0..100).
export function setDiscount(cart: Cart, discountPercent: number): Cart {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > MAX_DISCOUNT_PERCENT) {
    throw new ValidationError('Invalid discount percent', { reason: 'INVALID_DISCOUNT' as CartErrorReason });
  }
  return { ...cart, discountPercent, updatedAt: new Date().toISOString() };
}

// تصفير السلة بالكامل (بعد البيع).
export function clearCart(cart: Cart): Cart {
  return emptyCart(cart.currency, cart.storeId);
}

// القيمة الإجمالية لبند (سعر × كمية).
export function lineTotal(line: CartLine): Money {
  return multiplyMoney(line.unitPrice, line.quantity);
}

// هل السلة فارغة؟
export function isCartEmpty(cart: Cart): boolean {
  return cart.lines.length === 0;
}

// مجموع الكميات في السلة (شارة البطاقة السفلية).
export function totalQuantity(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * حساب إجماليات السلة بدقة (قسم 56).
 * القاعدة:
 *  - البنود شاملة الضريبة: إجماليها شامل؛ نستخرج الضريبة منها بعد الخصم.
 *  - البنود غير الشاملة: إجماليها صافٍ؛ نضيف الضريبة عليه بعد الخصم.
 * الناتج النهائي: الإجمالي = بنود شاملة بعد الخصم + بنود غير شاملة بعد الخصم والضريبة.
 */
export function computeTotals(cart: Cart, taxRatePercent: number): CartTotals {
  const ccy = cart.currency;

  // نقسّم البنود حسب شمول الضريبة.
  const includedLines = cart.lines.filter((l) => l.taxIncluded);
  const excludedLines = cart.lines.filter((l) => !l.taxIncluded);

  // مجموع كل قيمة البنود كما هي.
  const grossIncluded = sumMoney(includedLines.map(lineTotal), ccy);
  const grossExcluded = sumMoney(excludedLines.map(lineTotal), ccy);

  // الخصم يُوزّع نسبيًا على مجموع القيم (قاعدة موحدة): نحسب نسبة الخصم من الإجمالي العام.
  const grossTotal = addMoney(grossIncluded, grossExcluded);
  const discount = percentageOf(grossTotal, cart.discountPercent);
  const netAfterDiscount = subtractMoney(grossTotal, discount);

  // حصة كل قسم بعد الخصم (نسبة من قيمته للقيمة الإجمالية) — نحسبها بالمبالغ مباشرة.
  // بعد الخصم، تبقى القيمة الشاملة والصافية بنفس نسب القيم الأصلية:
  const grossTotalAmount = grossTotal.amount || 0;
  const shareRatio = (part: Money): number =>
    grossTotalAmount === 0 ? 0 : part.amount / grossTotalAmount;
  // صافي الشامل بعد الخصم (يحوي ضريبة ضمنية) — تقريب آمن عبر roundMoney.
  const includedNet = money(roundMoney(netAfterDiscount.amount * shareRatio(grossIncluded)), ccy);
  // صافي غير الشامل بعد الخصم (قبل الضريبة).
  const excludedNet = money(roundMoney(netAfterDiscount.amount * shareRatio(grossExcluded)), ccy);

  // الضريبة المستخرجة من الشامل: (الصافي × النسبة) / (100 + النسبة).
  const includedTaxAmount = taxRatePercent > 0
    ? money(roundMoney((includedNet.amount * taxRatePercent) / (100 + taxRatePercent)), ccy)
    : money(0, ccy);
  // الضريبة المضافة على غير الشامل.
  const excludedTaxAmount = percentageOf(excludedNet, taxRatePercent);

  // الضريبة الكلية والإجمالي النهائي.
  const taxAmount = addMoney(includedTaxAmount, excludedTaxAmount);
  // النهائي: الشامل (لا يضاف عليه ضريبة) + الصافي + ضريبة غير الشامل.
  const total = addMoney(includedNet, addMoney(excludedNet, excludedTaxAmount));

  return {
    lineCount: cart.lines.length,
    totalQuantity: totalQuantity(cart),
    subtotal: grossTotal,
    discount,
    netTotal: netAfterDiscount,
    taxAmount,
    total,
    isEmpty: cart.lines.length === 0,
  };
}

// ثابت يحوّل كود المنتج إلى معرف بنمط ID (للاستخدام الداخلي).
export function productRef(product: Product): ID {
  return asId(String(product.id));
}
