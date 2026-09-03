/**
 * محرّك عمليات السلة — PHASE 31 · قسم 14.
 * كل دالة نقية: تستقبل سلة وتُعيد Result بسلة جديدة (لا تعديل في المكان).
 * قواعد العمل تُفرض هنا مرة واحدة، فلا تكرار في الشاشات ولا في الخدمات.
 */
import {
  BusinessRuleError,
  ValidationError,
  failure,
  success,
  systemClock,
  toCurrencyCode,
  type CartId,
  type CartItemId,
  type Clock,
  type CurrencyCode,
  type ProductId,
  type Result,
  type StoreId,
  type TenantId,
} from '@/sdk/core';
import type { Product } from '@/sdk/products';
import {
  CART_LIMITS,
  type Cart,
  type CartErrorReason,
  type CartItem,
  type Discount,
} from '../contracts/cart-contracts';
import { calculateTotals } from '../calculations/cart-calculator';

// عدّاد داخلي لتوليد معرّفات فريدة للسلال والبنود.
let sequence = 0;

// يولّد معرّفًا فريدًا ببادئة محددة.
const nextId = (prefix: string, clock: Clock): string => {
  // نزيد العدّاد مع لفّه.
  sequence = (sequence + 1) % 1_000_000;
  // نركّبه من البادئة والطابع الزمني والعدّاد.
  return `${prefix}-${clock.timestamp().toString(36)}-${sequence.toString(36)}`;
};

// يبني خطأ قاعدة سلة يحمل سببه المُصنَّف (تترجمه الواجهة).
const cartError = (reason: CartErrorReason): BusinessRuleError =>
  new BusinessRuleError(`sdk.cart.error.${reason}`, { details: { reason } });

// ينشئ سلة فارغة جديدة.
export const createCart = (input: {
  readonly currency: CurrencyCode; // عملة السلة.
  readonly taxRatePercent: number; // نسبة ضريبة المتجر.
  readonly storeId?: StoreId; // المتجر النشط.
  readonly tenantId?: TenantId; // المستأجر.
  readonly clock?: Clock; // ساعة قابلة للحقن (اختبارات حتمية).
}): Cart => {
  // الساعة المستخدمة (الحقيقية افتراضيًا).
  const clock = input.clock ?? systemClock;
  // لحظة الإنشاء.
  const now = clock.now();
  // سلة جديدة بلا بنود.
  return {
    id: nextId('cart', clock) as CartId,
    tenantId: input.tenantId,
    storeId: input.storeId,
    currency: input.currency,
    items: [],
    taxRatePercent: Math.max(0, input.taxRatePercent),
    createdAt: now,
    updatedAt: now,
  };
};

// يجد بندًا بمعرّف المنتج.
export const findItem = (cart: Cart, productId: ProductId): CartItem | undefined =>
  cart.items.find((item) => String(item.productId) === String(productId));

// يبني بند سلة من منتج (لقطة سعر ثابتة لحظة الإضافة).
export const createCartItem = (
  product: Product,
  quantity: number,
  clock: Clock = systemClock,
): CartItem => ({
  // معرّف البند داخل السلة.
  id: nextId('item', clock) as CartItemId,
  productId: product.id,
  sku: product.sku,
  nameAr: product.nameAr,
  nameEn: product.nameEn,
  quantity,
  // سعر الوحدة من الكتالوج لحظة الإضافة.
  unitPrice: product.price.amount,
  // لقطة التسعير المحفوظة (لا تتأثر بتغيّر الكتالوج لاحقًا).
  pricing: {
    unitPrice: product.price.amount,
    capturedAt: clock.now(),
    taxIncluded: product.price.taxIncluded,
  },
  // أقصى كمية = الرصيد المتاح.
  maxQuantity: product.stock.quantity,
});

/**
 * يضيف منتجًا للسلة (أو يزيد كميته إن كان موجودًا).
 * يفرض: تطابق العملة · نشاط المنتج · الرصيد · حدود الكمية والبنود.
 */
export const addItem = (
  cart: Cart,
  product: Product,
  quantity = 1,
  clock: Clock = systemClock,
): Result<Cart> => {
  // (1) كمية صالحة (عدد صحيح موجب ضمن الحد).
  if (!Number.isInteger(quantity) || quantity < CART_LIMITS.MIN_QUANTITY) {
    return failure(cartError('INVALID_QUANTITY'));
  }
  // (2) المنتج غير النشط لا يُباع.
  if (!product.active) return failure(cartError('PRODUCT_INACTIVE'));
  // (3) تطابق العملة مع السلة (لا خلط عملات في فاتورة واحدة).
  if (toCurrencyCode(product.price.amount.currency) !== cart.currency) {
    return failure(cartError('CURRENCY_MISMATCH'));
  }
  // (4) البند القائم إن وُجد.
  const existing = findItem(cart, product.id);
  // (5) الكمية الإجمالية بعد الإضافة.
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  // (6) حدّ الكمية الأقصى للبند.
  if (nextQuantity > CART_LIMITS.MAX_QUANTITY) return failure(cartError('INVALID_QUANTITY'));
  // (7) الرصيد المتاح (رصيد صفر يعني نافد؛ رصيد موجب يُحترم كسقف).
  if (product.stock.quantity <= 0) return failure(cartError('EXCEEDS_STOCK'));
  if (nextQuantity > product.stock.quantity) return failure(cartError('EXCEEDS_STOCK'));
  // (8) حدّ عدد البنود عند إضافة بند جديد.
  if (!existing && cart.items.length >= CART_LIMITS.MAX_ITEMS) {
    return failure(new BusinessRuleError('sdk.cart.error.TOO_MANY_ITEMS'));
  }
  // (9) نبني قائمة البنود الجديدة (تحديث أو إضافة).
  const items = existing
    ? cart.items.map((item) =>
        String(item.productId) === String(product.id) ? { ...item, quantity: nextQuantity } : item,
      )
    : [...cart.items, createCartItem(product, nextQuantity, clock)];
  // (10) سلة جديدة بلحظة تحديث محدّثة.
  return success({ ...cart, items, updatedAt: clock.now() });
};

// يزيل بندًا كاملًا من السلة.
export const removeItem = (cart: Cart, productId: ProductId, clock: Clock = systemClock): Result<Cart> => {
  // البند غير الموجود خطأ صريح (لا تجاهل صامت).
  if (!findItem(cart, productId)) return failure(cartError('ITEM_NOT_FOUND'));
  // نُبقي كل البنود عدا المستهدف.
  const items = cart.items.filter((item) => String(item.productId) !== String(productId));
  // سلة جديدة.
  return success({ ...cart, items, updatedAt: clock.now() });
};

// يعيّن كمية بند مباشرة (صفر أو أقل يزيل البند).
export const updateQuantity = (
  cart: Cart,
  productId: ProductId,
  quantity: number,
  clock: Clock = systemClock,
): Result<Cart> => {
  // البند المستهدف.
  const existing = findItem(cart, productId);
  // غيابه خطأ.
  if (!existing) return failure(cartError('ITEM_NOT_FOUND'));
  // كمية صفر أو أقل = إزالة.
  if (quantity <= 0) return removeItem(cart, productId, clock);
  // كمية غير صحيحة أو تتجاوز الحد.
  if (!Number.isInteger(quantity) || quantity > CART_LIMITS.MAX_QUANTITY) {
    return failure(cartError('INVALID_QUANTITY'));
  }
  // تجاوز الرصيد المتاح.
  if (existing.maxQuantity > 0 && quantity > existing.maxQuantity) {
    return failure(cartError('EXCEEDS_STOCK'));
  }
  // نحدّث كمية البند فقط.
  const items = cart.items.map((item) =>
    String(item.productId) === String(productId) ? { ...item, quantity } : item,
  );
  // سلة جديدة.
  return success({ ...cart, items, updatedAt: clock.now() });
};

// يتحقق من صلاحية قيمة خصم قبل تطبيقه.
const validateDiscount = (discount: Discount): Result<Discount> => {
  // قيمة غير رقمية أو سالبة مرفوضة.
  if (!Number.isFinite(discount.value) || discount.value < 0) {
    return failure(new ValidationError('sdk.cart.error.INVALID_DISCOUNT', { value: 'sdk.validation.discount' }));
  }
  // النسبة يجب ألا تتجاوز 100%.
  if (discount.type === 'percentage' && discount.value > CART_LIMITS.MAX_DISCOUNT_PERCENT) {
    return failure(new ValidationError('sdk.cart.error.INVALID_DISCOUNT', { value: 'sdk.validation.discountMax' }));
  }
  // الخصم صالح.
  return success(discount);
};

/**
 * يطبّق خصمًا على السلة كاملة أو على بند محدد.
 * الخصم الثابت الذي يتجاوز الإجمالي يُرفض صراحةً (لا إجمالي سالب).
 */
export const applyDiscount = (
  cart: Cart,
  discount: Discount,
  productId?: ProductId,
  clock: Clock = systemClock,
): Result<Cart> => {
  // (1) تحقّق شكل الخصم.
  const validated = validateDiscount(discount);
  if (!validated.success) return validated;
  // (2) خصم على بند محدد.
  if (productId !== undefined) {
    // البند المستهدف.
    const existing = findItem(cart, productId);
    // غيابه خطأ.
    if (!existing) return failure(cartError('ITEM_NOT_FOUND'));
    // الخصم الثابت لا يتجاوز قيمة البند.
    if (discount.type === 'fixed' && discount.value > existing.unitPrice.amount * existing.quantity) {
      return failure(cartError('DISCOUNT_EXCEEDS_TOTAL'));
    }
    // نطبّق الخصم على البند فقط.
    const items = cart.items.map((item) =>
      String(item.productId) === String(productId) ? { ...item, discount } : item,
    );
    return success({ ...cart, items, updatedAt: clock.now() });
  }
  // (3) خصم على السلة: نتحقق ألا يتجاوز الإجمالي الحالي.
  if (discount.type === 'fixed') {
    // نحسب الإجماليات الحالية لمعرفة الأساس.
    const totals = calculateTotals(cart);
    // خصم يتجاوز المجموع مرفوض.
    if (discount.value > totals.subtotal.amount) return failure(cartError('DISCOUNT_EXCEEDS_TOTAL'));
  }
  // نطبّق الخصم على مستوى السلة.
  return success({ ...cart, discount, updatedAt: clock.now() });
};

// يزيل الخصم من السلة أو من بند محدد.
export const removeDiscount = (
  cart: Cart,
  productId?: ProductId,
  clock: Clock = systemClock,
): Result<Cart> => {
  // إزالة خصم بند محدد.
  if (productId !== undefined) {
    // البند المستهدف.
    if (!findItem(cart, productId)) return failure(cartError('ITEM_NOT_FOUND'));
    // نحذف حقل الخصم من البند.
    const items = cart.items.map((item) =>
      String(item.productId) === String(productId) ? { ...item, discount: undefined } : item,
    );
    return success({ ...cart, items, updatedAt: clock.now() });
  }
  // إزالة خصم السلة العام.
  return success({ ...cart, discount: undefined, updatedAt: clock.now() });
};

// يفرّغ السلة مع الحفاظ على هويتها وإعداداتها (بعد إتمام البيع).
export const clearCart = (cart: Cart, clock: Clock = systemClock): Cart => ({
  ...cart,
  // بلا بنود ولا خصم.
  items: [],
  discount: undefined,
  updatedAt: clock.now(),
});
