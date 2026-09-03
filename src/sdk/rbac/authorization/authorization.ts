/**
 * محرّك التفويض داخل الـSDK — PHASE 31 · أقسام 12 و57.
 * دوال نقية: تستقبل الصلاحيات الممنوحة والطلب، وتُعيد قرارًا مُعلَّلًا.
 * يعيد استخدام منطق المطابقة القائم (security/permissions) مصدرًا وحيدًا
 * للحقيقة، فلا يوجد منطق صلاحيات مكرر في التطبيق (قسم 70).
 */
import { permissionMatches } from '@/security/permissions/permission';
import { AuthorizationError, type SDKContext, type Result, success, failure } from '@/sdk/core';
import {
  SCOPE_RANK,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type PermissionScope,
  type Policy,
  type PolicyEvaluationContext,
  type Role,
} from '../contracts/rbac-contracts';

// يبني نص الإذن القانوني من المورد والفعل ('pos.sale' + 'create').
export const permissionKey = (resource: string, action: string): string => `${resource}.${action}`;

// هل النطاق الممنوح يغطّي النطاق المطلوب؟ (الأوسع يغطي الأضيق).
export const scopeCovers = (granted: PermissionScope, required: PermissionScope): boolean =>
  SCOPE_RANK[granted] >= SCOPE_RANK[required];

// أوسع نطاق بين أدوار المستخدم (نطاقه الفعّال).
export const effectiveScope = (roles: readonly Role[]): PermissionScope => {
  // نبدأ من أضيق نطاق ممكن.
  let widest: PermissionScope = 'own';
  // نوسّع كلما وجدنا دورًا بنطاق أعلى رتبة.
  for (const role of roles) {
    if (SCOPE_RANK[role.scope] > SCOPE_RANK[widest]) widest = role.scope;
  }
  // النطاق الأوسع الناتج.
  return widest;
};

// يجمع صلاحيات مجموعة أدوار في قائمة فريدة.
export const collectPermissions = (roles: readonly Role[]): string[] => {
  // مجموعة تمنع التكرار.
  const unique = new Set<string>();
  // نضيف صلاحيات كل دور.
  for (const role of roles) {
    for (const permission of role.permissions) unique.add(permission);
  }
  // نُعيدها كمصفوفة.
  return [...unique];
};

// هل الصلاحيات الممنوحة تغطّي الإذن المطلوب؟ (يدعم البدائل '*' و'resource.*').
export const hasPermission = (granted: readonly string[], required: string): boolean =>
  // صلاحية مطلقة تغطي كل شيء، وإلا نبحث عن مطابقة واحدة على الأقل.
  granted.includes('*') || granted.some((item) => permissionMatches(item, required));

// هل يملك أيًّا من الصلاحيات المطلوبة؟ (قسم 12).
export const hasAnyPermission = (granted: readonly string[], required: readonly string[]): boolean =>
  required.some((permission) => hasPermission(granted, permission));

// هل يملك كل الصلاحيات المطلوبة؟ (قسم 12).
export const hasAllPermissions = (granted: readonly string[], required: readonly string[]): boolean =>
  required.every((permission) => hasPermission(granted, permission));

/**
 * يقيّم سياسة واحدة على عملية جارية.
 * السياسة المانعة تُطبَّق أولًا (Deny Wins) حفاظًا على الأمان.
 */
export const evaluatePolicy = (policy: Policy, context: PolicyEvaluationContext): boolean => {
  // سياسة بلا شروط: أثرها مباشر (سماح = مسموح، منع = ممنوع).
  if (!policy.conditions) return policy.effect === 'allow';
  // نقرأ الشروط.
  const { maxAmount, requireApproval, businessHoursOnly } = policy.conditions;
  // تجاوز السقف المالي يُبطل السماح.
  if (maxAmount !== undefined && context.amount !== undefined && context.amount > maxAmount) return false;
  // اشتراط الاعتماد دون وجوده يُبطل السماح.
  if (requireApproval === true && context.hasApproval !== true) return false;
  // اشتراط ساعات العمل خارجها يُبطل السماح.
  if (businessHoursOnly === true && context.isBusinessHours !== true) return false;
  // كل الشروط تحققت: الأثر يحسم القرار.
  return policy.effect === 'allow';
};

/**
 * القرار الكامل: إذن + نطاق + سياسات.
 * دالة نقية لا ترمي أبدًا — تُعيد قرارًا مُعلَّلًا يُترجم في الطبقة الأعلى.
 */
export const decide = (
  granted: readonly string[], // صلاحيات المستخدم.
  userScope: PermissionScope, // نطاقه الأقصى.
  request: AuthorizationRequest, // الطلب (مورد + فعل + نطاق).
  policies: readonly Policy[] = [], // السياسات المطبَّقة.
  policyContext: PolicyEvaluationContext = {}, // قيم العملية للسياسات.
): AuthorizationDecision => {
  // نبني نص الإذن المطلوب.
  const required = permissionKey(request.resource, String(request.action));
  // (1) فحص الإذن نفسه.
  if (!hasPermission(granted, required)) {
    return { allowed: false, reason: 'PERMISSION_DENIED', requiredScope: request.scope };
  }
  // (2) فحص النطاق: نطاق المستخدم يجب أن يغطي نطاق العملية.
  const requiredScope = request.scope ?? 'store';
  if (!scopeCovers(userScope, requiredScope)) {
    return { allowed: false, reason: 'SCOPE_DENIED', matchedPermission: required, requiredScope };
  }
  // (3) فحص السياسات المرتبطة بهذا الإذن تحديدًا.
  // سياسة بلا حقل إذن صالح تُتجاهل بدل أن تُسقط القرار (تحصين ضد بيانات تالفة).
  const applicable = policies.filter(
    (policy) => typeof policy.permission === 'string' && permissionMatches(policy.permission, required),
  );
  // أي سياسة تفشل تمنع العملية (Deny Wins).
  for (const policy of applicable) {
    if (!evaluatePolicy(policy, policyContext)) {
      return { allowed: false, reason: 'POLICY_DENIED', matchedPermission: required, requiredScope };
    }
  }
  // كل الفحوص نجحت.
  return { allowed: true, matchedPermission: required, requiredScope };
};

/**
 * حارس التفويض المستخدم داخل خدمات الـSDK قبل كل طفرة حسّاسة (قسم 57).
 * يُعيد Result: الفشل يحمل AuthorizationError بتفاصيل الإذن والنطاق.
 */
export const authorize = (
  context: SDKContext, // سياق الـSDK (يحمل الصلاحيات).
  request: AuthorizationRequest, // الطلب.
  userScope: PermissionScope = 'store', // نطاق المستخدم الأقصى.
  policies: readonly Policy[] = [], // السياسات.
  policyContext: PolicyEvaluationContext = {}, // قيم العملية.
): Result<AuthorizationDecision> => {
  // نحسب القرار بالمحرّك النقي.
  const decision = decide(context.permissions, userScope, request, policies, policyContext);
  // القرار الإيجابي يمر.
  if (decision.allowed) return success(decision);
  // القرار السلبي يُحوَّل إلى خطأ تفويض يحمل سببه للتدقيق.
  return failure(
    new AuthorizationError('sdk.error.authorization', {
      details: {
        resource: request.resource,
        action: String(request.action),
        reason: decision.reason ?? 'PERMISSION_DENIED',
        requiredScope: decision.requiredScope,
      },
    }),
  );
};
