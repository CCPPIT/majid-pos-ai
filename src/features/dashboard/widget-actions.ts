/**
 * تعريف إجراءات عناصر اللوحة (PHASE 10).
 * كل عنصر في السجل له نقرة واحدة: تنقّل لمسار/تبويب قائم، أو لافتة صادقة
 * تذكر المرحلة المستهدفة للعناصر غير المنفذة (لا وظائف وهمية).
 */
import type { Href } from 'expo-router';

// نوع الإجراء.
export type WidgetActionKind =
  | 'tab' // انتقال لتبويب سفلي قائم.
  | 'route' // انتقال لمسار قائم.
  | 'placeholder'; // لافتة: سينفذ لاحقًا.

// وصف إجراء عنصر.
export interface WidgetAction {
  kind: WidgetActionKind; // النوع.
  href?: Href; // مسار التنقل (للنوعين tab/route).
  phaseLabelKey?: string; // مفتاح ترجمة اسم المرحلة/الميزة (للافتة).
}

// خريطة إجراءات العناصر حسب المعرف (تطابق سجل WIDGETS).
export const WIDGET_ACTIONS: Record<string, WidgetAction> = {
  // بيع جديد → تبويب نقطة البيع (PHASE 11).
  'new-sale': { kind: 'tab', href: '/(app)/(tabs)/pos' },
  // السلة → تبويب نقطة البيع (محرك السلة PHASE 12).
  cart: { kind: 'tab', href: '/(app)/(tabs)/pos' },
  // مبيعات اليوم → تبويب الطلبات (تفاصيل المبيعات PHASE 11/22).
  'todays-sales': { kind: 'tab', href: '/(app)/(tabs)/orders' },
  // الطلبات → تبويب الطلبات.
  orders: { kind: 'tab', href: '/(app)/(tabs)/orders' },
  // العملاء → تبويب العملاء (PHASE 19).
  customers: { kind: 'tab', href: '/(app)/(tabs)/customers' },
  // التقارير → تبويب التقارير.
  reports: { kind: 'tab', href: '/(app)/(tabs)/reports' },
  // الإيرادات → التقارير (المالية التحليلية PHASE 22).
  revenue: { kind: 'tab', href: '/(app)/(tabs)/reports' },
  // المخزون → لافتة (PHASE 17).
  inventory: { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseInventory' },
  // الموظفون → لافتة (PHASE 21).
  employees: { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseHr' },
  // المالية → لافتة (PHASE 20).
  finance: { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseFinance' },
  // رؤى AI → لافتة (PHASE 24).
  'ai-insights': { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseAi' },
  // التنبؤ → لافتة (PHASE 24).
  forecast: { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseAi' },
  // وكلاء AI → لافتة (PHASE 25).
  'ai-agents': { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseAiAgents' },
  // التنبيهات → لافتة (PHASE 22/27).
  alerts: { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseAlerts' },
};

// إجراء العنصر (افتراضي لافتة إن لم يُعرّف).
export function getWidgetAction(widgetId: string): WidgetAction {
  return WIDGET_ACTIONS[widgetId] ?? { kind: 'placeholder', phaseLabelKey: 'dashboard.phaseComing' };
}
