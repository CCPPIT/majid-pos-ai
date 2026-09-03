/**
 * أنواع لوحة التحكم الديناميكية (PHASE 10).
 * اللوحة تُبنى من عناصر السجل (PHASE 07) مفلترة بالصلاحية، وتُملأ بمؤشرات
 * (Metrics) يجلبها المستودع. كل عنصر يعرض قيمة مالية/عددية/نصية.
 */
import type { ISODateString } from '@/core/types/domain';

// اتجاه التغير (مقارنة بالفترة السابقة).
export type MetricTrend = 'up' | 'down' | 'flat';

// نغمة البطاقة (لون دلالي) — تعريف مجال مستقل عن الـ design-system.
export type MetricTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// قيمة مؤشر واحدة على اللوحة.
export interface MetricValue {
  amount?: number; // قيمة مالية (تُنسّق بعملة المتجر).
  count?: number; // قيمة عددية (طلبات، عملاء…).
  textKey?: string; // مفتاح ترجمة لنص حر (رؤية AI مثلًا).
  sublabelKey?: string; // مفتاح ترجمة لسطر فرعي تحت القيمة.
  deltaPercent?: number; // نسبة التغير عن الفترة السابقة.
  trend?: MetricTrend; // اتجاه التغير (سهم أخضر/أحمر).
  tone?: MetricTone; // لون مميز للبطاقة.
}

// لقطة بيانات اللوحة لحظة التحميل.
export interface DashboardSnapshot {
  generatedAt: ISODateString; // لحظة توليد البيانات.
  currency: string; // عملة العرض (من سياق المتجر).
  metrics: Record<string, MetricValue>; // خريطة معرف العنصر → قيمته.
}

// حالات تحميل اللوحة الموحدة (قسم 49).
export type DashboardStatus =
  | { kind: 'loading' } // جارٍ التحميل.
  | { kind: 'ready'; snapshot: DashboardSnapshot } // بيانات جاهزة.
  | { kind: 'error'; messageKey: string } // فشل التحميل.
  | { kind: 'empty' }; // لا بيانات بعد (متجر جديد).
