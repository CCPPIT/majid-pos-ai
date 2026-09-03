/**
 * الواجهة العلنية لمجال الصلاحيات — PHASE 31 · قسم 51.
 * يصدّر العقود والمحرّك النقي والخدمة فقط؛ لا تفاصيل تنفيذ داخلية.
 */

// عقود النموذج (أدوار · أذونات · سياسات · قرارات).
export {
  SCOPE_RANK,
  ALL_SCOPES,
  type Permission,
  type PermissionAction,
  type PermissionScope,
  type Role,
  type AuthorizationRequest,
  type AuthorizationDecision,
  type Policy,
  type PolicyEffect,
  type PolicyConditions,
  type PolicyEvaluationContext,
} from './contracts/rbac-contracts';

// عقد المستودع.
export type { RbacRepository } from './contracts/rbac-repository';

// محرّك التفويض النقي.
export {
  permissionKey,
  scopeCovers,
  effectiveScope,
  collectPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  evaluatePolicy,
  decide,
  authorize,
} from './authorization/authorization';

// الخدمة عالية المستوى.
export { createRbacService, type RbacService, type RbacServiceDependencies } from './services/rbac-service';

// المحوّل المحلي فوق فهرس أدوار المنصّة القائم.
export { createLocalRbacRepository } from './repositories/local-rbac-repository';
