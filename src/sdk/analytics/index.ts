/**
 * مجال التحليلات — PHASE 31 · أقسام 28 و46.
 * يفصل بين تقارير الأعمال (بيانات المتجر) وتتبّع الاستخدام (سلوك التطبيق).
 * تتبّع الاستخدام لا يحمل بيانات شخصية إطلاقًا.
 */
import type {
  AsyncResult,
  CurrencyCode,
  DateRange,
  Money,
  ProductId,
} from '@/sdk/core';

// مؤشر أداء واحد.
export interface Metric {
  readonly key: string; // مفتاح المؤشر.
  readonly value: number; // قيمته.
  readonly previousValue?: number; // قيمته في الفترة السابقة.
  readonly changePercent?: number; // نسبة التغيّر.
}

// ملخص أداء المبيعات لفترة.
export interface SalesAnalytics {
  readonly range: DateRange; // الفترة.
  readonly revenue: Money; // الإيراد.
  readonly salesCount: number; // عدد الفواتير.
  readonly averageTicket: Money; // متوسط قيمة الفاتورة.
  readonly totalDiscount: Money; // إجمالي الخصومات.
  readonly totalTax: Money; // إجمالي الضريبة.
  readonly currency: CurrencyCode; // العملة.
  readonly growthPercent: number; // النمو مقارنة بالفترة السابقة.
}

// أداء منتج.
export interface ProductPerformance {
  readonly productId: ProductId; // المنتج.
  readonly nameAr: string; // اسمه.
  readonly quantitySold: number; // الكمية المباعة.
  readonly revenue: Money; // إيراده.
  readonly rank: number; // ترتيبه.
}

// مستودع التحليلات (قراءة فقط دائمًا).
export interface AnalyticsRepository {
  // ملخص المبيعات لفترة.
  getSalesAnalytics(range: DateRange): AsyncResult<SalesAnalytics>;
  // أفضل المنتجات مبيعًا.
  getTopProducts(range: DateRange, limit?: number): AsyncResult<readonly ProductPerformance[]>;
  // مؤشرات لوحة القيادة.
  getDashboardMetrics(range: DateRange): AsyncResult<readonly Metric[]>;
}

// منفذ تتبّع الاستخدام (Port) — بلا بيانات شخصية.
export interface AnalyticsTrackerPort {
  // يسجّل حدث استخدام (اسم + خصائص رقمية/نصية غير معرِّفة).
  track(event: string, properties?: Readonly<Record<string, string | number | boolean>>): void;
  // يسجّل عرض شاشة.
  screen(name: string): void;
}

// متتبّع صامت: الافتراضي حين لا يربط المضيف مزوّد تحليلات.
export const noopTracker: AnalyticsTrackerPort = {
  // نتجاهل الأحداث عمدًا (الـSDK يعمل مستقلًا).
  track: () => undefined,
  screen: () => undefined,
};

// يحسب نسبة التغيّر بين قيمتين (دالة نقية آمنة من القسمة على صفر).
export const changePercent = (current: number, previous: number): number => {
  // بلا قيمة سابقة لا نسبة (نُعيد صفرًا بدل لانهاية).
  if (previous === 0) return current === 0 ? 0 : 100;
  // النسبة المئوية مقرّبة لخانة واحدة.
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
};
