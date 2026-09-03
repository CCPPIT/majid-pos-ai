/**
 * منطق التقارير النقي (PHASE 22).
 * يشتق تقرير المبيعات من الطلبات المدفوعة والدفعات المكتملة: الإيراد، الضريبة،
 * الخصم، متوسط قيمة الطلب، توزيع طرق الدفع، الأكثر مبيعًا، سلسلة زمنية يومية،
 * ونسبة النمو مقابل الفترة السابقة. دوال خالصة بلا تخزين — قابلة للاختبار.
 */
import { money, roundMoney } from '@/core/money/money';
import type { SaleOrder } from '@/domain/sales/types';
import type { Payment } from '@/domain/payments/types';
import type {
  PaymentMethodSlice,
  ProductPerformance,
  ReportPeriod,
  SalesReport,
  TimeSeriesPoint,
} from './types';

// مدى زمني (بلحظات ISO).
interface Range {
  from: number; // بداية (ms).
  to: number; // نهاية (ms).
}

// يحسب مدى الفترة الحالية ونظيرتها السابقة بالملي ثانية.
export function periodRanges(period: ReportPeriod, now: Date = new Date()): { current: Range | null; previous: Range | null; days: number } {
  const end = now.getTime();
  if (period === 'all') {
    // الكل: لا حد بداية؛ السابق غير مستخدم (نمو 0).
    return { current: null, previous: null, days: 14 };
  }
  let days: number;
  if (period === 'today') days = 1;
  else if (period === 'week') days = 7;
  else days = 30;
  const span = days * 24 * 60 * 60 * 1000;
  return {
    current: { from: end - span, to: end },
    previous: { from: end - span * 2, to: end - span },
    days,
  };
}

// هل الطلب داخل المدى الزمني؟ (المدى null = لا تضييق).
function within(createdAt: string, range: Range | null): boolean {
  if (!range) return true;
  const t = new Date(createdAt).getTime();
  return t >= range.from && t <= range.to;
}

// الطلبات المدفوعة داخل مدى.
function paidInRange(orders: SaleOrder[], range: Range | null): SaleOrder[] {
  return orders.filter((o) => o.paymentStatus === 'paid' && within(o.createdAt, range));
}

// سلسلة زمنية يومية (تجميع الطلبات المدفوعة حسب اليوم).
function buildSeries(orders: SaleOrder[], currency: string, days: number): TimeSeriesPoint[] {
  // خريطة اليوم: مفتاح YYYY-MM-DD → {إيراد، عدد}.
  const map = new Map<string, { revenue: number; orders: number; label: string }>();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) ?? { revenue: 0, orders: 0, label: key.slice(5) }; // MM-DD للعرض.
    cur.revenue += o.total.amount;
    cur.orders += 1;
    map.set(key, cur);
  }
  // ترتيب تصاعدي حسب اليوم، ونكتفي بآخر `days` نقطة.
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([dateKey, v]) => ({
      dateKey,
      label: v.label,
      revenue: money(roundMoney(v.revenue), currency),
      orders: v.orders,
    }));
}

// توزيع طرق الدفع من الدفعات المكتملة المرتبطة بالطلبات.
function buildMethodSlices(payments: Payment[], orderIds: Set<string>, currency: string): PaymentMethodSlice[] {
  const totals = new Map<string, { count: number; amount: number }>();
  let grand = 0;
  for (const p of payments) {
    if (p.state !== 'completed') continue;
    if (!orderIds.has(String(p.orderId))) continue;
    const cur = totals.get(p.method) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += p.amount.amount;
    grand += p.amount.amount;
    totals.set(p.method, cur);
  }
  return Array.from(totals.entries())
    .map(([method, v]) => ({
      method,
      count: v.count,
      amount: money(roundMoney(v.amount), currency),
      share: grand > 0 ? Math.round((v.amount / grand) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount.amount - a.amount.amount);
}

// الأكثر مبيعًا (تجميع بنود الطلبات المدفوعة).
function buildTopProducts(orders: SaleOrder[], currency: string, limit = 10): ProductPerformance[] {
  const map = new Map<string, ProductPerformance>();
  for (const o of orders) {
    for (const line of o.lines) {
      const key = String(line.productId);
      const cur = map.get(key) ?? {
        productId: line.productId,
        nameAr: line.nameAr,
        nameEn: line.nameEn,
        quantity: 0,
        revenue: money(0, currency),
      };
      cur.quantity += line.quantity;
      cur.revenue = money(roundMoney(cur.revenue.amount + line.lineTotal.amount), currency);
      map.set(key, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

// وسائط بناء التقرير.
export interface BuildReportInput {
  orders: SaleOrder[]; // كل الطلبات.
  payments: Payment[]; // كل الدفعات.
  period: ReportPeriod; // الفترة.
  currency: string; // العملة.
}

// يبني تقرير مبيعات كاملًا.
export function buildSalesReport(input: BuildReportInput, now: Date = new Date()): SalesReport {
  const { orders, payments, period, currency } = input;
  const { current, previous, days } = periodRanges(period, now);

  const paid = paidInRange(orders, current);
  const orderCount = orders.filter((o) => within(o.createdAt, current)).length;

  // مجاميع مالية.
  let revenueAmount = 0;
  let taxAmount = 0;
  let discountAmount = 0;
  for (const o of paid) {
    revenueAmount += o.total.amount;
    taxAmount += o.taxAmount.amount;
    discountAmount += o.discount.amount;
  }

  const paidCount = paid.length;
  const avgOrder = paidCount > 0 ? revenueAmount / paidCount : 0;

  // النمو مقابل الفترة السابقة (لا ينطبق على "الكل").
  let growth = 0;
  if (previous) {
    const prevPaid = paidInRange(orders, previous);
    const prevRevenue = prevPaid.reduce((s, o) => s + o.total.amount, 0);
    if (prevRevenue > 0) {
      growth = Math.round(((revenueAmount - prevRevenue) / prevRevenue) * 1000) / 10;
    }
  }

  const paidIds = new Set(paid.map((o) => String(o.id)));

  return {
    period,
    from: current ? new Date(current.from).toISOString() : undefined,
    to: current ? new Date(current.to).toISOString() : undefined,
    currency,
    orderCount,
    paidCount,
    revenue: money(roundMoney(revenueAmount), currency),
    tax: money(roundMoney(taxAmount), currency),
    discount: money(roundMoney(discountAmount), currency),
    avgOrderValue: money(roundMoney(avgOrder), currency),
    methods: buildMethodSlices(payments, paidIds, currency),
    topProducts: buildTopProducts(paid, currency),
    series: buildSeries(paid, currency, period === 'today' ? 1 : days),
    growth,
  };
}

// يبني تقريرًا نصيًا خالصًا للمشاركة/التصدير الحراري (Share/طباعة لاحقة).
export function reportToText(report: SalesReport, labels: {
  title: string;
  period: string;
  revenue: string;
  orders: string;
  paid: string;
  tax: string;
  discount: string;
  avg: string;
  growth: string;
  methods: string;
  top: string;
  order: string;
}): string {
  // سطر فاصل بعرض 32 عمودًا (منسجم مع إيصال المرحلة 15).
  const line = '-'.repeat(32);
  const f = (m: { amount: number }) => m.amount.toFixed(0);
  const rows: string[] = [];
  rows.push(labels.title);
  rows.push(labels.period + ': ' + report.period);
  rows.push(line);
  rows.push(`${labels.revenue.padEnd(16)} ${f(report.revenue)}`);
  rows.push(`${labels.orders.padEnd(16)} ${report.orderCount}`);
  rows.push(`${labels.paid.padEnd(16)} ${report.paidCount}`);
  rows.push(`${labels.tax.padEnd(16)} ${f(report.tax)}`);
  rows.push(`${labels.discount.padEnd(16)} ${f(report.discount)}`);
  rows.push(`${labels.avg.padEnd(16)} ${f(report.avgOrderValue)}`);
  rows.push(`${labels.growth.padEnd(16)} ${report.growth}%`);
  rows.push(line);
  rows.push(labels.methods);
  for (const m of report.methods) {
    rows.push(`${m.method.padEnd(12)} ${m.count}  ${f(m.amount)} (${m.share}%)`);
  }
  rows.push(line);
  rows.push(labels.top);
  for (const p of report.topProducts.slice(0, 10)) {
    rows.push(`${p.quantity}× ${p.nameAr.slice(0, 18).padEnd(18)} ${f(p.revenue)}`);
  }
  return rows.join('\n');
}
