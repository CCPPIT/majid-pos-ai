/**
 * عقد مستودع الصلاحيات — PHASE 31 · قسم 30.
 * واجهة فقط: التنفيذ المحلي يقرأ من فهرس الأدوار القائم، والتنفيذ البعيد
 * سيقرأ من MAJID API دون تغيير هذا العقد ولا أي مستهلك له.
 */
import type { AsyncResult, RoleId } from '@/sdk/core';
import type { Permission, Policy, Role } from './rbac-contracts';

// مستودع الأدوار والأذونات والسياسات.
export interface RbacRepository {
  // يقرأ كل الأدوار المتاحة في النظام.
  getRoles(): AsyncResult<readonly Role[]>;
  // يقرأ أدوارًا محددة بمعرّفاتها (المفقود يُتجاهل بلا خطأ).
  getRolesByIds(ids: readonly RoleId[]): AsyncResult<readonly Role[]>;
  // يقرأ دورًا بكوده الثابت (null عند الغياب).
  getRoleByCode(code: string): AsyncResult<Role | null>;
  // يقرأ فهرس الأذونات القانوني كاملًا.
  getPermissions(): AsyncResult<readonly Permission[]>;
  // يقرأ السياسات المطبَّقة.
  getPolicies(): AsyncResult<readonly Policy[]>;
}
