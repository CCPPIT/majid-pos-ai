/**
 * محرّك حساب السلة — PHASE 31 · قسم 14.
 * حسابات حتمية بالكامل: نفس السلة تعطي نفس الإجماليات دائمًا، بلا وقت ولا
 * عشوائية ولا حالة خارجية. كل عملية نقدية تمر عبر نواة المال (لا جمع خام).
 *
 * القاعدة المحاسبية المطبَّقة:
 *   Subtotal (مجموع البنود)
 *   − Item Discounts (خصومات البنود)
 *   − Cart Discount (خصم السلة على المتبقي)
 *   = Net Total
 *   + Tax (تُضاف على غير الشامل · وتُستخرج من الشامل)
 *   = Total
 */
import {
  addMoney,
  money,
  multiplyMoney,
  percentageOf,
  subtractMoney,
  sumMoney,
  zeroMoney,
  type CurrencyCode,
  type Money,
} from '@/sdk/core';
import type { Cart, CartItem, CartTotals, Discount } from '../contracts/cart-contracts';

// يقرّب مبلغًا لخانتين بأمان (يمنع تراكم أخطاء الفاصلة العائمة).
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

// إجمالي بند قبل أي خصم (سعر الوحدة × الكمية).
export const lineSubtotal = (item: CartItem): Money => multiplyMoney(item.unitPrice, item.quantity);

/**
 * يحسب قيمة خصم ما على مبلغ أساس.
 * النسبة تُطبَّق كنسبة مئوية؛ المبلغ الثابت يُحصر بألا يتجاوز الأساس.
 */
export const discountAmount = (base: Money, discount?: Discount): Money => {
  // بلا خصم = صفر بنفس العملة.
  if (!discount) return zeroMoney(base.currency);
  // خصم نسبي: نسبة من الأساس (النسبة محصورة 0..100 في التحقق).
  if (discount.type === 'percentage') {
    // نحصر النسبة دفاعيًا حتى لو مرّت قيمة شاذة.
    const rate = Math.min(100, Math.max(0, discount.value));
    return percentageOf(base, rate);
  }
  // خصم ثابت: لا يتجاوز الأساس أبدًا (لا إجمالي سالب).
  return money(Math.min(Math.max(0, discount.value), base.amount), base.currency);
};

// إجمالي بند بعد خصمه الخاص.
export const lineTotalAfterDiscount = (item: CartItem): Money => {
  // الأساس قبل الخصم.
  const base = lineSubtotal(item);
  // قيمة خصم البند.
  const reduction = discountAmount(base, item.discount);
  // الفرق هو صافي البند.
  return subtractMoney(base, reduction);
};

/**
 * يحسب إجماليات السلة كاملة.
 * البنود الشاملة للضريبة تُستخرج ضريبتها من قيمتها؛ غير الشاملة تُضاف عليها.
 */
export const calculateTotals = (cart: Cart): CartTotals => {
  // عملة السلة (كل البنود بها).
  const currency: CurrencyCode = cart.currency;
  // سلة فارغة: إجماليات صفرية صريحة (لا قسمة على صفر ولا NaN).
  if (cart.items.length === 0) {
    // مبلغ صفري نعيد استخدامه في كل الحقول.
    const zero = zeroMoney(currency);
    return {
      itemCount: 0,
      totalQuantity: 0,
      subtotal: zero,
      itemDiscounts: zero,
      cartDiscount: zero,
      totalDiscount: zero,
      netTotal: zero,
      taxAmount: zero,
      total: zero,
      isEmpty: true,
    };
  }

  // (1) مجموع قيم البنود قبل أي خصم.
  const subtotal = sumMoney(cart.items.map(lineSubtotal), currency);
  // (2) مجموع خصومات البنود المنفردة.
  const itemDiscounts = sumMoney(
    cart.items.map((item) => discountAmount(lineSubtotal(item), item.discount)),
    currency,
  );
  // (3) المتبقي بعد خصومات البنود (أساس خصم السلة).
  const afterItemDiscounts = subtractMoney(subtotal, itemDiscounts);
  // (4) خصم السلة يُطبَّق على المتبقي لا على الإجمالي الأصلي (تفادي الخصم المزدوج).
  const cartDiscount = discountAmount(afterItemDiscounts, cart.discount);
  // (5) إجمالي كل الخصومات.
  const totalDiscount = addMoney(itemDiscounts, cartDiscount);
  // (6) الصافي بعد كل الخصومات.
  const netTotal = subtractMoney(afterItemDiscounts, cartDiscount);

  // (7) نوزّع الصافي على البنود بنسبة قيمتها الأصلية لحساب الضريبة بدقة.
  // مجموع قيم البنود الشاملة للضريبة (قبل الخصم).
  const inclusiveBase = sumMoney(
    cart.items.filter((item) => item.pricing.taxIncluded).map(lineSubtotal),
    currency,
  );
  // مجموع قيم البنود غير الشاملة (قبل الخصم).
  const exclusiveBase = sumMoney(
    cart.items.filter((item) => !item.pricing.taxIncluded).map(lineSubtotal),
    currency,
  );
  // مجموع الأساس الكلي (لحساب النسب).
  const totalBase = subtotal.amount;
  // نسبة كل قسم من الأساس (صفر عند سلة بقيمة صفرية).
  const inclusiveShare = totalBase === 0 ? 0 : inclusiveBase.amount / totalBase;
  const exclusiveShare = totalBase === 0 ? 0 : exclusiveBase.amount / totalBase;
  // صافي القسم الشامل بعد الخصم (يحوي ضريبة ضمنية).
  const inclusiveNet = money(round2(netTotal.amount * inclusiveShare), currency);
  // صافي القسم غير الشامل بعد الخصم (قبل إضافة الضريبة).
  const exclusiveNet = money(round2(netTotal.amount * exclusiveShare), currency);

  // (8) نسبة الضريبة المطبَّقة (من المتجر).
  const rate = Math.max(0, cart.taxRatePercent);
  // الضريبة المستخرجة من الشامل: net × rate ÷ (100 + rate).
  const inclusiveTax = rate > 0
    ? money(round2((inclusiveNet.amount * rate) / (100 + rate)), currency)
    : zeroMoney(currency);
  // الضريبة المضافة على غير الشامل: net × rate ÷ 100.
  const exclusiveTax = percentageOf(exclusiveNet, Math.min(100, rate));
  // إجمالي الضريبة (المستخرجة + المضافة) للعرض والإقرار الضريبي.
  const taxAmount = addMoney(inclusiveTax, exclusiveTax);

  // (9) الإجمالي النهائي: الشامل كما هو + غير الشامل + ضريبته.
  const total = addMoney(inclusiveNet, addMoney(exclusiveNet, exclusiveTax));

  // (10) عدّادات العرض.
  const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // نُعيد الإجماليات كاملة.
  return {
    itemCount: cart.items.length,
    totalQuantity,
    subtotal,
    itemDiscounts,
    cartDiscount,
    totalDiscount,
    netTotal,
    taxAmount,
    total,
    isEmpty: false,
  };
};

// مجموع الكميات في السلة (شارة العدّاد في الواجهة).
export const cartQuantity = (cart: Cart): number =>
  cart.items.reduce((sum, item) => sum + item.quantity, 0);

// هل السلة فارغة؟
export const isCartEmpty = (cart: Cart): boolean => cart.items.length === 0;
