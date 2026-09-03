/**
 * مُحوّل الملف التعريفي إلى هرمية مستأجر (PHASE 09).
 * يأخذ StoreSetupProfile ويبني TenantData (Tenant → Organization → Branch → Store)
 * بمعرّفات ثابتة ومحددة (Deterministic) يمكن الاستناد إليها في المزامنة لاحقًا.
 */
import { asId, type ID } from '@/core/types/domain';
import type { TenantData } from '@/data/sources/tenancy.source';
import type { Branch, Organization, Store, Tenant } from '@/domain/tenancy/types';
import type { StoreSetupProfile } from './types';

// معرّفات كيانات الإعداد (ثابتة لكل تثبيت محلي حتى ربط الخادم).
export const SETUP_IDS = {
  tenant: 'tenant-setup', // معرف المستأجر الناتج عن الإعداد.
  organization: 'org-setup', // معرف المؤسسة.
  branch: 'branch-setup', // معرف الفرع الأول.
  store: 'store-setup-1', // معرف المتجر الأول.
} as const;

// نص مقصوص (أحرف لاتينية/أرقام/شرطة) للمعرف النصي slug.
function slugify(value: string): string {
  return (
    value
      .toLowerCase() // أحرف صغيرة.
      .trim() // إزالة الفراغات.
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-') // كل ما ليس حرفًا/رقمًا → شرطة.
      .replace(/^-+|-+$/g, '') || // إزالة الشرطات الطرفية.
    'business' // افتراضي إن أصبح فارغًا.
  );
}

// كود المتجر بحروف كبيرة ومقصوص.
function normalizeStoreCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

// نتيجة البناء: بيانات المستأجر + معرف المتجر النشط الأول.
export interface BuiltTenancy {
  data: TenantData; // الهرمية الكاملة.
  activeStoreId: ID; // المتجر النشط (الأول).
}

// يبني هرمية المستأجر من ملف الإعداد.
export function buildTenancyFromProfile(profile: StoreSetupProfile, now: string = new Date().toISOString()): BuiltTenancy {
  // 1) المستأجر: الاسم = اسم العمل، الخطة مبدئية business.
  const tenant: Tenant = {
    id: asId(SETUP_IDS.tenant), // معرف ثابت.
    name: profile.businessName.trim(), // اسم العمل.
    slug: slugify(profile.businessName), // معرف نصي.
    plan: 'business', // الخطة (افتراضية حتى الفوترة).
    status: 'active', // نشط.
    defaultCurrency: profile.currency, // العملة الافتراضية.
    defaultLocale: 'ar', // العربية افتراضية.
    createdAt: now, // الإنشاء = لحظة الإعداد.
    updatedAt: now, // التحديث.
  };

  // 2) المؤسسة: الاسم نفسه مع نوع النشاط.
  const organization: Organization = {
    id: asId(SETUP_IDS.organization),
    tenantId: tenant.id,
    name: profile.businessName.trim(),
    industry: profile.businessType, // نوع النشاط.
    createdAt: now,
    updatedAt: now,
  };

  // 3) الفرع الأول (المدينة + الاسم).
  const branch: Branch = {
    id: asId(SETUP_IDS.branch),
    tenantId: tenant.id,
    organizationId: organization.id,
    name: profile.branchName.trim(),
    city: profile.branchCity.trim(),
    createdAt: now,
    updatedAt: now,
  };

  // 4) المتجر/نقطة البيع الأولى.
  const store: Store = {
    id: asId(SETUP_IDS.store),
    tenantId: tenant.id,
    organizationId: organization.id,
    branchId: branch.id,
    name: profile.storeName.trim(),
    code: normalizeStoreCode(profile.storeCode),
    taxRatePercent: profile.taxRatePercent, // النسبة من الإعداد.
    currency: profile.currency, // العملة.
    createdAt: now,
    updatedAt: now,
  };

  // نعيد الهرمية كاملة + المتجر النشط.
  return {
    data: { tenant, organization, branches: [branch], stores: [store] },
    activeStoreId: store.id,
  };
}

// مسودة أولى للبدء (القيم الرقمية تُملأ عند اختيار الدولة).
export function emptyProfileDraft(): Partial<StoreSetupProfile> {
  return {
    businessName: '', // اسم العمل.
    branchName: '', // الفرع.
    branchCity: '', // المدينة.
    storeName: '', // المتجر.
    storeCode: '', // كود المتجر.
    managerName: '', // المدير (اختياري).
  };
}
