/**
 * محرك التفويض (Authorization Engine) — أقسام 14 و52 و64.
 * يجمع صلاحيات الأدوار، يطابق الأذونات (مع wildcards)، ويفرض النطاق.
 * هذا هو المصدر الوحيد لقرار "هل يُسمح؟" — تستخدمه الشاشات والإجراءات.
 */
import { permissionMatches } from '@/security/permissions/permission'; // منطق المطابقة (مبني في PHASE 02).
import { scopeCovers, type Scope } from './scopes'; // مقارنة النطاقات.
import { permissionScope } from './permissions-catalog'; // نطاق الإذن القانوني.
import { getRoleByCode } from './roles-catalog'; // استرجاع دور بالكود.
import type { AuthorizationResult, Role } from './types';

// تجميع كل صلاحيات مجموعة أدوار (تُمرر نتيجتها للجلسة).
export const collectPermissions = (roles: readonly Role[]): string[] => {
  // نمر على كل دور وندمج صلاحياته في مجموعة (لإزالة التكرار).
  const set = new Set<string>();
  for (const r of roles) {
    for (const p of r.permissions) set.add(p);
  }
  return [...set];
};

// أوسع نطاق بين أدوار المستخدم (النطاق الأقصى الفعّال).
export const effectiveScope = (roles: readonly Role[]): Scope => {
  // نبدأ من أضيق نطاق ونوسّع حسب رتبة النطاق.
  let max: Scope = 'own';
  for (const r of roles) {
    if (scopeCovers(r.scope, max)) max = r.scope;
  }
  return max;
};

// استرجاع أدوار المستخدم من أكوادها (مع تجاهل أي كود غير معروف).
export const resolveRoles = (codes: readonly string[]): Role[] =>
  codes
    .map((c) => getRoleByCode(c)) // نحول كل كود لدور.
    .filter((r): r is Role => Boolean(r)); // نستبعد المفقود.

/**
 * الفحص الأساسي: هل الصلاحيات الممنوحة تغطي الإذن المطلوب؟
 * wildcard '*' و'resource.*' مدعومة عبر permissionMatches.
 */
export const can = (granted: readonly string[], required: string): boolean => {
  // المستخدم ذو الصلاحية المطلقة.
  if (granted.includes('*')) return true;
  // نستخدم منطق المطابقة الموحّد.
  return granted.some((g) => permissionMatches(g, required));
};

/**
 * الفحص الكامل مع النطاق.
 * requiredScope = النطاق الذي يحتاجه الإجراء (مثلاً تعديل على مستوى الفرع).
 * userScope = النطاق الأقصى للمستخدم.
 */
export const authorize = (
  granted: readonly string[], // صلاحيات المستخدم.
  required: string, // الإذن المطلوب 'resource.action'.
  userScope: Scope, // النطاق الأقصى للمستخدم.
  requiredScope?: Scope, // النطاق المطلوب (يُشتق من الفهرس إن تُرك).
): AuthorizationResult => {
  // 1) فحص الصلاحية (الإذن).
  const hasPermission = can(granted, required);
  if (!hasPermission) {
    return { allowed: false, reason: 'PERMISSION_DENIED' }; // يُترجم للعرض في الطبقة الأعلى.
  }
  // 2) فحص النطاق: نطاق المستخدم يجب أن يغطي نطاق الإجراء.
  const needed = requiredScope ?? permissionScope(required);
  if (!scopeCovers(userScope, needed)) {
    return { allowed: false, reason: 'SCOPE_DENIED', matchedPermission: required };
  }
  // كل شيء سارٍ.
  return { allowed: true, matchedPermission: required };
};

// نسخة مبسطة لفحص نطاق صريح (تُستخدم في الشاشات).
export const canWithScope = (
  granted: readonly string[],
  required: string,
  userScope: Scope,
  requiredScope?: Scope,
): boolean => authorize(granted, required, userScope, requiredScope).allowed;
