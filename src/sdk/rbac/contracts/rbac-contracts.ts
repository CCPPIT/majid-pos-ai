/**
 * عقود التحكم بالصلاحيات (RBAC) — PHASE 31 · قسم 12.
 * النموذج: مستخدم ← أدوار ← أذونات ← سياسات ← موارد/أفعال، مع نطاق تغطية
 * سداسي: own · store · branch · organization · tenant · global.
 * الـSDK يستهلك هذه العقود قبل كل عملية حسّاسة (قسم 57).
 */
import type { PermissionId, RoleId } from '@/sdk/core';

// نطاق تغطية الإذن من الأضيق إلى الأوسع.
export type PermissionScope = 'own' | 'store' | 'branch' | 'organization' | 'tenant' | 'global';

// الأفعال القياسية على الموارد.
export type PermissionAction =
  | 'read' // قراءة/عرض.
  | 'create' // إنشاء.
  | 'update' // تعديل.
  | 'delete' // حذف.
  | 'manage' // إدارة شاملة (تعادل كل الأفعال على المورد).
  | 'approve' // اعتماد.
  | 'export' // تصدير.
  | 'execute'; // تنفيذ إجراء خاص (إجراء ذكاء اصطناعي مثلًا).

// رتبة كل نطاق (الأكبر يغطي الأصغر).
export const SCOPE_RANK: Readonly<Record<PermissionScope, number>> = Object.freeze({
  own: 0, // بيانات المستخدم نفسه.
  store: 1, // متجر واحد.
  branch: 2, // فرع يضم متاجر.
  organization: 3, // مؤسسة تضم فروعًا.
  tenant: 4, // المستأجر كاملًا.
  global: 5, // المنصة كلها.
});

// كل النطاقات مرتبة تصاعديًا (للعرض والتحقق).
export const ALL_SCOPES: readonly PermissionScope[] = Object.freeze([
  'own',
  'store',
  'branch',
  'organization',
  'tenant',
  'global',
]);

// تعريف إذن قانوني واحد.
export interface Permission {
  readonly id: PermissionId; // معرّف الإذن.
  readonly resource: string; // المورد (pos.sale · inventory · reports…).
  readonly action: PermissionAction | string; // الفعل.
  readonly scope: PermissionScope; // النطاق الافتراضي.
  readonly descriptionKey?: string; // مفتاح وصف بشري.
}

// دور يجمع أذونات (قد تحتوي بدائل مثل 'reports.*').
export interface Role {
  readonly id: RoleId; // معرّف الدور.
  readonly code: string; // كوده الثابت (cashier · store-manager…).
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly scope: PermissionScope; // النطاق الأقصى للدور.
  readonly permissions: readonly string[]; // صلاحياته بصيغة 'resource.action'.
  readonly isSystem: boolean; // دور نظام غير قابل للحذف.
}

// طلب فحص صلاحية (الصيغة المعتمدة في قسم 12).
export interface AuthorizationRequest {
  readonly resource: string; // المورد المستهدف.
  readonly action: PermissionAction | string; // الفعل المطلوب.
  readonly scope?: PermissionScope; // النطاق المطلوب (يُشتق إن تُرك).
}

// قرار التفويض مع سببه (للتدقيق وعرض رسالة دقيقة).
export interface AuthorizationDecision {
  readonly allowed: boolean; // مسموح؟
  readonly reason?: 'PERMISSION_DENIED' | 'SCOPE_DENIED' | 'POLICY_DENIED'; // سبب المنع.
  readonly matchedPermission?: string; // الإذن الذي طابق (عند السماح).
  readonly requiredScope?: PermissionScope; // النطاق الذي طُلب.
}

// أثر السياسة: سماح صريح أو منع صريح.
export type PolicyEffect = 'allow' | 'deny';

// شروط السياسة (حدود مالية/اعتماد/ساعات عمل).
export interface PolicyConditions {
  readonly maxAmount?: number; // سقف مالي للعملية.
  readonly requireApproval?: boolean; // يتطلب اعتماد جهة أعلى.
  readonly businessHoursOnly?: boolean; // خلال ساعات العمل فقط.
}

// سياسة تفويض أعلى من الإذن المباشر.
export interface Policy {
  readonly id: string; // معرّف السياسة.
  readonly name: string; // اسمها.
  readonly permission: string; // الإذن الذي تنظّمه.
  readonly effect: PolicyEffect; // السماح أو المنع.
  readonly conditions?: PolicyConditions; // شروط التطبيق.
}

// سياق تقييم السياسة (قيم العملية الجارية).
export interface PolicyEvaluationContext {
  readonly amount?: number; // مبلغ العملية إن وُجد.
  readonly hasApproval?: boolean; // هل حصلت على اعتماد؟
  readonly isBusinessHours?: boolean; // هل الوقت ضمن الدوام؟
}
