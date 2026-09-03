/**
 * فهرس الأدوار الـ100 (أقسام 04–13).
 * كل دور: كود ثابت + اسم عربي/إنجليزي + فئة + نطاق أقصى + حزمة صلاحيات.
 * الأدوار تشترك في الشاشات؛ الاختلاف في الأذونات والنطاق والعناصر الظاهرة.
 */
import type { Role } from './types';
import {
  AI_BUNDLE, // حزمة الذكاء الاصطناعي.
  CASHIER_BUNDLE, // حزمة الكاشير.
  EXTERNAL_READ_BUNDLE, // حزمة المستخدم الخارجي.
  FINANCE_BUNDLE, // حزمة المالية.
  HR_BUNDLE, // حزمة الموارد البشرية.
  INVENTORY_BUNDLE, // حزمة المخزون.
  INVENTORY_MANAGER_BUNDLE, // حزمة مدير المخزون.
  ORG_MANAGEMENT_BUNDLE, // حزمة إدارة المؤسسة.
  PLATFORM_ADMIN_BUNDLE, // حزمة إدارة المنصة.
  POS_SUPERVISOR_BUNDLE, // حزمة إشراف نقاط البيع.
  PROCUREMENT_BUNDLE, // حزمة المشتريات.
  PROCUREMENT_MANAGER_BUNDLE, // حزمة مدير المشتريات.
  SALES_CRM_BUNDLE, // حزمة المبيعات وCRM.
  SECURITY_AUDIT_BUNDLE, // حزمة الأمن والتدقيق.
  STORE_MANAGER_BUNDLE, // حزمة مدير المتجر.
} from './permission-bundles';

// أداة بناء دور مختصرة لتفادي التكرار في تعريف 100 دور.
let seq = 0; // عدّاد داخلي لتوليد معرف فريد.
const role = (
  code: Role['code'], // كود الدور الثابت.
  nameAr: string, // الاسم العربي.
  nameEn: string, // الاسم الإنجليزي.
  category: Role['category'], // الفئة.
  scope: Role['scope'], // النطاق الأقصى.
  permissions: readonly string[], // صلاحيات الدور.
): Role => ({
  id: `role-${code}-${seq++}` as Role['id'], // معرف فريد مبني على الكود.
  code,
  nameAr,
  nameEn,
  category,
  scope,
  permissions,
  isSystem: true, // كل أدوار النظام الـ100 أدوار أساسية.
});

// قائمة الأدوار الـ100 بالترتيب المعتمد في الموجهات.
export const ROLES: readonly Role[] = [
  // ── 04 المنصة وإدارة SaaS (1–10) ──
  role('platform-owner', 'مالك المنصة', 'Platform Owner', 'platform', 'global', ['*']), // 01 صلاحية مطلقة.
  role('super-admin', 'المدير الأعلى', 'Super Admin', 'platform', 'global', ['*']), // 02 صلاحية مطلقة.
  role('platform-administrator', 'مدير المنصة', 'Platform Administrator', 'platform', 'global', PLATFORM_ADMIN_BUNDLE), // 03.
  role('operations-manager', 'مدير العمليات', 'Operations Manager', 'platform', 'global', PLATFORM_ADMIN_BUNDLE), // 04.
  role('system-administrator', 'مدير النظام', 'System Administrator', 'platform', 'tenant', ['security.manage', 'users.manage', 'roles.manage', 'platform.manage', 'reports.read']), // 05.
  role('security-administrator', 'مسؤول الأمن', 'Security Administrator', 'security', 'tenant', SECURITY_AUDIT_BUNDLE), // 06.
  role('compliance-officer', 'مسؤول الامتثال', 'Compliance Officer', 'security', 'tenant', ['audit.read', 'security.read', 'reports.read', 'reports.export']), // 07.
  role('support-administrator', 'مدير الدعم', 'Support Administrator', 'platform', 'global', ['support.manage', 'users.manage', 'reports.read']), // 08.
  role('saas-manager', 'مدير SaaS', 'SaaS Manager', 'platform', 'global', ['billing.manage', 'platform.manage', 'reports.read', 'reports.export', 'users.manage']), // 09.
  role('tenant-administrator', 'مدير المستأجر', 'Tenant Administrator', 'platform', 'tenant', ['users.manage', 'roles.manage', 'reports.read', 'security.read', 'billing.manage']), // 10.

  // ── 05 المؤسسة والمتجر (11–20) ──
  role('organization-owner', 'مالك المؤسسة', 'Organization Owner', 'organization', 'tenant', ['*']), // 11 مطلق داخل المستأجر.
  role('organization-administrator', 'مدير المؤسسة', 'Organization Administrator', 'organization', 'tenant', ORG_MANAGEMENT_BUNDLE.concat(['users.manage', 'roles.manage'])), // 12.
  role('general-manager', 'المدير العام', 'General Manager', 'organization', 'organization', ORG_MANAGEMENT_BUNDLE.concat(['finance.manage', 'hr.manage', 'procurement.approve'])), // 13.
  role('regional-manager', 'المدير الإقليمي', 'Regional Manager', 'organization', 'organization', ORG_MANAGEMENT_BUNDLE.concat(['sales.manage', 'inventory.read', 'reports.export'])), // 14.
  role('area-manager', 'مدير المنطقة', 'Area Manager', 'organization', 'branch', ORG_MANAGEMENT_BUNDLE.concat(['sales.manage', 'employees.read'])), // 15.
  role('branch-manager', 'مدير الفرع', 'Branch Manager', 'organization', 'branch', STORE_MANAGER_BUNDLE.concat(['employees.manage', 'reports.export', 'inventory.audit'])), // 16.
  role('store-manager', 'مدير المتجر', 'Store Manager', 'organization', 'store', STORE_MANAGER_BUNDLE), // 17.
  role('assistant-store-manager', 'مساعد مدير المتجر', 'Assistant Store Manager', 'organization', 'store', STORE_MANAGER_BUNDLE.filter((p) => !p.includes('delete') && p !== 'reports.export')), // 18 صلاحيات مدير المتجر عدا الحذف/التصدير.
  role('department-manager', 'مدير القسم', 'Department Manager', 'organization', 'store', ['pos.read', 'inventory.read', 'reports.read', 'employees.read', 'sales.read']), // 19.
  role('shift-manager', 'مدير الوردية', 'Shift Manager', 'pos', 'store', POS_SUPERVISOR_BUNDLE), // 20.

  // ── 06 نقاط البيع والكاشير (21–30) ──
  role('pos-administrator', 'مدير نظام الكاشير', 'POS Administrator', 'pos', 'branch', ['pos.*', 'payment.*', 'receipt.*', 'reports.read', 'employees.read', 'pos.settings.manage']), // 21.
  role('pos-manager', 'مدير نقاط البيع', 'POS Manager', 'pos', 'branch', POS_SUPERVISOR_BUNDLE.concat(['pos.settings.manage', 'reports.view'])), // 22.
  role('head-cashier', 'رئيس الكاشير', 'Head Cashier', 'pos', 'store', POS_SUPERVISOR_BUNDLE), // 23.
  role('cashier', 'كاشير', 'Cashier', 'pos', 'store', CASHIER_BUNDLE), // 24.
  role('assistant-cashier', 'مساعد كاشير', 'Assistant Cashier', 'pos', 'store', CASHIER_BUNDLE.filter((p) => p !== 'payment.create').concat(['payment.read'])), // 25 بيع دون تسجيل دفعة مستقلة.
  role('self-service-operator', 'مسؤول الخدمة الذاتية', 'Self-Service Operator', 'pos', 'store', ['pos.sale.create', 'pos.cart.read', 'pos.cart.update', 'payment.create', 'receipt.create', 'products.read']), // 26.
  role('checkout-supervisor', 'مشرف الدفع', 'Checkout Supervisor', 'pos', 'store', POS_SUPERVISOR_BUNDLE), // 27.
  role('cash-office-manager', 'مدير مكتب النقدية', 'Cash Office Manager', 'finance', 'branch', ['treasury.manage', 'payment.read', 'payment.refund', 'reports.read', 'finance.read']), // 28.
  role('cash-controller', 'مراقب النقدية', 'Cash Controller', 'finance', 'branch', ['treasury.manage', 'payment.read', 'audit.read', 'reports.read']), // 29.
  role('pos-support-officer', 'مسؤول دعم الكاشير', 'POS Support Officer', 'pos', 'branch', ['pos.support.manage', 'pos.settings.manage', 'reports.read', 'products.read']), // 30.

  // ── 07 المالية والمحاسبة (31–40) ──
  role('cfo', 'المدير المالي', 'CFO', 'finance', 'tenant', FINANCE_BUNDLE.concat(['finance.approve', 'hr.read', 'contracts.manage'])), // 31.
  role('finance-manager', 'مدير المالية', 'Finance Manager', 'finance', 'organization', FINANCE_BUNDLE), // 32.
  role('chief-accountant', 'رئيس الحسابات', 'Chief Accountant', 'finance', 'organization', FINANCE_BUNDLE.filter((p) => p !== 'finance.approve').concat(['accounting.manage'])), // 33.
  role('accountant', 'محاسب', 'Accountant', 'finance', 'organization', ['accounting.read', 'accounting.manage', 'finance.read', 'reports.read', 'payment.read']), // 34.
  role('junior-accountant', 'محاسب مبتدئ', 'Junior Accountant', 'finance', 'organization', ['accounting.read', 'finance.read', 'reports.read']), // 35.
  role('ar-officer', 'مسؤول الذمم المدينة', 'Accounts Receivable Officer', 'finance', 'organization', ['finance.read', 'accounting.read', 'customer.read', 'reports.read', 'payment.read']), // 36.
  role('ap-officer', 'مسؤول الذمم الدائنة', 'Accounts Payable Officer', 'finance', 'organization', ['finance.read', 'accounting.read', 'suppliers.read', 'reports.read', 'payment.read']), // 37.
  role('treasurer', 'أمين الخزينة', 'Treasurer', 'finance', 'organization', ['treasury.manage', 'finance.read', 'payment.read', 'reports.read']), // 38.
  role('financial-controller', 'المراقب المالي', 'Financial Controller', 'finance', 'tenant', ['finance.read', 'finance.approve', 'audit.read', 'reports.read', 'reports.export']), // 39.
  role('internal-auditor', 'المدقق الداخلي', 'Internal Auditor', 'security', 'tenant', ['audit.read', 'finance.read', 'reports.read', 'reports.export', 'security.read']), // 40.

  // ── 08 المخزون والمستودع (41–50) ──
  role('inventory-manager', 'مدير المخزون', 'Inventory Manager', 'inventory', 'organization', INVENTORY_MANAGER_BUNDLE), // 41.
  role('inventory-controller', 'مراقب المخزون', 'Inventory Controller', 'inventory', 'branch', INVENTORY_BUNDLE), // 42.
  role('warehouse-manager', 'مدير المستودع', 'Warehouse Manager', 'inventory', 'branch', INVENTORY_MANAGER_BUNDLE), // 43.
  role('warehouse-supervisor', 'مشرف المستودع', 'Warehouse Supervisor', 'inventory', 'branch', INVENTORY_BUNDLE.concat(['inventory.transfer'])), // 44.
  role('warehouse-operator', 'عامل المستودع', 'Warehouse Operator', 'inventory', 'store', ['inventory.read', 'inventory.adjust', 'products.read']), // 45.
  role('stock-clerk', 'أمين المخزون', 'Stock Clerk', 'inventory', 'store', ['inventory.read', 'products.read', 'inventory.adjust']), // 46.
  role('receiving-officer', 'مسؤول الاستلام', 'Receiving Officer', 'inventory', 'store', ['inventory.read', 'inventory.adjust', 'procurement.read', 'products.read']), // 47.
  role('stock-auditor', 'مدقق المخزون', 'Stock Auditor', 'inventory', 'organization', ['inventory.audit', 'inventory.read', 'reports.read', 'audit.read']), // 48.
  role('stock-transfer-officer', 'مسؤول نقل المخزون', 'Stock Transfer Officer', 'inventory', 'branch', ['inventory.transfer', 'inventory.read', 'products.read']), // 49.
  role('inventory-analyst', 'محلل المخزون', 'Inventory Analyst', 'inventory', 'organization', ['inventory.read', 'analytics.read', 'forecasting.read', 'reports.read']), // 50.

  // ── 09 المشتريات والموردين (51–60) ──
  role('procurement-manager', 'مدير المشتريات', 'Procurement Manager', 'procurement', 'organization', PROCUREMENT_MANAGER_BUNDLE), // 51.
  role('procurement-officer', 'مسؤول المشتريات', 'Procurement Officer', 'procurement', 'organization', PROCUREMENT_BUNDLE), // 52.
  role('purchasing-officer', 'مسؤول الشراء', 'Purchasing Officer', 'procurement', 'organization', PROCUREMENT_BUNDLE), // 53.
  role('buyer', 'المشتري', 'Buyer', 'procurement', 'organization', ['procurement.read', 'procurement.create', 'suppliers.read', 'inventory.read']), // 54.
  role('procurement-analyst', 'محلل المشتريات', 'Procurement Analyst', 'procurement', 'organization', ['procurement.read', 'analytics.read', 'reports.read', 'forecasting.read']), // 55.
  role('supplier-manager', 'مدير الموردين', 'Supplier Manager', 'procurement', 'organization', ['suppliers.manage', 'suppliers.read', 'contracts.manage', 'reports.read']), // 56.
  role('supplier-officer', 'مسؤول الموردين', 'Supplier Officer', 'procurement', 'organization', ['suppliers.read', 'suppliers.manage', 'procurement.read']), // 57.
  role('purchase-order-manager', 'مدير أوامر الشراء', 'Purchase Order Manager', 'procurement', 'organization', ['procurement.manage', 'procurement.create', 'procurement.approve', 'inventory.read']), // 58.
  role('contract-manager', 'مدير العقود', 'Contract Manager', 'procurement', 'tenant', ['contracts.manage', 'suppliers.read', 'finance.read', 'reports.read']), // 59.
  role('vendor-auditor', 'مدقق الموردين', 'Vendor Auditor', 'procurement', 'organization', ['suppliers.read', 'audit.read', 'procurement.read', 'reports.read']), // 60.

  // ── 10 المبيعات وCRM والعملاء (61–70) ──
  role('sales-director', 'مدير المبيعات', 'Sales Director', 'sales', 'organization', SALES_CRM_BUNDLE.concat(['reports.export', 'finance.read', 'hr.read'])), // 61.
  role('sales-manager', 'مدير المبيعات', 'Sales Manager', 'sales', 'organization', SALES_CRM_BUNDLE), // 62.
  role('sales-supervisor', 'مشرف المبيعات', 'Sales Supervisor', 'sales', 'branch', SALES_CRM_BUNDLE.filter((p) => p !== 'loyalty.manage')), // 63.
  role('sales-representative', 'مندوب مبيعات', 'Sales Representative', 'sales', 'store', ['sales.read', 'customer.read', 'customer.manage', 'orders.read', 'orders.manage']), // 64.
  role('sales-agent', 'وكيل مبيعات', 'Sales Agent', 'sales', 'store', ['sales.read', 'customer.read', 'orders.read']), // 65.
  role('customer-success-manager', 'مدير نجاح العملاء', 'Customer Success Manager', 'sales', 'organization', ['crm.read', 'crm.manage', 'customer.read', 'customer.manage', 'loyalty.manage', 'reports.read']), // 66.
  role('customer-service-manager', 'مدير خدمة العملاء', 'Customer Service Manager', 'sales', 'organization', ['crm.read', 'customer.read', 'customer.manage', 'reports.read']), // 67.
  role('customer-service-agent', 'موظف خدمة العملاء', 'Customer Service Agent', 'sales', 'store', ['customer.read', 'crm.read', 'orders.read']), // 68.
  role('crm-manager', 'مدير CRM', 'CRM Manager', 'sales', 'organization', ['crm.read', 'crm.manage', 'customer.read', 'customers.read', 'analytics.read', 'reports.read']), // 69.
  role('loyalty-manager', 'مدير الولاء', 'Loyalty Manager', 'sales', 'organization', ['loyalty.manage', 'customer.read', 'crm.read', 'reports.read']), // 70.

  // ── 11 الموارد البشرية (71–80) ──
  role('hr-director', 'مدير الموارد البشرية', 'HR Director', 'hr', 'tenant', HR_BUNDLE.concat(['hr.manage', 'payroll.manage', 'recruitment.manage', 'reports.export'])), // 71.
  role('hr-manager', 'مدير الموارد البشرية', 'HR Manager', 'hr', 'organization', HR_BUNDLE), // 72.
  role('hr-officer', 'مسؤول الموارد البشرية', 'HR Officer', 'hr', 'organization', ['hr.read', 'employees.read', 'employees.manage', 'attendance.read', 'reports.read']), // 73.
  role('recruitment-manager', 'مدير التوظيف', 'Recruitment Manager', 'hr', 'tenant', ['recruitment.manage', 'hr.read', 'employees.read', 'reports.read']), // 74.
  role('recruiter', 'مسؤول التوظيف', 'Recruiter', 'hr', 'organization', ['recruitment.manage', 'hr.read', 'employees.read']), // 75.
  role('payroll-manager', 'مدير الرواتب', 'Payroll Manager', 'hr', 'tenant', ['payroll.manage', 'hr.read', 'finance.read', 'attendance.read', 'reports.read']), // 76.
  role('payroll-officer', 'مسؤول الرواتب', 'Payroll Officer', 'hr', 'organization', ['payroll.manage', 'attendance.read', 'employees.read', 'finance.read']), // 77.
  role('attendance-manager', 'مدير الحضور', 'Attendance Manager', 'hr', 'branch', ['attendance.read', 'attendance.manage', 'employees.read', 'reports.read']), // 78.
  role('workforce-manager', 'مدير القوى العاملة', 'Workforce Manager', 'hr', 'organization', ['hr.read', 'attendance.manage', 'employees.read', 'employees.manage', 'reports.read']), // 79.
  role('employee', 'موظف', 'Employee', 'hr', 'own', ['attendance.read', 'hr.read', 'pos.read']), // 80 نطاق own (بياناته هو).

  // ── 12 الذكاء الاصطناعي وذكاء الأعمال (81–90) ──
  role('ai-administrator', 'مدير الذكاء الاصطناعي', 'AI Administrator', 'ai', 'tenant', AI_BUNDLE.concat(['ai.manage', 'roles.read'])), // 81.
  role('ai-manager', 'مدير حلول الذكاء الاصطناعي', 'AI Manager', 'ai', 'organization', AI_BUNDLE.concat(['ai.manage'])), // 82.
  role('ai-analyst', 'محلل الذكاء الاصطناعي', 'AI Analyst', 'ai', 'organization', ['ai.read', 'analytics.read', 'forecasting.read', 'reports.read']), // 83.
  role('ai-copilot-user', 'مستخدم مساعد AI', 'AI Copilot User', 'ai', 'store', ['ai.read', 'ai.execute', 'sales.read', 'inventory.read', 'reports.read']), // 84.
  role('bi-manager', 'مدير ذكاء الأعمال', 'Business Intelligence Manager', 'ai', 'organization', ['analytics.read', 'analytics.manage', 'reports.read', 'reports.view', 'reports.export', 'forecasting.read']), // 85.
  role('business-analyst', 'محلل أعمال', 'Business Analyst', 'ai', 'organization', ['analytics.read', 'reports.read', 'reports.view', 'sales.read', 'finance.read']), // 86.
  role('data-analyst', 'محلل بيانات', 'Data Analyst', 'ai', 'organization', ['analytics.read', 'reports.read', 'reports.export', 'forecasting.read']), // 87.
  role('forecasting-analyst', 'محلل التنبؤ', 'Forecasting Analyst', 'ai', 'organization', ['forecasting.read', 'analytics.read', 'inventory.read', 'reports.read']), // 88.
  role('revenue-analyst', 'محلل الإيرادات', 'Revenue Analyst', 'ai', 'organization', ['sales.read', 'finance.read', 'analytics.read', 'reports.read', 'forecasting.read']), // 89.
  role('decision-intelligence-manager', 'مدير ذكاء القرار', 'Decision Intelligence Manager', 'ai', 'tenant', AI_BUNDLE.concat(['analytics.manage', 'reports.export'])), // 90.

  // ── 13 الأمن والتدقيق والمستخدمون الخارجيون (91–100) ──
  role('security-manager', 'مدير الأمن', 'Security Manager', 'security', 'tenant', SECURITY_AUDIT_BUNDLE), // 91.
  role('risk-manager', 'مدير المخاطر', 'Risk Manager', 'security', 'tenant', ['security.read', 'audit.read', 'analytics.read', 'reports.read', 'finance.read']), // 92.
  role('fraud-analyst', 'محلل الاحتيال', 'Fraud Analyst', 'security', 'organization', ['audit.read', 'security.read', 'payment.read', 'reports.read']), // 93.
  role('audit-manager', 'مدير التدقيق', 'Audit Manager', 'security', 'tenant', ['audit.read', 'reports.read', 'reports.export', 'security.read', 'finance.read']), // 94.
  role('compliance-manager', 'مدير الامتثال', 'Compliance Manager', 'security', 'tenant', ['audit.read', 'security.read', 'reports.read', 'reports.export']), // 95.
  role('data-protection-officer', 'مسؤول حماية البيانات', 'Data Protection Officer', 'security', 'tenant', ['security.read', 'security.manage', 'audit.read', 'reports.read']), // 96.
  role('external-auditor', 'مدقق خارجي', 'External Auditor', 'security', 'tenant', ['audit.read', 'finance.read', 'reports.read', 'reports.export']), // 97.
  role('customer', 'عميل', 'Customer', 'security', 'own', EXTERNAL_READ_BUNDLE), // 98 نطاق own.
  role('supplier-user', 'مستخدم المورد', 'Supplier User', 'security', 'own', ['procurement.read', 'suppliers.read']), // 99 نطاق own.
  role('partner', 'شريك', 'Partner', 'security', 'organization', ['reports.read', 'analytics.read', 'sales.read']), // 100.
];

// خريطة سريعة: كود الدور → تعريف الدور.
export const ROLE_BY_CODE: ReadonlyMap<string, Role> = new Map(
  ROLES.map((r) => [r.code, r]),
);

// استرجاع دور بالكود (يرجع undefined إن لم يوجد).
export const getRoleByCode = (code: string): Role | undefined => ROLE_BY_CODE.get(code);
