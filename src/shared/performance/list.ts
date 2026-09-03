/**
 * إعدادات أداء قوائم FlatList المشتركة (PHASE 29).
 * قيم نافذة افتراضية محافظة تناسب قوائم البيع بالتجزئة (بطاقات متوسطة الارتفاع)
 * لتقليل إطارات القفز عند التمرير مع إبقاء الاستجابة فورية. الدوال هنا نقية
 * (ثبات مفاتيح/حساب مواضع ثابتة) لتُختبَر دون منصة.
 */
import type { FlatListProps, ListRenderItem } from 'react-native';

// نوع عنصر القائمة (نستخدمه لحساب مواضع الصفوف).
export interface ListSizing {
  itemHeight: number; // ارتفاع الصف (يشمل الهامش العمودي إن وُجد).
  headerHeight?: number; // ارتفاع رأس القائمة (ListHeaderComponent) إن كان ثابتًا.
}

// القيم الافتراضية للنافذة — حافظة ومثبتة على أغلب الشاشات.
export const LIST_PERFORMANCE = {
  // عدد العناصر المُصيَّرة في الدفعة الأولى (أقل من الافتراضي 10 لبدء أسرع).
  initialNumToRender: 8,
  // عدد العناصر لكل دفعة لاحقة.
  maxToRenderPerBatch: 8,
  // مدى النافذة بوحدة ارتفاع الشاشة أمام/خلف المنظور.
  windowSize: 7,
  // تفريغ الصفوف خارج الشاشة (متاح على Android أساسًا).
  removeClippedSubviews: true,
  // تأخير بسيط قبل التحديث لحظة التمرير.
  updateCellsBatchingPeriod: 50,
} as const;

// مدخل ثابت الشكل لبناء مفتاح عنصر (أي كيان له معرف نصي/رقمي).
export interface KeyedItem {
  id: string | number; // المعرف الفريد.
}

// يبني مفتاحًا ثابتًا لعنصر (لا يعتمد على الفهرس المتغيّر → تُعاد الاستفادة من الصف).
export function stableKey<T extends KeyedItem>(item: T): string {
  return String(item.id);
}

// يبني مفتاحًا ثابتًا بمجال (للقوائم التي قد يتكرر فيها المعرف بين أنواع).
export function stableKeyWithPrefix(prefix: string): <T extends KeyedItem>(item: T) => string {
  return (item) => `${prefix}-${String(item.id)}`;
}

// مقارنة مساواتية لـ React.memo للصفوف: يتخطّى إعادة الرسم إن تساوى المعرف
// والحالة/الاختيار البسيطان (يُفترض ثبات باقي البيانات للعنصر).
export function sameRowIdentity(prev: { item: KeyedItem }, next: { item: KeyedItem }): boolean {
  return String(prev.item.id) === String(next.item.id);
}

// يحسب إزاحة (offset) صف في قائمة ذات ارتفاع صف ثابت (لـ getItemLayout).
export function fixedRowOffset(index: number, sizing: ListSizing): number {
  const header = sizing.headerHeight ?? 0;
  return header + index * sizing.itemHeight;
}

// يبني getItemLayout لقائمة ارتفاع صفوفها ثابت (يمنع القياس الديناميكي لكل صف).
export function makeFixedLayout<T>(sizing: ListSizing) {
  return (
    _data: ArrayLike<T> | null | undefined,
    index: number,
  ): { length: number; offset: number; index: number } => ({
    length: sizing.itemHeight,
    offset: fixedRowOffset(index, sizing),
    index,
  });
}

// حوامل (spreader) جاهزة تُدمج في خصائص FlatList للشاشات.
export const verticalListPerformance: Partial<FlatListProps<unknown>> = {
  initialNumToRender: LIST_PERFORMANCE.initialNumToRender,
  maxToRenderPerBatch: LIST_PERFORMANCE.maxToRenderPerBatch,
  windowSize: LIST_PERFORMANCE.windowSize,
  removeClippedSubviews: LIST_PERFORMANCE.removeClippedSubviews,
  updateCellsBatchingPeriod: LIST_PERFORMANCE.updateCellsBatchingPeriod,
};

// هوية دالة renderItem مستقرة (تُمرَّر بعد لفّ المكوّن بـ memo) — نوع مساعد.
export type RowRenderer<T> = ListRenderItem<T>;
