/**
 * حزم الصلاحيات (Permission Bundles) — صلاحيات قابلة لإعادة الاستخدام.
 * عدة أدوار تشترك في نفس الحزمة أو تضيف عليها، فلا نكرر المنطق (قسم 14).
 */

// صلاحيات الكاشير الأساسية (مثال قسم 14).
export const CASHIER_BUNDLE: readonly string[] = [
  'pos.sale.create', // بيع جديد.
  'pos.cart.read', // قراءة السلة.
  'pos.cart.update', // تعديل السلة.
  'payment.create', // تسجيل دفعة.
  'payment.read', // قراءة الدفعات.
  'receipt.create', // إنشاء إيصال.
  'receipt.read', // قراءة الإيصالات.
  'customer.read', // قراءة العملاء.
  'order.read', // قراءة الطلبات.
  'order.manage', // إدارة الطلبات.
  'products.read', // قراءة المنتجات.
  'inventory.read', // رؤية المخزون (للبيع).
  'attendance.read', // تسجيل/رؤية حضوره.
];

// صلاحيات مدير المتجر (مثال قسم 14) — أوسع نطاقًا على المتجر/الفرع.
export const STORE_MANAGER_BUNDLE: readonly string[] = [
  'pos.*', // كل عمليات نقطة البيع.
  'payment.*', // مدفوعات + استرجاع.
  'receipt.*', // إيصالات.
  'order.*', // طلبات.
  'sales.read', // قراءة المبيعات.
  'sales.manage', // إدارة المبيعات.
  'products.read',
  'products.create',
  'products.update',
  'inventory.read',
  'inventory.adjust', // تسوية مخزون.
  'inventory.transfer', // تحويل مخزون.
  'customer.*', // عملاء.
  'customers.*', // بصيغة الجمع.
  'reports.read',
  'reports.view',
  'employees.read', // رؤية الموظفين.
  'attendance.read',
  'attendance.manage', // إدارة الحضور في المتجر.
  'ai.read', // رؤى ذكاء اصطناعي.
];

// صلاحيات إدارة المنصة/SaaS (نطاق global/tenant).
export const PLATFORM_ADMIN_BUNDLE: readonly string[] = [
  'platform.manage', // إدارة المنصة.
  'billing.manage', // فوترة المشتركين.
  'users.manage', // إدارة المستخدمين.
  'roles.manage', // إدارة الأدوار.
  'support.manage', // دعم فني.
  'security.read', // قراءة الأمن.
  'reports.read',
  'reports.export',
  'audit.read', // قراءة التدقيق.
  'tenant.*', // (wildcard مستقبلي) إدارة المستأجرين.
];

// صلاحيات المؤسسة/الإدارة العليا.
export const ORG_MANAGEMENT_BUNDLE: readonly string[] = [
  'reports.read',
  'reports.view',
  'reports.export',
  'sales.read',
  'sales.manage',
  'finance.read',
  'employees.read',
  'hr.read',
  'analytics.read',
  'ai.read',
  'customers.read',
];

// صلاحيات الكاشير المتقدم/الإشراف على نقاط البيع.
export const POS_SUPERVISOR_BUNDLE: readonly string[] = [
  ...CASHIER_BUNDLE, // كل صلاحيات الكاشير.
  'pos.settings.manage', // إعدادات POS.
  'payment.refund', // استرجاع مدفوعات.
  'orders.manage',
  'reports.read', // تقرير مبيعات مبسط.
  'employees.read',
];

// صلاحيات المالية والمحاسبة.
export const FINANCE_BUNDLE: readonly string[] = [
  'finance.read',
  'finance.manage',
  'finance.approve',
  'accounting.read',
  'accounting.manage',
  'treasury.manage',
  'reports.read',
  'reports.view',
  'reports.export',
  'audit.read',
  'analytics.read',
  'forecasting.read',
];

// صلاحيات المخزون والمستودع.
export const INVENTORY_BUNDLE: readonly string[] = [
  'inventory.read',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.audit',
  'products.read',
  'products.update',
  'reports.read',
];

// صلاحيات إدارة المخزون (مدير).
export const INVENTORY_MANAGER_BUNDLE: readonly string[] = [
  ...INVENTORY_BUNDLE,
  'inventory.manage',
  'products.create',
  'products.update',
  'reports.view',
  'analytics.read',
  'forecasting.read',
];

// صلاحيات المشتريات والموردين.
export const PROCUREMENT_BUNDLE: readonly string[] = [
  'procurement.read',
  'procurement.create',
  'suppliers.read',
  'suppliers.manage',
  'inventory.read',
  'inventory.transfer',
  'reports.read',
];

// صلاحيات إدارة المشتريات (اعتماد وعقود).
export const PROCUREMENT_MANAGER_BUNDLE: readonly string[] = [
  ...PROCUREMENT_BUNDLE,
  'procurement.approve',
  'procurement.manage',
  'contracts.manage',
  'reports.view',
  'finance.read',
];

// صلاحيات المبيعات وCRM.
export const SALES_CRM_BUNDLE: readonly string[] = [
  'sales.read',
  'sales.manage',
  'customer.read',
  'customer.manage',
  'customers.read',
  'customers.manage',
  'crm.read',
  'crm.manage',
  'loyalty.manage',
  'orders.read',
  'orders.manage',
  'reports.read',
  'analytics.read',
];

// صلاحيات الموارد البشرية.
export const HR_BUNDLE: readonly string[] = [
  'hr.read',
  'employees.read',
  'employees.manage',
  'attendance.read',
  'attendance.manage',
  'payroll.manage',
  'recruitment.manage',
  'reports.read',
  'finance.read',
];

// صلاحيات الذكاء الاصطناعي وذكاء الأعمال.
export const AI_BUNDLE: readonly string[] = [
  'ai.read',
  'ai.execute',
  'analytics.read',
  'analytics.manage',
  'forecasting.read',
  'reports.read',
  'reports.view',
  'reports.export',
  'sales.read',
  'finance.read',
  'inventory.read',
];

// صلاحيات الأمن والتدقيق.
export const SECURITY_AUDIT_BUNDLE: readonly string[] = [
  'security.read',
  'security.manage',
  'audit.read',
  'users.manage',
  'roles.manage',
  'reports.read',
  'reports.export',
  'finance.read',
];

// صلاحيات القراءة المحدودة للعملاء/الموردين/الشركاء (مستخدمون خارجيون).
export const EXTERNAL_READ_BUNDLE: readonly string[] = [
  'orders.read', // رؤية طلباته فقط (own scope).
  'customer.read',
];
