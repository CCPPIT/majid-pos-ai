/**
 * محوّل مستودع الصلاحيات فوق فهرس الأدوار القائم — PHASE 31 · أقسام 38 و65.
 *
 * التطبيق يملك أصلًا فهرسًا كاملًا لـ100 دور وفهرسًا للصلاحيات
 * (`src/domain/security/`). هذا المحوّل يجعلهما متاحين عبر عقد الـSDK
 * دون نسخ بيانات ولا إعادة تعريف: مصدر الحقيقة يبقى واحدًا، والـSDK
 * يقرأ منه عبر واجهة مستقرة يسهل استبدالها بمصدر بعيد لاحقًا.
 */
import { ROLES, getRoleByCode as getDomainRoleByCode } from '@/domain/security/roles-catalog';
import { PERMISSION_CATALOG } from '@/domain/security/permissions-catalog';
import type { Role as DomainRole } from '@/domain/security/types';
import { asPermissionId, asRoleId, success, type AsyncResult } from '@/sdk/core';
import type { Permission, Policy, Role } from '../contracts/rbac-contracts';
import type { RbacRepository } from '../contracts/rbac-repository';

// يحوّل دور المجال إلى دور الـSDK (المعرّفات موسومة والحقول مطابقة).
const toSDKRole = (role: DomainRole): Role => ({
  // المعرّف يُوسَم بمحوّل الـSDK الرسمي.
  id: asRoleId(String(role.id)),
  code: role.code,
  nameAr: role.nameAr,
  nameEn: role.nameEn,
  // النطاق مشترك المفردات بين الطبقتين (own→global).
  scope: role.scope,
  permissions: role.permissions,
  // أدوار الفهرس كلها أدوار نظام لا تُحذف.
  isSystem: role.isSystem ?? true,
});

/**
 * ينشئ مستودع صلاحيات محليًا فوق فهارس المجال.
 * القراءة فقط: الأدوار والصلاحيات بيانات مرجعية لا تُعدَّل من الجهاز.
 */
export const createLocalRbacRepository = (): RbacRepository => {
  // نحوّل الفهرس مرة واحدة (بيانات ثابتة لا تتغيّر أثناء التشغيل).
  const roles: readonly Role[] = ROLES.map(toSDKRole);
  // فهرس الصلاحيات بصيغة الـSDK.
  const permissions: readonly Permission[] = PERMISSION_CATALOG.map((permission) => ({
    // المعرّف مشتق من المورد والفعل (فريد بطبيعته).
    id: asPermissionId(`${permission.resource}.${String(permission.action)}`),
    resource: permission.resource,
    action: permission.action,
    scope: permission.scope,
  }));

  return {
    // كل الأدوار المعرَّفة في المنصّة.
    getRoles: async (): AsyncResult<readonly Role[]> => success(roles),

    // أدوار محددة بمعرّفاتها (يُستخدم لحساب صلاحيات المستخدم).
    getRolesByIds: async (ids) => {
      // مجموعة المعرّفات المطلوبة كنصوص للمقارنة.
      const wanted = new Set(ids.map((id) => String(id)));
      // نُعيد المطابق منها فقط (الغائب يُتجاهل بلا خطأ).
      return success(roles.filter((role) => wanted.has(String(role.id))));
    },

    // دور واحد بكوده الثابت (cashier · store-manager…).
    getRoleByCode: async (code) => {
      // نقرأ من فهرس المجال مباشرة (بحث مفهرس لا خطّي).
      const found = getDomainRoleByCode(code);
      // الغياب ليس خطأً: كود غير معروف يعني لا دور.
      return success(found ? toSDKRole(found) : null);
    },

    // فهرس الصلاحيات الكامل.
    getPermissions: async (): AsyncResult<readonly Permission[]> => success(permissions),

    /**
     * السياسات المطبَّقة.
     *
     * لا يوجد اليوم مصدر سياسات على الجهاز: السياسات (حدود مالية
     * واشتراط اعتماد) قرار مركزي يصدر من الخادم، ولو ولّدناها محليًا
     * لأصبح بالإمكان تجاوزها بتعديل التخزين المحلي. فنُعيد قائمة فارغة
     * صراحةً — والأذونات والنطاقات وحدها تحكم حتى يصل مصدرها البعيد.
     */
    getPolicies: async (): AsyncResult<readonly Policy[]> => success([]),
  };
};
