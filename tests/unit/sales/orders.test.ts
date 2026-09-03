/**
 * اختبارات PHASE 13 — Checkout / طلبات البيع.
 * تغطي: بناء الطلب من السلة، رقم الطلب المتسلسل، العميل،
 * والمصدر/المستودع المحلي (حفظ/قائمة/تضييق النطاق).
 */
import { asId } from '@/core/types/domain';
import { addItem, computeTotals, emptyCart } from '@/domain/cart';
import { createSaleOrder, formatOrderNumber, orderQuantity, walkInCustomer } from '@/domain/sales/order';
import type { CreateOrderInput } from '@/domain/sales/types';
import { LocalOrdersSource } from '@/data/sources/orders.source';
import { AppOrdersRepository } from '@/data/repositories/orders.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import { STORAGE_KEYS } from '@/core/config/constants';
import type { Product } from '@/domain/products/types';

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
    price: { amount: 300, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// مدخلات سياق الطلب الافتراضية.
function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    storeId: asId('store-1'),
    cashierName: 'ماجد',
    customer: walkInCustomer(),
    taxRatePercent: 5,
    sequence: 1,
    ...overrides,
  };
}

// سلة فيها منتجان × 3.
function makeCart() {
  let cart = emptyCart('YER');
  cart = addItem(cart, makeProduct(), 3);
  return cart;
}

describe('PHASE 13 — order number & customer', () => {
  it('formatOrderNumber يولّد أرقامًا بأصفار بادئة', () => {
    expect(formatOrderNumber(1)).toBe('ORD-0001');
    expect(formatOrderNumber(42)).toBe('ORD-0042');
    expect(formatOrderNumber(12345)).toBe('ORD-12345');
  });

  it('العميل الافتراضي زائر باسم "زبون"', () => {
    expect(walkInCustomer()).toEqual({ type: 'walk_in', name: 'زبون' });
  });
});

describe('PHASE 13 — create order from cart', () => {
  it('ينشئ طلبًا ببنود السلة والإجماليات الصحيحة', () => {
    const cart = makeCart();
    const totals = computeTotals(cart, 5);
    const order = createSaleOrder(cart, totals, makeInput(), '2026-08-29T10:00:00.000Z');

    expect(order.orderNumber).toBe('ORD-0001');
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.quantity).toBe(3);
    // إجمالي البند = 300 × 3 = 900.
    expect(order.lines[0]?.lineTotal.amount).toBe(900);
    expect(order.total.amount).toBe(900); // أسعار شاملة.
    expect(orderQuantity(order)).toBe(3);
    // الطلب الجديد بانتظار الدفع.
    expect(order.status).toBe('pending_payment');
    expect(order.paymentStatus).toBe('unpaid');
    expect(order.customer.type).toBe('walk_in');
    expect(order.cashierName).toBe('ماجد');
    expect(String(order.storeId)).toBe('store-1');
  });

  it('ينسخ الخصم والضريبة من الإجماليات', () => {
    let cart = makeCart();
    cart = { ...cart, discountPercent: 10 };
    const totals = computeTotals(cart, 5);
    const order = createSaleOrder(cart, totals, makeInput({ sequence: 7 }));
    expect(order.discountPercent).toBe(10);
    expect(order.discount.amount).toBe(totals.discount.amount);
    expect(order.orderNumber).toBe('ORD-0007');
  });
});

describe('PHASE 13 — local source & repository', () => {
  // مصدر فوق تفضيلات في الذاكرة.
  function makeSource() {
    const prefs = new InMemoryPreferencesSource();
    const source = new LocalOrdersSource({
      getString: (key) => prefs.getString(key),
      setString: (key, value) => prefs.setString(key, value),
    });
    return { source, prefs };
  }

  it('يحفظ الطلب ويستعيده برقم متسلسل متزايد', async () => {
    const { source } = makeSource();
    const repo = new AppOrdersRepository(source);
    const cart = makeCart();
    const totals = computeTotals(cart, 5);

    const o1 = await repo.createOrder(cart, totals, { storeId: asId('store-1'), cashierName: 'ماجد', customer: walkInCustomer(), taxRatePercent: 5 });
    const o2 = await repo.createOrder(cart, totals, { storeId: asId('store-1'), cashierName: 'ماجد', customer: walkInCustomer(), taxRatePercent: 5 });

    expect(o1.orderNumber).toBe('ORD-0001');
    expect(o2.orderNumber).toBe('ORD-0002');

    const list = await repo.listOrders();
    expect(list).toHaveLength(2);
    // الأحدث أولًا.
    expect(list[0]?.orderNumber).toBe('ORD-0002');
  });

  it('getOrder يعيد الطلب بالمعرف أو null', async () => {
    const { source } = makeSource();
    const repo = new AppOrdersRepository(source);
    const order = await repo.createOrder(makeCart(), computeTotals(makeCart(), 5), {
      storeId: asId('store-1'),
      cashierName: 'ماجد',
      customer: walkInCustomer(),
      taxRatePercent: 5,
    });
    const fetched = await repo.getOrder(order.id);
    expect(fetched?.orderNumber).toBe(order.orderNumber);
    expect(await repo.getOrder(asId('nope'))).toBeNull();
  });

  it('listOrders يضيّق حسب المتجر (عزل المتاجر)', async () => {
    const { source } = makeSource();
    const repo = new AppOrdersRepository(source);
    const cart = makeCart();
    await repo.createOrder(cart, computeTotals(cart, 5), { storeId: asId('store-A'), cashierName: 'ك', customer: walkInCustomer(), taxRatePercent: 5 });
    await repo.createOrder(cart, computeTotals(cart, 5), { storeId: asId('store-B'), cashierName: 'ك', customer: walkInCustomer(), taxRatePercent: 5 });

    const onlyA = await repo.listOrders({ storeId: asId('store-A') });
    expect(onlyA).toHaveLength(1);
    expect(String(onlyA[0]?.storeId)).toBe('store-A');
  });

  it('مصدر تالف يُعيد قائمة فارغة دون انهيار', async () => {
    const prefs = new InMemoryPreferencesSource();
    await prefs.setString(STORAGE_KEYS.orders, '{not-json');
    const source = new LocalOrdersSource({
      getString: (key) => prefs.getString(key),
      setString: (key, value) => prefs.setString(key, value),
    });
    expect(await source.listOrders()).toEqual([]);
    expect(await source.getSequence()).toBe(0);
  });
});
