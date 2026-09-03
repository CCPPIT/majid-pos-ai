/**
 * اختبارات PHASE 14 — المدفوعات.
 * تغطي: القبض/الباقي النقدي، الفئات السريعة، إنشاء/إكمال الدفعة،
 * المزود المحاكى، ومستودع الدفع (تحديث حالة الطلب + عزل النقدي غير الكافي).
 */
import { asId } from '@/core/types/domain';
import { money } from '@/core/money/money';
import {
  completePayment,
  computeTender,
  createPayment,
  failPayment,
  methodLabelKey,
  quickCashAmounts,
  SimulatedPaymentProvider,
} from '@/domain/payments';
import { AppPaymentsRepository } from '@/data/repositories/payments.repository';
import { LocalPaymentsSource } from '@/data/sources/payments.source';
import { LocalOrdersSource } from '@/data/sources/orders.source';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import { createSaleOrder, markOrderPaid } from '@/domain/sales/order';
import type { SaleOrder } from '@/domain/sales/types';
import { addItem, computeTotals, emptyCart } from '@/domain/cart';
import type { Product } from '@/domain/products/types';

// منتج اختبار.
function makeProduct(): Product {
  return {
    id: asId('p1'),
    tenantId: asId('t1'),
    sku: 'SKU-1',
    barcode: '6291000000011',
    nameAr: 'مياه',
    nameEn: 'Water',
    categoryId: 'cat-a',
    price: { amount: 1000, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// طلب اختبار بإجمالي 3000 (1000 × 3).
function makeOrder(): SaleOrder {
  let cart = emptyCart('YER');
  cart = addItem(cart, makeProduct(), 3);
  const totals = computeTotals(cart, 5);
  return createSaleOrder(
    cart,
    totals,
    { storeId: asId('s1'), cashierName: 'ك', customer: { type: 'walk_in', name: 'زبون' }, taxRatePercent: 5, sequence: 1 },
    '2026-08-29T10:00:00.000Z',
  );
}

describe('PHASE 14 — tender & change', () => {
  it('يحسب الباقي عند القبض الأكبر', () => {
    const due = money(3000, 'YER');
    const result = computeTender(due, 5000);
    expect(result.isSufficient).toBe(true);
    expect(result.changeDue.amount).toBe(2000);
    expect(result.tendered.amount).toBe(5000);
  });

  it('يرفض القبض الأقل ويعيد باقٍ صفر', () => {
    const result = computeTender(money(3000, 'YER'), 2000);
    expect(result.isSufficient).toBe(false);
    expect(result.changeDue.amount).toBe(0);
  });

  it('القبض المطابق كافٍ وبلا باقٍ', () => {
    const result = computeTender(money(3000, 'YER'), 3000);
    expect(result.isSufficient).toBe(true);
    expect(result.changeDue.amount).toBe(0);
  });

  it('الفئات السريعة تتضمن المطلوب وأول فئة أكبر', () => {
    const amounts = quickCashAmounts(money(3000, 'YER'));
    expect(amounts).toContain(3000);
    expect(amounts.some((a) => a >= 3000)).toBe(true);
  });

  it('methodLabelKey يعيد مفاتيح الطرق', () => {
    expect(methodLabelKey('cash')).toBe('pay.methodCash');
    expect(methodLabelKey('card')).toBe('pay.methodCard');
    expect(methodLabelKey('qr')).toBe('pay.methodQr');
  });
});

describe('PHASE 14 — payment lifecycle & provider', () => {
  it('إنشاء الدفعة معلّقة ثم إكمالها/فشلها', () => {
    const order = makeOrder();
    const payment = createPayment(order.id, order.orderNumber, 'cash', order.total);
    expect(payment.state).toBe('pending');
    const completed = completePayment(payment, 'REF-1');
    expect(completed.state).toBe('completed');
    expect(completed.reference).toBe('REF-1');
    expect(completed.completedAt).toBeDefined();
    expect(failPayment(payment).state).toBe('failed');
  });

  it('المزود المحاكى يكتمل بمبلغ صالح ويفشل بصفر', async () => {
    const provider = new SimulatedPaymentProvider();
    const ok = await provider.process({ method: 'card', amount: money(3000, 'YER'), orderNumber: 'ORD-0001' });
    expect('reference' in ok).toBe(true);
    const bad = await provider.process({ method: 'card', amount: money(0, 'YER'), orderNumber: 'ORD-0001' });
    expect('errorKey' in bad).toBe(true);
    expect(provider.supports('wallet')).toBe(true);
  });
});

describe('PHASE 14 — payments repository', () => {
  function makeRepo() {
    const prefs = new InMemoryPreferencesSource();
    const ordersSource = new LocalOrdersSource({
      getString: (k) => prefs.getString(k),
      setString: (k, v) => prefs.setString(k, v),
    });
    const paymentsSource = new LocalPaymentsSource({
      getString: (k) => prefs.getString(k),
      setString: (k, v) => prefs.setString(k, v),
    });
    const repo = new AppPaymentsRepository(new SimulatedPaymentProvider(), paymentsSource, ordersSource);
    return { repo, ordersSource };
  }

  it('الدفع بالبطاقة ينجح ويعلّم الطلب مدفوعًا', async () => {
    const { repo, ordersSource } = makeRepo();
    const order = makeOrder();
    await ordersSource.appendOrder(order);
    const result = await repo.payOrder({ order, method: 'card' });
    expect(result.ok).toBe(true);
    expect(result.payment?.state).toBe('completed');
    // الطلب المخزّن صار مدفوعًا.
    const stored = await ordersSource.listOrders();
    expect(stored[0]?.paymentStatus).toBe('paid');
    expect(stored[0]?.status).toBe('paid');
    // الدفعة مخزنة.
    const payments = await repo.listPaymentsForOrder(order.id);
    expect(payments).toHaveLength(1);
  });

  it('الدفع النقدي بقبض غير كافٍ يُرفض دون تغيير الطلب', async () => {
    const { repo, ordersSource } = makeRepo();
    const order = makeOrder();
    await ordersSource.appendOrder(order);
    const tender = computeTender(order.total, 1000); // أقل من 3000.
    const result = await repo.payOrder({ order, method: 'cash', tender });
    expect(result.ok).toBe(false);
    expect(result.errorKey).toBe('pay.error.insufficientCash');
    const stored = await ordersSource.listOrders();
    expect(stored[0]?.paymentStatus).toBe('unpaid');
  });

  it('الدفع النقدي بقبض كافٍ ينجح ويحفظ القبض والباقي', async () => {
    const { repo } = makeRepo();
    const order = makeOrder();
    const tender = computeTender(order.total, 5000);
    const result = await repo.payOrder({ order, method: 'cash', tender });
    expect(result.ok).toBe(true);
    expect(result.payment?.tendered?.amount).toBe(5000);
    expect(result.payment?.changeDue?.amount).toBe(2000);
  });

  it('markOrderPaid يحول حالة الطلب', () => {
    const paid = markOrderPaid(makeOrder());
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.status).toBe('paid');
  });
});
