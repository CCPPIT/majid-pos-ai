/**
 * سجل عناصر لوحة التحكم (Widget Registry) — أقسام 21 و54.
 * لا نكتب لوحة لكل دور؛ نعرّف عناصر بصلاحية مطلوبة، وكل دور يرى
 * ما تغطيه صلاحياته فقط (Personalized Mobile Dashboard).
 */

// تعريف عنصر لوحة تحكم.
export interface WidgetDefinition {
  id: string; // معرف العنصر.
  titleKey: string; // مفتاح الترجمة للعنوان.
  icon: string; // أيقونة Ionicons.
  permission: string; // الإذن المطلوب لإظهار العنصر.
  /** حجم تقريبي في شبكة اللوحة (صف/عمود). */
  size: 'small' | 'medium' | 'large';
}

// كل العناصر المتاحة في النظام (تُفلتر حسب الدور).
export const WIDGETS: readonly WidgetDefinition[] = [
  // عناصر الكاشير (نقطة البيع).
  { id: 'new-sale', titleKey: 'widget.newSale', icon: 'add-circle', permission: 'pos.sale.create', size: 'large' }, // بيع جديد.
  { id: 'todays-sales', titleKey: 'widget.todaysSales', icon: 'cash', permission: 'sales.read', size: 'medium' }, // مبيعات اليوم.
  { id: 'cart', titleKey: 'widget.cart', icon: 'cart', permission: 'pos.cart.read', size: 'small' }, // السلة الحالية.
  { id: 'orders', titleKey: 'widget.orders', icon: 'receipt', permission: 'order.read', size: 'medium' }, // الطلبات.
  // عناصر المدير (إيراد/مخزون/موظفون/تقارير).
  { id: 'revenue', titleKey: 'widget.revenue', icon: 'trending-up', permission: 'reports.view', size: 'large' }, // الإيرادات.
  { id: 'inventory', titleKey: 'widget.inventory', icon: 'cube', permission: 'inventory.read', size: 'medium' }, // المخزون.
  { id: 'employees', titleKey: 'widget.employees', icon: 'people', permission: 'employees.read', size: 'small' }, // الموظفون.
  { id: 'reports', titleKey: 'widget.reports', icon: 'bar-chart', permission: 'reports.read', size: 'medium' }, // التقارير.
  // عناصر العملاء.
  { id: 'customers', titleKey: 'widget.customers', icon: 'person-circle', permission: 'customer.read', size: 'medium' }, // العملاء.
  // عناصر المالية.
  { id: 'finance', titleKey: 'widget.finance', icon: 'wallet', permission: 'finance.read', size: 'large' }, // المالية.
  // عناصر الذكاء الاصطناعي.
  { id: 'ai-insights', titleKey: 'widget.aiInsights', icon: 'sparkles', permission: 'ai.read', size: 'large' }, // رؤى AI.
  { id: 'forecast', titleKey: 'widget.forecast', icon: 'pulse', permission: 'forecasting.read', size: 'medium' }, // التنبؤ.
  { id: 'ai-agents', titleKey: 'widget.aiAgents', icon: 'chatbubbles', permission: 'ai.manage', size: 'medium' }, // وكلاء AI.
  // تنبيهات.
  { id: 'alerts', titleKey: 'widget.alerts', icon: 'notifications', permission: 'reports.read', size: 'small' }, // التنبيهات.
];

/**
 * العناصر المتاحة لدور/مستخدم بناءً على صلاحياته.
 * نعيد التعريفات كاملة بترتيب ثابت (الأهم أولًا).
 */
export const visibleWidgets = (permissions: readonly string[]): WidgetDefinition[] => {
  // نضمّن '*' تلقائيًا، ونطابق عبر منطق التفويض.
  const granted = permissions.includes('*') ? ['*'] : permissions;
  // دالة مطابقة محلية بسيطة (نفس منطق permissionMatches).
  const match = (grantedPerm: string, required: string): boolean => {
    if (grantedPerm === '*') return true; // صلاحية مطلقة.
    const g = grantedPerm.toLowerCase().split('.'); // مقاطع الممنوح.
    const r = required.toLowerCase().split('.'); // مقاطع المطلوب.
    for (let i = 0; i < Math.min(g.length, r.length); i += 1) {
      if (g[i] === '*') return true; // بدل يطابق ما تبقى.
      if (g[i] !== r[i]) return false; // اختلاف في المقطع.
    }
    return g.length === r.length; // تطابق كامل الطول.
  };
  // نرتب العناصر ونفلترها.
  return WIDGETS.filter((w) => granted.some((g) => match(g, w.permission)));
};
