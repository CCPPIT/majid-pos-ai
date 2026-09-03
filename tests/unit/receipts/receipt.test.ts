/**
 * اختبارات PHASE 15 — الإيصالات.
 * تغطي: بناء الإيصال من طلب/دفعة، صفوف الإجماليات، الدفع، والتحويل لنص.
 */
import { asId } from '@/core/types/domain';
import { addItem, computeTotals, emptyCart } from '@/domain/cart';
import { createSaleOrder, markOrderPaid } from '@/domain/sales/order';
import type { SaleOrder } from '@/domain/sales/types';
import type { Product } from '@/domain/products/types';
import { buildReceipt, receiptItemCount, receiptToText, type ReceiptLabels } from '@/domain/receipts';
import { createPayment, completePayment } from '@/domain/payments/calculations';
import type { ReceiptHeader } from '@/domain/receipts/types';

// منتج اختبار.
function makeProduct(): Product {
  return {
    id: asId('p1'),
    tenantId: asId('t1'),
    sku: 'SKU-1',
    barcode: '6291000000011',
    nameAr: 'مياه معدنية',
    nameEn: 'Mineral water',
    categoryId: 'cat-a',
    price: { amount: 1000, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// طلب اختبار (3 × 1000 = 3000 شامل).
function makeOrder(): SaleOrder {
  let cart = emptyCart('YER');
  cart = addItem(cart, makeProduct(), 3);
  return createSaleOrder(
    cart,
    computeTotals(cart, 5),
    { storeId: asId('s1'), cashierName: 'ماجد', customer: { type: 'walk_in', name: 'زبون' }, taxRatePercent: 5, sequence: 5 },
    '2026-08-29T10:00:00.000Z',
  );
}

// تسميات اختبارية مبسطة.
const LABELS: ReceiptLabels = {
  subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', total: 'Total',
  customer: 'Customer', cashier: 'Cashier', items: 'Items',
  tendered: 'Tendered', change: 'Change', reference: 'Ref',
  paymentMethod: 'Method', paid: 'PAID', unpaid: 'UNPAID', thanks: 'Thank you',
};

// ترويسة اختبارية.
const HEADER: ReceiptHeader = { businessName: 'Majid Stores', storeName: 'Haddah', branchName: 'Sanaa' };

// منسّق مبالغ بسيط.
const fmt = (amount: number) => `${amount} YER`;

describe('PHASE 15 — build receipt', () => {
  it('يبني إيصالًا غير مدفوع من طلب', () => {
    const receipt = buildReceipt(makeOrder(), null, {
      header: HEADER, formatMoney: fmt, labels: LABELS, locale: 'en', dateText: '2026-08-29 10:00',
    });
    expect(receipt.orderNumber).toBe('ORD-0005');
    expect(receipt.isPaid).toBe(false);
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.lines[0]?.name).toBe('Mineral water');
    expect(receiptItemCount(receipt)).toBe(3);
    // الإجماليات تتضمن subtotal/tax/total.
    const keys = receipt.totals.map((r) => r.label);
    expect(keys).toContain('Total');
    expect(receipt.payment).toBeUndefined();
    expect(receipt.header.businessName).toBe('Majid Stores');
  });

  it('يبني إيصالًا مدفوعًا مع الدفع والباقي (نقدي)', () => {
    const order = markOrderPaid(makeOrder());
    let payment = createPayment(order.id, order.orderNumber, 'cash', order.total, undefined, undefined);
    payment = completePayment(payment, 'SIM-123');
    // نحاكي القبض/الباقي.
    payment = { ...payment, tendered: { amount: 5000, currency: 'YER' }, changeDue: { amount: 2000, currency: 'YER' } };

    const receipt = buildReceipt(order, payment, {
      header: HEADER, formatMoney: fmt, labels: LABELS, locale: 'ar', dateText: '', paymentMethodLabel: 'نقدي',
    });
    expect(receipt.isPaid).toBe(true);
    expect(receipt.lines[0]?.name).toBe('مياه معدنية');
    expect(receipt.payment?.methodLabel).toBe('نقدي');
    expect(receipt.payment?.tenderedText).toContain('5000');
    expect(receipt.payment?.changeText).toContain('2000');
    expect(receipt.payment?.reference).toBe('SIM-123');
  });

  it('يتضمن صف خصم عند وجود خصم', () => {
    let cart = emptyCart('YER');
    cart = addItem(cart, makeProduct(), 3);
    cart = { ...cart, discountPercent: 10 };
    const order = createSaleOrder(cart, computeTotals(cart, 5), {
      storeId: asId('s1'), cashierName: 'ك', customer: { type: 'walk_in', name: 'زبون' }, taxRatePercent: 5, sequence: 1,
    });
    const receipt = buildReceipt(order, null, {
      header: HEADER, formatMoney: fmt, labels: LABELS, locale: 'en', dateText: '',
    });
    expect(receipt.totals.some((r) => r.label === 'Discount')).toBe(true);
  });
});

describe('PHASE 15 — receipt to text', () => {
  it('يحوّل الإيصال لنص متعدد الأسطر يحوي رقم الطلب والإجمالي', () => {
    const receipt = buildReceipt(makeOrder(), null, {
      header: HEADER, formatMoney: fmt, labels: LABELS, locale: 'en', dateText: '2026-08-29',
    });
    const text = receiptToText(receipt, LABELS);
    expect(text).toContain('ORD-0005');
    expect(text).toContain('Majid Stores');
    expect(text).toContain('Thank you');
    expect(text.split('\n').length).toBeGreaterThan(10);
  });

  it('النص يتضمن الدفع عند وجوده', () => {
    const order = markOrderPaid(makeOrder());
    const payment = completePayment(createPayment(order.id, order.orderNumber, 'card', order.total), 'CARD-9');
    const receipt = buildReceipt(order, payment, {
      header: HEADER, formatMoney: fmt, labels: LABELS, locale: 'en', dateText: '', paymentMethodLabel: 'Card',
    });
    const text = receiptToText(receipt, LABELS);
    expect(text).toContain('CARD-9');
    expect(text).toContain('PAID');
  });
});
