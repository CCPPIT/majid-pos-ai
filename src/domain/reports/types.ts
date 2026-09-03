/**
 * أنواع مجال التقارير والتحليلات (PHASE 22).
 * كل الأرقام مشتقة من بيانات حقيقية (طلبات مدفوعة + مدفوعات مكتملة) ومحسوبة
 * بمال حقيقي عبر core/money. لا تخزين خاص بالتقارير — كلها قراءات محسوبة.
 */
import type { ID, ISODateString } from '@/core/types/domain';
import type { Money } from '@/core/money/money';

// فترة التقرير (نفس معاني المالية).
export type ReportPeriod = 'today' | 'week' | 'month' | 'all';

// نقطة في السلسلة الزمنية (يوم واحد).
export interface TimeSeriesPoint {
  dateKey: string; // مفتاح اليوم (YYYY-MM-DD).
  label: string; // تسمية العرض (يوم/تاريخ).
  revenue: Money; // إيراد اليوم.
  orders: number; // عدد الطلبات المدفوعة.
}

// توزيع طرق الدفع.
export interface PaymentMethodSlice {
  method: string; // الطريقة (cash/card/qr/wallet).
  count: number; // عدد العمليات.
  amount: Money; // الإجمالي.
  share: number; // النسبة من الإجمالي (0-100).
}

// أداء منتج (الأكثر مبيعًا).
export interface ProductPerformance {
  productId: ID; // المنتج.
  nameAr: string; // الاسم عربي.
  nameEn: string; // الاسم إنجليزي.
  quantity: number; // الكمية المباعة.
  revenue: Money; // الإيراد المحقق.
}

// بطاقة مؤشر رئيسية (KPI).
export interface KpiCard {
  key: string; // مفتاح التسمية.
  value: Money | number; // القيمة (مال أو رقم).
  isMoney: boolean; // هل القيمة مالية؟
  growth?: number; // نسبة النمو مقارنة بالفترة السابقة (قد تكون سالبة).
}

// تقرير المبيعات الكامل.
export interface SalesReport {
  period: ReportPeriod; // الفترة.
  from?: ISODateString; // البداية.
  to?: ISODateString; // النهاية.
  currency: string; // العملة.
  orderCount: number; // كل الطلبات في الفترة.
  paidCount: number; // الطلبات المدفوعة.
  revenue: Money; // إجمالي الإيراد المحصّل.
  tax: Money; // الضريبة المحصّلة.
  discount: Money; // إجمالي الخصم.
  avgOrderValue: Money; // متوسط قيمة الطلب.
  methods: PaymentMethodSlice[]; // توزيع طرق الدفع.
  topProducts: ProductPerformance[]; // الأكثر مبيعًا (أعلى 10).
  series: TimeSeriesPoint[]; // السلسلة الزمنية (أيام).
  growth: number; // نسبة نمو الإيراد مقابل الفترة السابقة.
}
