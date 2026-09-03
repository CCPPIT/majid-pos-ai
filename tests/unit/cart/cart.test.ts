/**
 * اختبارات PHASE 12 — محرك السلة.
 * تغطي: إضافة/دمج البنود، حدود المخزون، الكميات، الخصم،
 * وحساب الضريبة/الإجمالي عبر core/money (شاملة وغير شاملة).
 */
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';
import {
  addItem,
  clearCart,
  computeTotals,
  createLine,
  decrementItem,
  emptyCart,
  findLine,
  incrementItem,
  isCartEmpty,
  removeItem,
  setDiscount,
  setQuantity,
  totalQuantity,
} from '@/domain/cart';
import type { Product } from '@/domain/products/types';

// منتج اختياري.
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: asId('p1'),
    tenantId: asId('t1'),
    sku: 'SKU-1',
    barcode: '6291000000011',
    nameAr: 'مياه معدنية',
    nameEn: 'Mineral water',
    categoryId: 'cat-a',
    price: { amount: 300, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('PHASE 12 — cart structure', () => {
  it('سلة فارغة تُنشأ بالعملة والمتجر', () => {
    const cart = emptyCart('YER', asId('s1'));
    expect(cart.lines).toHaveLength(0);
    expect(cart.currency).toBe('YER');
    expect(String(cart.storeId)).toBe('s1');
    expect(isCartEmpty(cart)).toBe(true);
  });

  it('createLine يلتقط سعر المنتج ككائن Money', () => {
    const line = createLine(makeProduct(), 2);
    expect(line.unitPrice.amount).toBe(300);
    expect(line.unitPrice.currency).toBe('YER');
    expect(line.quantity).toBe(2);
  });
});

describe('PHASE 12 — add / merge / stock', () => {
  it('الإضافة تدمج البنود بنفس المنتج', () => {
    let cart = emptyCart('YER');
    cart = addItem(cart, makeProduct(), 1);
    cart = addItem(cart, makeProduct(), 2);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
    expect(totalQuantity(cart)).toBe(3);
  });

  it('إضافة منتجين مختلفين تُنشئ بندين', () => {
    let cart = emptyCart('YER');
    cart = addItem(cart, makeProduct({ id: asId('a') }), 1);
    cart = addItem(cart, makeProduct({ id: asId('b'), barcode: '222', nameAr: 'قهوة' }), 1);
    expect(cart.lines).toHaveLength(2);
  });

  it('يرفض تجاوز المخزون المتوفر', () => {
    const product = makeProduct({ stockQuantity: 5 });
    const cart = emptyCart('YER');
    expect(() => addItem(cart, product, 6)).toThrow(ValidationError);
    // الإضافة ضمن الحد تعمل.
    const ok = addItem(cart, product, 5);
    expect(ok.lines[0]?.quantity).toBe(5);
    // تجاوز لاحق يُرفض.
    expect(() => addItem(ok, product, 1)).toThrow(ValidationError);
  });

  it('يرفض اختلاف عملة المنتج عن السلة', () => {
    const cart = emptyCart('SAR');
    const product = makeProduct({ price: { amount: 10, currency: 'YER' } });
    expect(() => addItem(cart, product, 1)).toThrow(ValidationError);
  });
});

describe('PHASE 12 — quantity & removal', () => {
  it('الزيادة والإنقاص والإزالة تعمل', () => {
    let cart = addItem(emptyCart('YER'), makeProduct(), 2);
    const id = asId('p1');
    cart = incrementItem(cart, id);
    expect(findLine(cart, id)?.quantity).toBe(3);
    cart = decrementItem(cart, id);
    expect(findLine(cart, id)?.quantity).toBe(2);
    // الإنقاص إلى صفر يزيل البند.
    cart = setQuantity(cart, id, 0);
    expect(findLine(cart, id)).toBeUndefined();
  });

  it('removeItem يزيل البند كاملًا', () => {
    let cart = addItem(emptyCart('YER'), makeProduct(), 1);
    cart = removeItem(cart, asId('p1'));
    expect(isCartEmpty(cart)).toBe(true);
  });

  it('العمليات على بند غير موجود تُرمي خطأ', () => {
    const cart = emptyCart('YER');
    expect(() => incrementItem(cart, asId('nope'))).toThrow(ValidationError);
  });
});

describe('PHASE 12 — totals & tax (core/money)', () => {
  it('أسعار شاملة الضريبة: الإجمالي يبقى كما هو والضريبة تُستخرج', () => {
    // منتج 300 شامل، كمية 2 → 600 شامل ضريبة 5%.
    const cart = addItem(emptyCart('YER'), makeProduct({ taxIncluded: true }), 2);
    const totals = computeTotals(cart, 5);
    expect(totals.total.amount).toBe(600); // لا زيادة على الشامل.
    expect(totals.subtotal.amount).toBe(600);
    // الضريبة المستخرجة = 600 × 5 / 105 = 28.57.
    expect(totals.taxAmount.amount).toBeCloseTo(28.57, 1);
    expect(totals.totalQuantity).toBe(2);
  });

  it('أسعار غير شاملة: الضريبة تُضاف فوق الإجمالي', () => {
    // منتج 300 غير شامل، كمية 2 → صافٍ 600 + ضريبة 30 = 630.
    const cart = addItem(emptyCart('YER'), makeProduct({ taxIncluded: false }), 2);
    const totals = computeTotals(cart, 5);
    expect(totals.subtotal.amount).toBe(600);
    expect(totals.taxAmount.amount).toBeCloseTo(30, 1);
    expect(totals.total.amount).toBeCloseTo(630, 1);
  });

  it('خصم 10٪ يُنقص الإجمالي والضريبة معًا', () => {
    // شامل 300 × كمية 10 = 3000؛ خصم 10٪ = 300؛ الصافي 2700؛ الضريبة مستخرجة.
    const product = makeProduct({ stockQuantity: 50 });
    let cart = addItem(emptyCart('YER'), product, 10);
    cart = setDiscount(cart, 10);
    const totals = computeTotals(cart, 5);
    expect(totals.discount.amount).toBe(300);
    expect(totals.total.amount).toBeCloseTo(2700, 1);
    // ضريبة أقل من حالة بلا خصم.
    expect(totals.taxAmount.amount).toBeLessThan(3000 * 5 / 105);
  });

  it('الخصم خارج النطاق يُرفض', () => {
    const cart = addItem(emptyCart('YER'), makeProduct(), 1);
    expect(() => setDiscount(cart, 120)).toThrow(ValidationError);
    expect(() => setDiscount(cart, -5)).toThrow(ValidationError);
  });

  it('clearCart يصفّر البنود والخصم', () => {
    let cart = addItem(emptyCart('YER'), makeProduct(), 3);
    cart = setDiscount(cart, 10);
    const cleared = clearCart(cart);
    expect(isCartEmpty(cleared)).toBe(true);
    expect(cleared.discountPercent).toBe(0);
    expect(cleared.currency).toBe('YER');
  });

  it('السلة الفارغة إجمالياتها أصفار', () => {
    const totals = computeTotals(emptyCart('YER'), 5);
    expect(totals.total.amount).toBe(0);
    expect(totals.isEmpty).toBe(true);
  });
});
