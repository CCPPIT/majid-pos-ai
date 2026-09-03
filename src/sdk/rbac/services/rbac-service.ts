/**
 * خدمة الصلاحيات في الـSDK — PHASE 31 · قسم 12.
 * الواجهة المطلوبة: getRoles · getPermissions · hasPermission · hasAnyPermission
 * · hasAllPermissions · can. الخدمة تقرأ السياق ولا تحتفظ بحالة خاصة بها.
 */
import { success, type Result, type SDKContextStore } from '@/sdk/core';
import type { RbacRepository } from '../contracts/rbac-repository';
import {
  authorize,
  collectPermissions,
  effectiveScope,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '../authorization/authorization';
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  PermissionScope,
  Policy,
  PolicyEvaluationContext,
  Role,
} from '../contracts/rbac-contracts';

// الواجهة العلنية لخدمة الصلاحيات (ما تراه الشاشات عبر sdk.rbac).
export interface RbacService {
  // يقرأ أدوار المستخدم الحالي من السياق.
  getRoles(): Promise<Result<readonly Role[]>>;
  // يقرأ صلاحياته المسطّحة.
  getPermissions(): Promise<Result<readonly string[]>>;
  // هل يملك إذنًا محددًا؟
  hasPermission(permission: string): boolean;
  // هل يملك أيًّا من قائمة أذونات؟
  hasAnyPermission(permissions: readonly string[]): boolean;
  // هل يملك كل قائمة أذونات؟
  hasAllPermissions(permissions: readonly string[]): boolean;
  // القرار الكامل لعملية (مورد + فعل + نطاق) مع السياسات.
  can(request: AuthorizationRequest, policyContext?: PolicyEvaluationContext): Promise<Result<AuthorizationDecision>>;
  // النطاق الأقصى الفعّال للمستخدم الحالي.
  getScope(): Promise<PermissionScope>;
}

// تبعيات الخدمة (تُحقن من عميل الـSDK — لا استيراد مباشر لتنفيذ).
export interface RbacServiceDependencies {
  readonly repository: RbacRepository; // مستودع الأدوار والسياسات.
  readonly contextStore: SDKContextStore; // مصدر السياق الحالي.
}

// ينشئ خدمة الصلاحيات بالحقن (قسم 38).
export const createRbacService = (deps: RbacServiceDependencies): RbacService => {
  // نسخة مؤقتة من الأدوار لتفادي القراءة المتكررة في نفس الجلسة (قسم 66).
  let cachedRoles: readonly Role[] | null = null;
  // نسخة مؤقتة من السياسات.
  let cachedPolicies: readonly Policy[] | null = null;

  // يقرأ أدوار المستخدم الحالي (مع تخزين مؤقت داخل الجلسة).
  const loadRoles = async (): Promise<readonly Role[]> => {
    // نستخدم النسخة المؤقتة إن وُجدت.
    if (cachedRoles) return cachedRoles;
    // نقرأ أكواد الأدوار من السياق.
    const roleIds = deps.contextStore.get().roleIds;
    // نطلبها من المستودع.
    const result = await deps.repository.getRolesByIds(roleIds);
    // الفشل يُعامل كقائمة فارغة (Fail-Closed: بلا أدوار = بلا صلاحيات).
    cachedRoles = result.success ? result.data : [];
    return cachedRoles;
  };

  // يقرأ السياسات المطبَّقة (مع تخزين مؤقت).
  const loadPolicies = async (): Promise<readonly Policy[]> => {
    // النسخة المؤقتة أولًا.
    if (cachedPolicies) return cachedPolicies;
    // نطلبها من المستودع.
    const result = await deps.repository.getPolicies();
    // الفشل يعني لا سياسات إضافية (الأذونات وحدها تحكم).
    cachedPolicies = result.success ? result.data : [];
    return cachedPolicies;
  };

  /**
   * يحسم صلاحيات المستخدم الفعّالة من مصدر واحد موحّد:
   * صلاحيات الجلسة إن وُجدت، وإلا المشتقة من أدواره.
   * توحيدها هنا يمنع تناقض القرار بين `getPermissions` و`can`.
   */
  const resolvePermissions = async (): Promise<readonly string[]> => {
    // صلاحيات السياق (تأتي من الجلسة عادة).
    const contextPermissions = deps.contextStore.get().permissions;
    // وجودها يعني أنها المصدر المعتمد.
    if (contextPermissions.length > 0) return contextPermissions;
    // غيابها يعني الاشتقاق من الأدوار (Fail-Closed عند غياب الاثنين).
    return collectPermissions(await loadRoles());
  };

  // نُبطل النسخ المؤقتة عند أي تغيّر في السياق (تبديل مستخدم/متجر).
  deps.contextStore.subscribe(() => {
    cachedRoles = null;
    cachedPolicies = null;
  });

  return {
    // الأدوار كاملة الكائنات.
    getRoles: async () => success(await loadRoles()),

    // الصلاحيات الفعّالة (نفس المصدر الذي يستخدمه قرار `can`).
    getPermissions: async () => success(await resolvePermissions()),

    // فحص مباشر متزامن (للواجهة: إخفاء/إظهار — والفحص الحقيقي عند التنفيذ).
    hasPermission: (permission) => hasPermission(deps.contextStore.get().permissions, permission),

    // فحص "أيٍّ من".
    hasAnyPermission: (permissions) => hasAnyPermission(deps.contextStore.get().permissions, permissions),

    // فحص "كل".
    hasAllPermissions: (permissions) => hasAllPermissions(deps.contextStore.get().permissions, permissions),

    // القرار الكامل مع النطاق والسياسات.
    can: async (request, policyContext = {}) => {
      // نحمّل الأدوار لحساب النطاق الفعّال.
      const roles = await loadRoles();
      // نحمّل السياسات.
      const policies = await loadPolicies();
      // الصلاحيات الفعّالة من المصدر الموحّد.
      const permissions = await resolvePermissions();
      // نبني سياقًا يحمل الصلاحيات المحسومة (لا نعتمد على السياق الخام وحده).
      const context = { ...deps.contextStore.get(), permissions };
      // نُصدر القرار عبر المحرّك النقي.
      return authorize(context, request, effectiveScope(roles), policies, policyContext);
    },

    // النطاق الأقصى للمستخدم.
    getScope: async () => effectiveScope(await loadRoles()),
  };
};
