/**
 * اختبارات مجال التقارير (PHASE 22).
 * تغطي: نطاقات الفترات، اشتقاق تقرير المبيعات من طلبات مدفوعة (الإيراد لا
 * يحصي غير المدفوعة)، متوسط قيمة الطلب، توزيع طرق الدفع، الأكثر مبيعًا،
 * السلسلة الزمنية، نسبة النمو، ونص التقرير القابل للمشاركة.
 */
import { periodRanges, buildSalesReport, reportToText } from '@/domain/reports';
import { money } from '@/core/money/money';
import type { SaleOrder } from '@/domain/sales/types';
import type { Payment } from '@/domain/payments/types';
import { asId } from '@/core/types/domain';

// لحظة مرجعية ثابتة للاختبارات (فبراير 2026).
const NOW = new Date('2026-02-15T12:00:00.000Z');

// يبني طلب بيع.
function makeOrder(over: Partial<SaleOrder>): SaleOrder {
  return {
    id: asId('o'),
    orderNumber: 'ORD-0001',
    lines: [],
    subtotal: money(1000, 'YER'),
    discount: money(0, 'YER'),
    taxAmount: money(150, 'YER'),
    total: money(1150, 'YER'),
    taxRatePercent: 15,
    discountPercent: 0,
    status: 'paid',
    paymentStatus: 'paid',
    customer: { type: 'walk_in', name: 'زبون' },
    cashierName: 'كاشير',
    currency: 'YER',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...over,
  };
}

// يبني دفعة.
function makePayment(over: Partial<Payment>): Payment {
  return {
    id: asId('pay'),
    orderId: asId('o'),
    orderNumber: 'ORD-0001',
    method: 'cash',
    amount: money(1150, 'YER'),
    state: 'completed',
    createdAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    ...over,
  };
}

describe('period ranges (PHASE 22)', () => {
  test('all period has no bounds', () => {
    const r = periodRanges('all', NOW);
    expect(r.current).toBeNull();
  });

  test('week spans 7 days and previous precedes it', () => {
    const r = periodRanges('week', NOW);
    expect(r.days).toBe(7);
    expect(r.current).not.toBeNull();
    expect(r.previous).not.toBeNull();
    if (!r.current || !r.previous) return; // تضييق النوع لـ TS.
    expect(r.current.from).toBeLessThan(r.current.to);
    expect(r.previous.to).toBe(r.current.from);
  });
});

describe('sales report derivation (PHASE 22)', () => {
  test('counts only paid orders in revenue', () => {
    const orders = [
      makeOrder({ id: asId('a'), total: money(1000, 'YER'), taxAmount: money(0, 'YER') }),
      makeOrder({
        id: asId('b'),
        orderNumber: 'ORD-0002',
        total: money(500, 'YER'),
        taxAmount: money(0, 'YER'),
        paymentStatus: 'unpaid',
        status: 'pending_payment',
      }),
    ];
    const report = buildSalesReport({ orders, payments: [], period: 'all', currency: 'YER' }, NOW);
    expect(report.orderCount).toBe(2); // كل الطلبات.
    expect(report.paidCount).toBe(1); // المدفوعة فقط.
    expect(report.revenue.amount).toBe(1000); // الإيراد من المدفوعة فقط.
    expect(report.avgOrderValue.amount).toBe(1000);
  });

  test('aggregates tax and discount', () => {
    const orders = [
      makeOrder({ id: asId('a'), taxAmount: money(150, 'YER'), discount: money(50, 'YER'), total: money(1100, 'YER') }),
      makeOrder({
        id: asId('b'),
        orderNumber: 'ORD-0002',
        taxAmount: money(200, 'YER'),
        discount: money(0, 'YER'),
        total: money(2200, 'YER'),
        createdAt: NOW.toISOString(),
      }),
    ];
    const report = buildSalesReport({ orders, payments: [], period: 'all', currency: 'YER' }, NOW);
    expect(report.tax.amount).toBe(350);
    expect(report.discount.amount).toBe(50);
  });

  test('payment method distribution only counts completed payments', () => {
    const orders = [makeOrder({ id: asId('sale-1') })];
    const payments = [
      makePayment({ id: asId('p1'), orderId: asId('sale-1'), method: 'cash', amount: money(600, 'YER') }),
      makePayment({ id: asId('p2'), orderId: asId('sale-1'), method: 'card', amount: money(550, 'YER') }),
      makePayment({ id: asId('p3'), orderId: asId('sale-1'), method: 'qr', amount: money(999, 'YER'), state: 'failed' }),
    ];
    const report = buildSalesReport({ orders, payments, period: 'all', currency: 'YER' }, NOW);
    // الفاشلة لا تُحسب.
    expect(report.methods.find((m) => m.method === 'qr')).toBeUndefined();
    const cash = report.methods.find((m) => m.method === 'cash');
    expect(cash?.count).toBe(1);
    // نسب المشاركة مجموعها ≈ 100.
    const shareSum = report.methods.reduce((s, m) => s + m.share, 0);
    expect(shareSum).toBeGreaterThan(99);
    expect(shareSum).toBeLessThanOrEqual(100.1);
  });

  test('top products aggregates quantities across orders', () => {
    const orders = [
      makeOrder({
        id: asId('a'),
        lines: [
          { productId: asId('prod-1'), sku: 's1', nameAr: 'ماء', nameEn: 'Water', unitPrice: money(100, 'YER'), quantity: 3, lineTotal: money(300, 'YER'), taxIncluded: true },
          { productId: asId('prod-2'), sku: 's2', nameAr: 'خبز', nameEn: 'Bread', unitPrice: money(50, 'YER'), quantity: 2, lineTotal: money(100, 'YER'), taxIncluded: true },
        ],
      }),
      makeOrder({
        id: asId('b'),
        orderNumber: 'ORD-0002',
        lines: [
          { productId: asId('prod-1'), sku: 's1', nameAr: 'ماء', nameEn: 'Water', unitPrice: money(100, 'YER'), quantity: 2, lineTotal: money(200, 'YER'), taxIncluded: true },
        ],
      }),
    ];
    const report = buildSalesReport({ orders, payments: [], period: 'all', currency: 'YER' }, NOW);
    const top = report.topProducts[0];
    expect(top?.nameAr).toBe('ماء');
    expect(top?.quantity).toBe(5);
    expect(top?.revenue.amount).toBe(500);
  });

  test('growth computes against previous period', () => {
    // طلب الآن (2000) وطلب قبل ~57 يومًا (1000) يقع في فترة الشهر السابقة.
    const recent = makeOrder({ id: asId('new'), total: money(2000, 'YER'), taxAmount: money(0, 'YER') });
    const older = makeOrder({
      id: asId('old'),
      orderNumber: 'ORD-0002',
      total: money(1000, 'YER'),
      taxAmount: money(0, 'YER'),
      createdAt: '2025-12-20T12:00:00.000Z',
    });
    const report = buildSalesReport({ orders: [recent, older], payments: [], period: 'month', currency: 'YER' }, NOW);
    // النمو = (2000 − 1000) / 1000 = 100%.
    expect(report.growth).toBe(100);
    expect(report.series.length).toBeGreaterThanOrEqual(0);
  });

  test('growth is zero when previous period has no revenue', () => {
    const recent = makeOrder({ id: asId('new'), total: money(2000, 'YER'), taxAmount: money(0, 'YER') });
    const report = buildSalesReport({ orders: [recent], payments: [], period: 'month', currency: 'YER' }, NOW);
    // لا إيراد في الفترة السابقة → نمو 0 (لا قسمة على صفر).
    expect(report.growth).toBe(0);
  });
});

describe('report text (PHASE 22)', () => {
  test('renders a shareable text report', () => {
    const orders = [makeOrder({ id: asId('a') })];
    const report = buildSalesReport({ orders, payments: [makePayment({ orderId: asId('a') })], period: 'all', currency: 'YER' }, NOW);
    const text = reportToText(report, {
      title: 'T', period: 'P', revenue: 'R', orders: 'O', paid: 'Paid',
      tax: 'Tax', discount: 'D', avg: 'Avg', growth: 'G', methods: 'M', top: 'Top', order: 'Ord',
    });
    expect(text).toContain('R');
    expect(text).toContain('cash');
  });
});
