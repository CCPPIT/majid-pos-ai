/**
 * أنواع الوكلاء الأذكياء (AI Agents) وخط أمان الإجراءات (PHASE 25).
 * 7 وكلاء قواعديين على الجهاز يراقبون بيانات المتجر الحقيقية ويُنتجون
 * "رؤى" (insights). كل رؤية للقراءة فقط (info) وتقترح إجراءً اختياريًا
 * لا يُنفَّذ تلقائيًا أبدًا — يجب تأكيد المستخدم وامتلاك الصلاحية أولًا.
 * لا خادم ذكاء اصطناعي بعد؛ الذكاء قواعد محلية صادقة قابلة للاستبدال.
 */
import type { ISODateString } from '@/core/types/domain';

// معرفات الوكلاء السبعة.
export type AgentId =
  | 'inventory' // وكيل المخزون.
  | 'sales' // وكيل المبيعات.
  | 'finance' // وكيل المالية.
  | 'procurement' // وكيل المشتريات.
  | 'crm' // وكيل العملاء.
  | 'cashier' // وكيل الكاشير.
  | 'business'; // وكيل الأعمال (لوحة عامة).

// خطورة الرؤية (للفرز والعرض).
export type InsightSeverity = 'info' | 'good' | 'warning' | 'critical';

// وجهة الإجراء المقترح (تنقل داخل التطبيق) — لا تنفيذ مباشر.
export type AgentActionRoute =
  | '/(app)/inventory'
  | '/(app)/procurement'
  | '/(app)/customers'
  | '/(app)/finance'
  | '/(app)/orders'
  | '/(app)/products'
  | '/(app)/(tabs)/reports'
  | '/(app)/hr';

// إجراء اختياري تقترحه الرؤية (آمن: يحتاج تأكيدًا + صلاحية + تنقّل فقط).
export interface AgentAction {
  labelKey: string; // مفتاح ترجمة زر الإجراء.
  permission: string; // الصلاحية المطلوبة ليظهر الزر (إخفاء ليس أمنًا؛ التأكيد أيضًا).
  route: AgentActionRoute; // الوجهة عند التأكيد (لا كتابة تلقائية).
}

// رؤية ينتجها وكيل.
export interface AgentInsight {
  id: string; // معرف فريد.
  agentId: AgentId; // الوكيل المصدر.
  severity: InsightSeverity; // الخطورة.
  titleKey: string; // مفتاح ترجمة العنوان.
  bodyKey: string; // مفتاح ترجمة النص.
  // معاملات الترجمة (أرقام فقط؛ المبالغ تُمرّر نصًا منسّقًا عبر البادئة money*).
  params: Record<string, number>;
  // مفاتيح مبالغ منسّقة (مثل moneyRevenue) تُحقن في الترجمة من طبقة الخدمة.
  moneyKeys?: string[];
  action?: AgentAction; // إجراء اختياري مقترح.
  createdAt: ISODateString; // لحظة التوليد.
}

// تعريف وكيل (بيانات وصفية ثابتة).
export interface AgentDefinition {
  id: AgentId; // المعرف.
  nameKey: string; // مفتاح ترجمة الاسم.
  descriptionKey: string; // مفتاح ترجمة الوصف.
  icon: string; // أيقونة Ionicons.
  requiredPermission: string; // أدنى صلاحية لرؤية رؤى هذا الوكيل.
}

// بيانات المتجر المجمّعة التي تُغذّي محرّك القواعد.
export interface AgentDataInput {
  // تقرير مبيعات اليوم (إيراد/طلبات/ضريبة/خصم/نمو).
  todayRevenue: number; // إيراد اليوم (خام).
  todayPaidOrders: number; // طلبات اليوم المدفوعة.
  prevRevenue: number; // إيراد الفترة السابقة (للمقارنة) — خام.
  tax: number; // ضريبة اليوم.
  discount: number; // خصم اليوم.
  currency: string; // العملة.
  lowStockCount: number; // عدد منتجات المخزون المنخفض.
  outOfStockCount: number; // عدد المنتجات النافدة.
  pendingPurchaseCount: number; // أوامر الشراء غير المستلمة (submitted/approved/partially).
  vipCount: number; // عملاء مميزون (gold/platinum).
  unorderedVipCount: number; // عملاء مميزون بلا شراء (orderCount=0).
  unpaidOrderCount: number; // طلبات غير مدفوعة بالكامل.
  todayExpenses: number; // مصروفات اليوم (خام).
}
