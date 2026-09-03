/**
 * كيانات الهرمية متعددة المستأجرين (Multi-Tenant) — قسم 16.
 * Platform → Tenant → Organization → Branch → Store → Users/Roles.
 */
import type { ID, Auditable } from '@/core/types/domain';

// المستأجر (Tenant): حساب عميل على منصة SaaS.
export interface Tenant extends Auditable {
  id: ID; // المعرف الفريد للمستأجر.
  name: string; // اسم الشركة/المستأجر.
  slug: string; // معرف نصي مميز في الروابط.
  plan: string; // خطة الاشتراك (starter/business/enterprise).
  status: 'active' | 'suspended' | 'trial'; // حالة الحساب.
  defaultCurrency: string; // العملة الافتراضية للمستأجر (YER…).
  defaultLocale: 'ar' | 'en'; // اللغة الافتراضية.
}

// المؤسسة (Organization): كيان تجاري داخل المستأجر.
export interface Organization extends Auditable {
  id: ID; // معرف المؤسسة.
  tenantId: ID; // المستأجر المالك.
  name: string; // اسم المؤسسة.
  industry?: string; // نوع النشاط (تجزئة، مطعم…).
}

// الفرع (Branch): فرع جغرافي داخل المؤسسة.
export interface Branch extends Auditable {
  id: ID; // معرف الفرع.
  tenantId: ID; // المستأجر.
  organizationId: ID; // المؤسسة المالكة.
  name: string; // اسم الفرع (مثلاً: فرع صنعاء).
  city?: string; // المدينة.
}

// المتجر (Store): نقطة بيع/مخزن داخل الفرع.
export interface Store extends Auditable {
  id: ID; // معرف المتجر.
  tenantId: ID; // المستأجر.
  organizationId: ID; // المؤسسة.
  branchId: ID; // الفرع المالك.
  name: string; // اسم المتجر.
  code: string; // كود المتجر (للكاشير/الإيصالات).
  taxRatePercent: number; // نسبة الضريبة الافتراضية للمتجر.
  currency: string; // عملة المتجر.
}
