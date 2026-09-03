/**
 * مصدر بيانات لوحة التحكم (PHASE 10).
 * اليوم مؤشرات تجريبية محلية (Mock)؛ لاحقًا تُجلب من API تحليلات حقيقي
 * دون تغيير المستودع أو الشاشة. البيانات تُنطق بنطاق الاستعلام (المتجر/الفرع…)
 * عبر تمرير المعرّفات — والقيم التجريبية تتغير قليلًا حسب النطاق لتوضيح التضييق.
 */
import type { QueryScope } from '@/domain/tenancy/scope';
import type { DashboardSnapshot, MetricValue } from '@/domain/dashboard/types';

// واجهة المصدر.
export interface DashboardSource {
  // يجلب لقطة المؤشرات لنطاق معين.
  getDashboardSnapshot(scope: QueryScope | null, currency: string): Promise<DashboardSnapshot>;
}

// أرقام تجريبية شبه ثابتة (لا عشوائية — قابلة للاختبار) بحسب معرف النطاق.
function seededValue(base: number, salt: string): number {
  // بصمة بسيطة من النص لإضافة إزاحة ثابتة.
  let hash = 0;
  for (let i = 0; i < salt.length; i += 1) {
    hash = (hash * 31 + salt.charCodeAt(i)) >>> 0; // تدوير بصمة.
  }
  return base + (hash % 1000); // إزاحة بين 0 و999.
}

// مصدر محلي ثابت (Mock) — جاهز للاستبدال بـ API.
export class MockDashboardSource implements DashboardSource {
  async getDashboardSnapshot(scope: QueryScope | null, currency: string): Promise<DashboardSnapshot> {
    // بصمة النطاق (المتجر أولًا ثم الفرع…) لتنويع القيم التجريبية.
    const salt = scope?.storeId ?? scope?.branchId ?? scope?.organizationId ?? 'demo';
    // مبيعات اليوم: أساس 48000 + إزاحة.
    const todaysSales = seededValue(48000, `sales-${salt}`);
    // الإيرادات (فترة أطول): أساس أكبر.
    const revenue = seededValue(312000, `revenue-${salt}`);
    // عناصر السلة الحالية.
    const cartCount = seededValue(0, `cart-${salt}`) % 7;
    // طلبات اليوم.
    const ordersCount = seededValue(24, `orders-${salt}`) % 120;
    // أصناف المخزون المنخفضة.
    const lowStock = seededValue(3, `inventory-${salt}`) % 18;
    // الموظفون النشطون.
    const employeesCount = seededValue(6, `employees-${salt}`) % 40;
    // عملاء جدد.
    const customersCount = seededValue(12, `customers-${salt}`) % 90;
    // رصيد مالي متاح.
    const financeBalance = seededValue(150000, `finance-${salt}`);
    // تنبيهات مفتوحة.
    const alertsCount = (lowStock % 5) + 1;

    // خريطة المؤشرات التجريبية (بطاقة "بيع جديد" إجراء بلا قيمة).
    const metrics: Record<string, MetricValue> = {
      // مبيعات اليوم.
      'todays-sales': {
        amount: todaysSales,
        deltaPercent: 12.4, // ارتفاع.
        trend: 'up',
        tone: 'success',
        sublabelKey: 'dashboard.vsYesterday',
      },
      // السلة.
      cart: { count: cartCount, sublabelKey: 'dashboard.itemsInCart', tone: 'info' },
      // الطلبات.
      orders: { count: ordersCount, deltaPercent: 5.1, trend: 'up', tone: 'primary' },
      // الإيرادات.
      revenue: { amount: revenue, deltaPercent: 8.7, trend: 'up', tone: 'primary' },
      // المخزون: عدد الأصناف المنخفضة.
      inventory: { count: lowStock, trend: lowStock > 8 ? 'down' : 'flat', tone: lowStock > 8 ? 'warning' : 'neutral', sublabelKey: 'dashboard.lowStock' },
      // الموظفون.
      employees: { count: employeesCount, tone: 'neutral', sublabelKey: 'dashboard.activeStaff' },
      // التقارير.
      reports: { count: 6, tone: 'info', sublabelKey: 'dashboard.reportsReady' },
      // العملاء.
      customers: { count: customersCount, deltaPercent: 3.2, trend: 'up', tone: 'success', sublabelKey: 'dashboard.newCustomers' },
      // المالية.
      finance: { amount: financeBalance, tone: 'primary', sublabelKey: 'dashboard.cashBalance' },
      // رؤى AI.
      'ai-insights': {
        textKey: 'dashboard.aiInsightDemo',
        tone: 'info',
        sublabelKey: 'dashboard.aiBadge',
      },
      // التنبؤ.
      forecast: { textKey: 'dashboard.forecastDemo', tone: 'info', sublabelKey: 'dashboard.aiBadge' },
      // وكلاء AI.
      'ai-agents': { count: 3, tone: 'info', sublabelKey: 'dashboard.agentsOnline' },
      // التنبيهات.
      alerts: { count: alertsCount, tone: alertsCount > 4 ? 'danger' : 'warning', sublabelKey: 'dashboard.openAlerts' },
    };

    // نعيد اللقطة كاملة.
    return {
      generatedAt: new Date().toISOString(),
      currency,
      metrics,
    };
  }
}
