/**
 * اختبارات محرّك السلة — PHASE 31 · قسم 59.
 * تركّز على الحتمية: نفس المدخلات تُنتج نفس الإجماليات دائمًا،
 * وعلى قواعد العمل التي تمنع الحالات المستحيلة (رصيد سالب، خصم يتجاوز الإجمالي).
 */
import {
  addItem,
  applyDiscount,
  calculateTotals,
  clearCart,
  createCart,
  discountAmount,
  isCartEmpty,
  lineSubtotal,
  removeDiscount,
  removeItem,
  updateQuantity,
  type Cart,
} from '@/sdk/cart';
import { money, toCurrencyCode } from '@/sdk/core';
import { fixedClock, makeSDKProduct } from '../../helpers/sdk-mocks';

// العملة المستخدمة في كل الاختبارات.
const YER = toCurrencyCode('YER');
// ساعة ثابتة تجعل النتائج حتمية.
const clock = fixedClock();

// يبني سلة فارغة بنسبة ضريبة محددة.
const emptyCart = (taxRatePercent = 0): Cart =>
  createCart({ currency: YER, taxRatePercent, clock });

// يبني سلة فيها منتج واحد بكمية محددة (يفشل الاختبار إن رفض المحرّك الإضافة).
const cartWith = (quantity: number, taxRatePercent = 0, price = 1000, taxIncluded = false): Cart => {
  // منتج بسعر وحالة ضريبة محددين.
  const product = makeSDKProduct({
    price: { amount: money(price, YER), taxIncluded },
  });
  // نضيفه للسلة.
  const result = addItem(emptyCart(taxRatePercent), product, quantity, clock);
  // الإضافة يجب أن تنجح في بيانات الاختبار.
  if (!result.success) throw new Error('فشلت تهيئة سلة الاختبار');
  return result.data;
};

describe('SDK Cart — الإضافة والإزالة', () => {
  // الإضافة تنشئ بندًا جديدًا.
  it('يضيف منتجًا للسلة', () => {
    const cart = cartWith(2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
  });

  // إضافة نفس المنتج تزيد الكمية بدل تكرار البند.
  it('يزيد كمية البند القائم بدل تكراره', () => {
    const product = makeSDKProduct();
    const first = addItem(emptyCart(), product, 2, clock);
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = addItem(first.data, product, 3, clock);
    expect(second.success).toBe(true);
    if (!second.success) return;
    // بند واحد بكمية مجمّعة.
    expect(second.data.items).toHaveLength(1);
    expect(second.data.items[0]?.quantity).toBe(5);
  });

  // المحرّك نقي: لا يعدّل السلة الأصلية.
  it('لا يعدّل السلة الأصلية (ثبات)', () => {
    const cart = emptyCart();
    addItem(cart, makeSDKProduct(), 1, clock);
    // السلة الأصلية ما زالت فارغة.
    expect(cart.items).toHaveLength(0);
  });

  // الرصيد سقف لا يُتجاوز.
  it('يرفض تجاوز الرصيد المتاح', () => {
    const product = makeSDKProduct({ stock: { quantity: 3, status: 'in_stock', lowStockThreshold: 10 } });
    const result = addItem(emptyCart(), product, 5, clock);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('EXCEEDS_STOCK');
  });

  // المنتج النافد لا يُضاف.
  it('يرفض المنتج النافد', () => {
    const product = makeSDKProduct({ stock: { quantity: 0, status: 'out_of_stock', lowStockThreshold: 10 } });
    expect(addItem(emptyCart(), product, 1, clock).success).toBe(false);
  });

  // المنتج المعطّل لا يُباع.
  it('يرفض المنتج غير النشط', () => {
    const product = makeSDKProduct({ active: false });
    const result = addItem(emptyCart(), product, 1, clock);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('PRODUCT_INACTIVE');
  });

  // خلط العملات ممنوع في فاتورة واحدة.
  it('يرفض منتجًا بعملة مختلفة عن السلة', () => {
    const product = makeSDKProduct({
      price: { amount: money(10, toCurrencyCode('USD')), taxIncluded: false },
    });
    const result = addItem(emptyCart(), product, 1, clock);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('CURRENCY_MISMATCH');
  });

  // الكمية غير الصحيحة مرفوضة.
  it('يرفض الكميات غير الصالحة', () => {
    expect(addItem(emptyCart(), makeSDKProduct(), 0, clock).success).toBe(false);
    expect(addItem(emptyCart(), makeSDKProduct(), -1, clock).success).toBe(false);
    expect(addItem(emptyCart(), makeSDKProduct(), 1.5, clock).success).toBe(false);
  });

  // الإزالة تحذف البند.
  it('يزيل بندًا من السلة', () => {
    const cart = cartWith(2);
    const productId = cart.items[0]?.productId;
    expect(productId).toBeDefined();
    if (!productId) return;
    const result = removeItem(cart, productId, clock);
    expect(result.success).toBe(true);
    if (result.success) expect(isCartEmpty(result.data)).toBe(true);
  });

  // إزالة غير الموجود خطأ صريح لا تجاهل صامت.
  it('يرفض إزالة بند غير موجود', () => {
    const result = removeItem(emptyCart(), makeSDKProduct().id, clock);
    expect(result.success).toBe(false);
  });

  // تعيين الكمية صفرًا يزيل البند.
  it('يزيل البند عند تعيين كميته صفرًا', () => {
    const cart = cartWith(3);
    const productId = cart.items[0]?.productId;
    if (!productId) return;
    const result = updateQuantity(cart, productId, 0, clock);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toHaveLength(0);
  });

  // التفريغ يحفظ هوية السلة وإعداداتها.
  it('يفرّغ السلة مع الحفاظ على هويتها', () => {
    const cart = cartWith(2, 5);
    const cleared = clearCart(cart, clock);
    expect(cleared.items).toHaveLength(0);
    expect(cleared.id).toBe(cart.id);
    expect(cleared.taxRatePercent).toBe(5);
  });
});

describe('SDK Cart — الحسابات الحتمية', () => {
  // سلة فارغة تعطي أصفارًا لا NaN.
  it('يحسب سلة فارغة بأصفار صريحة', () => {
    const totals = calculateTotals(emptyCart(15));
    expect(totals.isEmpty).toBe(true);
    expect(totals.total.amount).toBe(0);
    expect(totals.taxAmount.amount).toBe(0);
  });

  // المجموع الأساسي = سعر × كمية.
  it('يحسب المجموع قبل الضريبة والخصم', () => {
    const totals = calculateTotals(cartWith(3, 0, 1000));
    expect(totals.subtotal.amount).toBe(3000);
    expect(totals.total.amount).toBe(3000);
    expect(totals.totalQuantity).toBe(3);
  });

  // الضريبة تُضاف على السعر غير الشامل.
  it('يضيف الضريبة على الأسعار غير الشاملة', () => {
    const totals = calculateTotals(cartWith(1, 15, 1000, false));
    expect(totals.subtotal.amount).toBe(1000);
    expect(totals.taxAmount.amount).toBe(150);
    expect(totals.total.amount).toBe(1150);
  });

  // الضريبة تُستخرج من السعر الشامل (لا تُضاف فوقه).
  it('يستخرج الضريبة من الأسعار الشاملة', () => {
    const totals = calculateTotals(cartWith(1, 15, 1150, true));
    // الإجمالي يبقى كما هو لأن السعر شامل أصلًا.
    expect(totals.total.amount).toBe(1150);
    // الضريبة المستخرجة = 1150 × 15 ÷ 115 = 150.
    expect(totals.taxAmount.amount).toBe(150);
  });

  // الحساب حتمي: نفس السلة تعطي نفس النتيجة في كل مرة.
  it('يعطي نفس النتيجة عند التكرار (حتمية)', () => {
    const cart = cartWith(7, 15, 333, false);
    const first = calculateTotals(cart);
    const second = calculateTotals(cart);
    expect(first).toEqual(second);
  });

  // إجمالي البند دالة نقية مباشرة.
  it('يحسب إجمالي البند من سعره وكميته', () => {
    const cart = cartWith(4, 0, 250);
    const item = cart.items[0];
    expect(item).toBeDefined();
    if (!item) return;
    expect(lineSubtotal(item).amount).toBe(1000);
  });
});

describe('SDK Cart — الخصومات', () => {
  // الخصم النسبي يُطبَّق على المجموع.
  it('يطبّق خصمًا نسبيًا على السلة', () => {
    const cart = cartWith(1, 0, 1000);
    const result = applyDiscount(cart, { type: 'percentage', value: 10 }, undefined, clock);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const totals = calculateTotals(result.data);
    expect(totals.cartDiscount.amount).toBe(100);
    expect(totals.total.amount).toBe(900);
  });

  // الخصم الثابت يُخصم كما هو.
  it('يطبّق خصمًا ثابتًا على السلة', () => {
    const cart = cartWith(1, 0, 1000);
    const result = applyDiscount(cart, { type: 'fixed', value: 250 }, undefined, clock);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(calculateTotals(result.data).total.amount).toBe(750);
  });

  // الخصم الثابت الذي يتجاوز الإجمالي مرفوض (لا إجمالي سالب).
  it('يرفض خصمًا ثابتًا يتجاوز الإجمالي', () => {
    const cart = cartWith(1, 0, 1000);
    const result = applyDiscount(cart, { type: 'fixed', value: 5000 }, undefined, clock);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('DISCOUNT_EXCEEDS_TOTAL');
  });

  // النسبة فوق 100% مرفوضة.
  it('يرفض نسبة خصم تتجاوز 100', () => {
    const result = applyDiscount(cartWith(1), { type: 'percentage', value: 150 }, undefined, clock);
    expect(result.success).toBe(false);
  });

  // القيمة السالبة مرفوضة.
  it('يرفض قيمة خصم سالبة', () => {
    const result = applyDiscount(cartWith(1), { type: 'percentage', value: -5 }, undefined, clock);
    expect(result.success).toBe(false);
  });

  // خصم البند يُطبَّق على بنده وحده.
  it('يطبّق خصمًا على بند محدد', () => {
    const cart = cartWith(2, 0, 1000);
    const productId = cart.items[0]?.productId;
    if (!productId) return;
    const result = applyDiscount(cart, { type: 'percentage', value: 50 }, productId, clock);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const totals = calculateTotals(result.data);
    // نصف قيمة البند (2 × 1000 ÷ 2).
    expect(totals.itemDiscounts.amount).toBe(1000);
    expect(totals.total.amount).toBe(1000);
  });

  // خصم السلة يُحسب بعد خصم البنود (لا خصم مزدوج على نفس المبلغ).
  it('يطبّق خصم السلة على المتبقي بعد خصومات البنود', () => {
    const cart = cartWith(1, 0, 1000);
    const productId = cart.items[0]?.productId;
    if (!productId) return;
    // خصم بند 10% ثم خصم سلة 10%.
    const withItemDiscount = applyDiscount(cart, { type: 'percentage', value: 10 }, productId, clock);
    if (!withItemDiscount.success) return;
    const withCartDiscount = applyDiscount(withItemDiscount.data, { type: 'percentage', value: 10 }, undefined, clock);
    if (!withCartDiscount.success) return;
    const totals = calculateTotals(withCartDiscount.data);
    // خصم البند 100، ثم 10% من 900 = 90.
    expect(totals.itemDiscounts.amount).toBe(100);
    expect(totals.cartDiscount.amount).toBe(90);
    expect(totals.total.amount).toBe(810);
  });

  // إزالة الخصم تعيد الإجمالي الأصلي.
  it('يزيل خصم السلة', () => {
    const cart = cartWith(1, 0, 1000);
    const discounted = applyDiscount(cart, { type: 'fixed', value: 300 }, undefined, clock);
    if (!discounted.success) return;
    const removed = removeDiscount(discounted.data, undefined, clock);
    expect(removed.success).toBe(true);
    if (removed.success) expect(calculateTotals(removed.data).total.amount).toBe(1000);
  });

  // دالة حساب الخصم نقية ومستقلة.
  it('يحسب قيمة الخصم بدالة نقية', () => {
    expect(discountAmount(money(1000, YER), { type: 'percentage', value: 25 }).amount).toBe(250);
    expect(discountAmount(money(1000, YER), { type: 'fixed', value: 400 }).amount).toBe(400);
    // الخصم الثابت لا يتجاوز الأساس أبدًا.
    expect(discountAmount(money(100, YER), { type: 'fixed', value: 999 }).amount).toBe(100);
    // بلا خصم = صفر.
    expect(discountAmount(money(100, YER), undefined).amount).toBe(0);
  });
});

describe('SDK Cart — الخصم مع الضريبة معًا', () => {
  // الضريبة تُحسب على المبلغ بعد الخصم لا قبله.
  it('يحسب الضريبة على الصافي بعد الخصم', () => {
    const cart = cartWith(1, 10, 1000, false);
    const discounted = applyDiscount(cart, { type: 'percentage', value: 20 }, undefined, clock);
    if (!discounted.success) return;
    const totals = calculateTotals(discounted.data);
    // الصافي 800، والضريبة 10% منه = 80.
    expect(totals.netTotal.amount).toBe(800);
    expect(totals.taxAmount.amount).toBe(80);
    expect(totals.total.amount).toBe(880);
  });
});
