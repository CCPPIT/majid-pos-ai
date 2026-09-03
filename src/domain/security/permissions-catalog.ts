/**
 * فهرس الصلاحيات القانوني (Canonical Permissions).
 * كل إذن له مورد (resource) وفعل (action) ونطاق افتراضي.
 * الأدوار تشير إلى صلاحيات بالصيغة 'resource.action' أو بالبدائل 'resource.*'.
 */
import type { Action } from './types';
import type { Scope } from './scopes';

// تعريف إذن قانوني واحد.
export interface PermissionDefinition {
  key: string; // الصيغة الكاملة 'resource.action'.
  resource: string; // المورد.
  action: Action | string; // الفعل.
  scope: Scope; // النطاق الافتراضي.
}

// أداة بناء سريعة لتعريف إذن.
const perm = (resource: string, action: Action | string, scope: Scope): PermissionDefinition => ({
  key: `${resource}.${action}`,
  resource,
  action,
  scope,
});

/**
 * الفهرس الكامل للصلاحيات عبر كل المجالات.
 * النطاق هنا هو الافتراضي الأوسع للإذن؛ الدور يضيف تضييقًا عبر نطاق الدور.
 */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  // ── نقطة البيع (POS) ──
  perm('pos', 'sale.create', 'store'), // إنشاء عملية بيع.
  perm('pos', 'cart.read', 'store'), // قراءة السلة.
  perm('pos', 'cart.update', 'store'), // تعديل السلة.
  perm('pos', 'settings.manage', 'branch'), // إعدادات نقاط البيع.
  perm('pos', 'support.manage', 'branch'), // دعم الكاشير.
  perm('pos', 'read', 'store'), // قراءة عامة على POS.
  // ── المدفوعات والإيصالات ──
  perm('payment', 'create', 'store'), // تسجيل دفعة.
  perm('payment', 'refund', 'branch'), // استرجاع/رد مدفوعات.
  perm('payment', 'read', 'store'), // قراءة المدفوعات.
  perm('receipt', 'create', 'store'), // إنشاء إيصال.
  perm('receipt', 'read', 'store'), // قراءة الإيصالات.
  // ── الطلبات والمبيعات ──
  perm('order', 'read', 'store'), // قراءة الطلبات.
  perm('order', 'manage', 'store'), // إدارة الطلبات.
  // نضيف 'orders' بصيغة الجمع أيضًا (تستخدمها حزم المبيعات/الإشراف).
  perm('orders', 'read', 'store'), // قراءة الطلبات (جمع).
  perm('orders', 'manage', 'store'), // إدارة الطلبات (جمع).
  perm('orders', 'create', 'store'), // إنشاء طلب (جمع).
  perm('sales', 'read', 'organization'), // قراءة المبيعات.
  perm('sales', 'manage', 'organization'), // إدارة المبيعات.
  // ── المنتجات ──
  perm('products', 'read', 'store'), // قراءة المنتجات.
  perm('products', 'create', 'branch'), // إنشاء منتج.
  perm('products', 'update', 'branch'), // تعديل منتج.
  perm('products', 'delete', 'organization'), // حذف منتج.
  // ── المخزون ──
  perm('inventory', 'read', 'store'), // قراءة المخزون.
  perm('inventory', 'adjust', 'store'), // تسوية رصيد.
  perm('inventory', 'transfer', 'branch'), // تحويل مخزون.
  perm('inventory', 'audit', 'organization'), // جرد/تدقيق مخزون.
  perm('inventory', 'manage', 'organization'), // إدارة مخزون شاملة.
  // ── المشتريات والموردين ──
  perm('procurement', 'read', 'organization'), // قراءة المشتريات.
  perm('procurement', 'create', 'organization'), // إنشاء طلب شراء.
  perm('procurement', 'approve', 'organization'), // اعتماد طلب شراء.
  perm('procurement', 'manage', 'organization'), // إدارة المشتريات.
  perm('suppliers', 'read', 'organization'), // قراءة الموردين.
  perm('suppliers', 'manage', 'organization'), // إدارة الموردين.
  perm('contracts', 'manage', 'tenant'), // إدارة العقود.
  // ── العملاء وCRM والولاء ──
  perm('customer', 'read', 'store'), // قراءة العملاء.
  perm('customer', 'manage', 'branch'), // إدارة العملاء.
  perm('customers', 'read', 'store'), // بصيغة الجمع أيضًا.
  perm('customers', 'manage', 'branch'), // إدارة العملاء (جمع).
  perm('crm', 'read', 'organization'), // قراءة CRM.
  perm('crm', 'manage', 'organization'), // إدارة CRM.
  perm('loyalty', 'manage', 'organization'), // إدارة الولاء.
  // ── المالية والمحاسبة ──
  perm('finance', 'read', 'organization'), // قراءة المالية.
  perm('finance', 'manage', 'tenant'), // إدارة مالية.
  perm('finance', 'approve', 'tenant'), // اعتماد مالي.
  perm('accounting', 'read', 'organization'), // قراءة المحاسبة.
  perm('accounting', 'manage', 'tenant'), // إدارة المحاسبة.
  perm('reports', 'read', 'organization'), // قراءة التقارير العميقة (مؤسسة).
  perm('reports', 'view', 'store'), // عرض لوحات/تقارير على مستوى المتجر.
  perm('reports', 'export', 'tenant'), // تصدير التقارير.
  perm('treasury', 'manage', 'organization'), // إدارة الخزينة.
  perm('audit', 'read', 'tenant'), // قراءة سجلات التدقيق.
  // ─️ الموارد البشرية ──
  perm('employees', 'read', 'branch'), // قراءة الموظفين.
  perm('employees', 'manage', 'organization'), // إدارة الموظفين.
  perm('hr', 'read', 'organization'), // قراءة HR.
  perm('hr', 'manage', 'tenant'), // إدارة HR.
  perm('payroll', 'manage', 'tenant'), // إدارة الرواتب.
  perm('attendance', 'read', 'store'), // قراءة الحضور.
  perm('attendance', 'manage', 'branch'), // إدارة الحضور.
  perm('recruitment', 'manage', 'tenant'), // إدارة التوظيف.
  // ─️ الذكاء الاصطناعي وذكاء الأعمال ──
  perm('ai', 'read', 'organization'), // قراءة رؤى AI.
  perm('ai', 'execute', 'organization'), // تنفيذ إجراء AI (بعد التأكيد).
  perm('ai', 'manage', 'tenant'), // إدارة سياسات/وكلاء AI.
  perm('analytics', 'read', 'organization'), // قراءة التحليلات.
  perm('analytics', 'manage', 'tenant'), // إدارة التحليلات.
  perm('forecasting', 'read', 'organization'), // قراءة التنبؤات.
  // ─️ الأمن والحوكمة ──
  perm('security', 'manage', 'tenant'), // إدارة الأمن.
  perm('security', 'read', 'tenant'), // قراءة إعدادات الأمن.
  perm('users', 'manage', 'tenant'), // إدارة المستخدمين.
  perm('roles', 'manage', 'tenant'), // إدارة الأدوار/الصلاحيات.
  perm('platform', 'manage', 'global'), // إدارة المنصة (مالك المنصة).
  perm('billing', 'manage', 'global'), // إدارة الفوترة/SaaS.
  perm('support', 'manage', 'global'), // دعم المنصة.
];

// خريطة سريعة: مفتاح الإذن → تعريفه.
const catalogByKey = new Map<string, PermissionDefinition>(
  PERMISSION_CATALOG.map((p) => [p.key, p]),
);

// استرجاع نطاق إذن قانوني (يفترض 'store' إن لم يوجد).
export const permissionScope = (key: string): Scope =>
  catalogByKey.get(key)?.scope ?? 'store';
