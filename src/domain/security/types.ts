/**
 * أنواع نموذج RBAC — أقسام 14 و15 و64.
 * User → Role → Permissions → Policies → Resources → Actions.
 * الدور لا يحتوي منطق أعمال؛ الدور فقط يجمع أذونات.
 */
import type { ID, Auditable } from '@/core/types/domain';
import type { Scope } from './scopes';

// فعل (Action) ممكن تنفيذه على مورد.
export type Action =
  | 'read' // قراءة/عرض.
  | 'create' // إنشاء.
  | 'update' // تعديل.
  | 'delete' // حذف.
  | 'manage' // إدارة شاملة (يعادل كل الأفعال على المورد).
  | 'approve' // اعتماد.
  | 'export' // تصدير بيانات.
  | 'execute'; // تنفيذ إجراء خاص (مثل: AI action).

// الإذن (Permission): مورد + فعل + نطاق تغطية.
export interface Permission {
  id: ID; // معرف الإذن.
  resource: string; // المورد (pos, inventory, reports, ai…).
  action: Action | string; // الفعل.
  scope: Scope; // النطاق الافتراضي للإذن.
  description?: string; // وصف بشري.
}

// الدور (Role): يجمع قائمة أذونات (قد تتضمن wildcards مثل 'reports.*').
export interface Role {
  id: ID; // معرف الدور.
  code: RoleCode; // كود ثابت للدور (cashier, store-manager…).
  nameAr: string; // الاسم بالعربية.
  nameEn: string; // الاسم بالإنجليزية.
  category: RoleCategory; // فئة الدور العشرية.
  scope: Scope; // النطاق الأقصى للدور.
  permissions: readonly string[]; // صلاحيات الدور (صيغة 'resource.action' أو 'resource.*').
  isSystem?: boolean; // دور نظام لا يُحذف.
}

// ربط المستخدم بالأدوار (مستخدم قد يملك عدة أدوار).
export interface UserRole extends Auditable {
  id: ID; // معرف الربط.
  userId: ID; // المستخدم.
  roleId: ID; // الدور.
  scopeOverride?: Scope; // تضييق نطاق الدور لهذا المستخدم إن لزم.
}

// سياسة (Policy): قاعدة تفويض أعلى من الإذن المباشر (شروط/حدود).
export interface Policy {
  id: ID; // معرف السياسة.
  name: string; // اسم السياسة.
  permission: string; // الإذن الذي تنظّمه (مثل: refund.create).
  effect: 'allow' | 'deny'; // السماح أو المنع الصريح.
  conditions?: {
    maxAmount?: number; // سقف مالي (مثلاً: استرجاع حتى 50,000 بدون اعتماد).
    requireApproval?: boolean; // يتطلب اعتمادًا.
    businessHoursOnly?: boolean; // خلال ساعات العمل فقط.
  };
}

// كود الدور: يولَّد من فئته ورقمه (مثال: cashier, store-manager).
export type RoleCode = string;

// فئات الأدوار العشر (الأقسام 04–13).
export type RoleCategory =
  | 'platform' // المنصة/SaaS.
  | 'organization' // المؤسسة والمتجر.
  | 'pos' // الكاشير ونقاط البيع.
  | 'finance' // المالية والمحاسبة.
  | 'inventory' // المخزون والمستودع.
  | 'procurement' // المشتريات والموردين.
  | 'sales' // المبيعات وCRM.
  | 'hr' // الموارد البشرية.
  | 'ai' // الذكاء الاصطناعي وذكاء الأعمال.
  | 'security'; // الأمن والتدقيق ومستخدمون خارجيون.

// نتيجة قرار التفويض (للاستخدام في الشاشات والإجراءات).
export interface AuthorizationResult {
  allowed: boolean; // مسموح أم لا.
  reason?: string; // سبب المنع إن وُجد.
  matchedPermission?: string; // الإذن الذي طابق (للتدقيق).
}
