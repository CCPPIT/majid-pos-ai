/**
 * نطاق البيانات متعدد المستأجرين (Multi-Tenant Scoping) — قسم 16.
 * كل كيان تجاري مرتبط بـ tenantId/organizationId/branchId/storeId.
 * هذا الملف يحسب "نطاق الاستعلام" الذي تُفلتر به البيانات حسب دور المستخدم.
 */
import type { ID, ScopeContext, TenantScoped } from '@/core/types/domain'; // أنواع المعرفات والسياق.
import type { Scope } from '@/domain/security/scopes'; // نطاق الدور (own…global).
import { SCOPE_RANK } from '@/domain/security/scopes'; // رتب النطاقات للمقارنة.

// السياق النشط: الكيان المختار حاليًا (المتجر/الفرع…) مع أسماء للعرض.
export interface ActiveTenancyContext {
  tenantId: ID; // معرف المستأجر.
  tenantName: string; // اسم المستأجر.
  organizationId: ID; // معرف المؤسسة.
  organizationName: string; // اسم المؤسسة.
  branchId: ID; // معرف الفرع.
  branchName: string; // اسم الفرع.
  storeId: ID; // معرف المتجر النشط.
  storeName: string; // اسم المتجر النشط.
  storeCode: string; // كود المتجر.
  currency: string; // عملة المتجر.
  taxRatePercent: number; // نسبة ضريبة المتجر.
}

// سياق استعلام البيانات: الحقول التي يجب المطابقة عليها.
export interface QueryScope {
  tenantId: ID; // المطابقة على المستأجر دائمًا (عزل بين المستأجرين).
  organizationId?: ID; // أضِف عند نطاق مؤسسة أو أضيق.
  branchId?: ID; // أضِف عند نطاق فرع أو أضيق.
  storeId?: ID; // أضِف عند نطاق متجر.
}

/**
 * يحوّل السياق النشط إلى سياق خام (معرفات فقط) يستخدم في الكيانات.
 */
export const toScopeContext = (ctx: ActiveTenancyContext): ScopeContext => ({
  tenantId: ctx.tenantId, // المستأجر.
  organizationId: ctx.organizationId, // المؤسسة.
  branchId: ctx.branchId, // الفرع.
  storeId: ctx.storeId, // المتجر.
});

/**
 * يبني نطاق الاستعلام حسب النطاق الأقصى لدور المستخدم.
 * القاعدة: كلما ضاق نطاق الدور زادت حقول المطابقة (تضييق للبيانات).
 */
export const buildQueryScope = (ctx: ActiveTenancyContext, userScope: Scope): QueryScope => {
  // نبدأ بالمستأجر (العزل الأساسي بين الحسابات).
  const scope: QueryScope = { tenantId: ctx.tenantId };
  // نطاق المؤسسة أو أضيق → نطابق المؤسسة.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.organization) scope.organizationId = ctx.organizationId;
  // نطاق الفرع أو أضيق → نطابق الفرع.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.branch) scope.branchId = ctx.branchId;
  // نطاق المتجر أو own → نطابق المتجر النشط تحديدًا.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.store) scope.storeId = ctx.storeId;
  // نعيد النطاق المحسوب.
  return scope;
};

/**
 * يختبر هل كيان معيّن يقع داخل نطاق الاستخدام (يُستخدم في المستودعات لاحقًا).
 * نقارن فقط الحقول الموجودة في نطاق الاستعلام.
 */
export const matchesQueryScope = <T extends TenantScoped>(item: T, scope: QueryScope): boolean => {
  // المستأجر يجب أن يتطابق دائمًا.
  if (item.tenantId !== scope.tenantId) return false;
  // إن طُلبت مؤسسة ولم تتطابق نرفض.
  if (scope.organizationId && item.organizationId !== scope.organizationId) return false;
  // إن طُلب فرع ولم يتطابق نرفض.
  if (scope.branchId && item.branchId !== scope.branchId) return false;
  // إن طُلب متجر ولم يتطابق نرفض.
  if (scope.storeId && item.storeId !== scope.storeId) return false;
  // كل الشروط نجحت.
  return true;
};

/**
 * يفلتر قائمة كيانات according to النطاق (تسهيل للمستودعات والشاشات).
 */
export const filterByScope = <T extends TenantScoped>(items: readonly T[], scope: QueryScope): T[] =>
  items.filter((item) => matchesQueryScope(item, scope));
