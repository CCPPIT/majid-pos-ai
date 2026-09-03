/**
 * عقود تعدد المستأجرين — PHASE 31 · أقسام 10 و58.
 * الهرمية: Platform → Tenant → Organization → Branch → Store.
 * كل كيان تجاري في النظام يحمل tenantId، ولا عملية تتجاوز عزل المستأجر.
 */
import type {
  AuditableFields,
  BranchId,
  CurrencyCode,
  OrganizationId,
  ScopeFilter,
  StoreId,
  TenantId,
  TimeZoneId,
} from '@/sdk/core';
import type { PermissionScope } from '@/sdk/rbac';

// حالة اشتراك المستأجر.
export type TenantStatus = 'active' | 'trial' | 'suspended';

// المستأجر: حساب العميل الجذري على المنصة.
export interface Tenant extends AuditableFields {
  readonly id: TenantId; // المعرّف.
  readonly name: string; // اسم المستأجر.
  readonly slug: string; // معرّفه النصي في الروابط.
  readonly plan: string; // خطة الاشتراك.
  readonly status: TenantStatus; // حالة الحساب.
  readonly defaultCurrency: CurrencyCode; // العملة الافتراضية.
  readonly defaultLocale: 'ar' | 'en'; // اللغة الافتراضية.
  readonly timezone: TimeZoneId; // المنطقة الزمنية.
}

// المؤسسة داخل المستأجر.
export interface Organization extends AuditableFields {
  readonly id: OrganizationId; // المعرّف.
  readonly tenantId: TenantId; // المستأجر المالك.
  readonly name: string; // الاسم.
  readonly industry?: string; // نوع النشاط.
}

// الفرع داخل المؤسسة.
export interface Branch extends AuditableFields {
  readonly id: BranchId; // المعرّف.
  readonly tenantId: TenantId; // المستأجر.
  readonly organizationId: OrganizationId; // المؤسسة.
  readonly name: string; // الاسم.
  readonly city?: string; // المدينة.
}

// المتجر (نقطة بيع/مستودع) داخل الفرع.
export interface Store extends AuditableFields {
  readonly id: StoreId; // المعرّف.
  readonly tenantId: TenantId; // المستأجر.
  readonly organizationId: OrganizationId; // المؤسسة.
  readonly branchId: BranchId; // الفرع.
  readonly name: string; // الاسم.
  readonly code: string; // كود المتجر (يظهر على الإيصالات).
  readonly currency: CurrencyCode; // عملة المتجر.
  readonly taxRatePercent: number; // نسبة الضريبة الافتراضية.
}

// الهرمية الكاملة كما تُحمّل مرة واحدة عند التمهيد.
export interface TenancyHierarchy {
  readonly tenant: Tenant; // المستأجر.
  readonly organizations: readonly Organization[]; // مؤسساته.
  readonly branches: readonly Branch[]; // فروعه.
  readonly stores: readonly Store[]; // متاجره.
}

// السياق النشط المُختار (متجر واحد بكل سلسلة آبائه).
export interface ActiveTenancy {
  readonly tenantId: TenantId; // المستأجر.
  readonly tenantName: string; // اسمه.
  readonly organizationId: OrganizationId; // المؤسسة.
  readonly organizationName: string; // اسمها.
  readonly branchId: BranchId; // الفرع.
  readonly branchName: string; // اسمه.
  readonly storeId: StoreId; // المتجر.
  readonly storeName: string; // اسمه.
  readonly storeCode: string; // كوده.
  readonly currency: CurrencyCode; // عملته.
  readonly taxRatePercent: number; // ضريبته.
}

// متجر متاح للتبديل إليه (مفلتر حسب نطاق المستخدم).
export interface AccessibleStore {
  readonly storeId: StoreId; // المعرّف.
  readonly name: string; // الاسم.
  readonly code: string; // الكود.
  readonly branchName: string; // اسم الفرع (للتمييز في القائمة).
  readonly isActive: boolean; // هل هو النشط حاليًا؟
}

// إعادة تصدير نوع نطاق الاستعلام للاستخدام في المستودعات.
export type TenantScopeFilter = ScopeFilter;

// أدنى نطاق يسمح بتبديل المتجر (من يملك فرعًا فأعلى).
export const MIN_STORE_SWITCH_SCOPE: PermissionScope = 'branch';
