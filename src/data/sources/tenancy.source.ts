/**
 * مصدر بيانات المستأجرين (Tenancy Data Source).
 * اليوم بيانات محلية/تجريبية (Mock)؛ لاحقًا تُستبدل بـ API دون تغيير المستودع.
 * الهرمية الافتراضية: مستأجر → مؤسسة → فرعان → 4 متاجر (السوق اليمني).
 * إن وُجد ملف إعداد محفوظ (PHASE 09) تُبنى الهرمية منه بدل البيانات التجريبية.
 */
import { asId } from '@/core/types/domain';
import { buildTenancyFromProfile } from '@/domain/setup/builder';
import type { Tenant, Organization, Branch, Store } from '@/domain/tenancy/types';
import type { StoreSetupProfile } from '@/domain/setup/types';
import type { SetupSource } from './setup.source';

// شجرة المستأجرين التجريبية (قد تتعدد مستأجرين مستقبلًا).
export interface TenantData {
  tenant: Tenant; // المستأجر.
  organization: Organization; // المؤسسة.
  branches: Branch[]; // الفروع.
  stores: Store[]; // المتاجر (كل متجر ينتمي لفرع).
}

// المستأجر التجريبي الافتراضي (Yemeni retail).
export const DEMO_TENANT: TenantData = {
  // المستأجر.
  tenant: {
    id: asId('tenant-local'), // المعرف (يطابق معرف الجلسة المحلية).
    name: 'متاجر ماجد', // الاسم.
    slug: 'majid-stores', // المعرف النصي.
    plan: 'business', // الخطة.
    status: 'active', // الحالة.
    defaultCurrency: 'YER', // العملة الافتراضية.
    defaultLocale: 'ar', // اللغة الافتراضية.
    createdAt: '2026-01-01T00:00:00.000Z', // تاريخ الإنشاء.
    updatedAt: '2026-01-01T00:00:00.000Z', // آخر تحديث.
  },
  // المؤسسة.
  organization: {
    id: asId('org-local'),
    tenantId: asId('tenant-local'),
    name: 'شركة ماجد للتجزئة',
    industry: 'retail',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // الفرعان: صنعاء وعدن.
  branches: [
    {
      id: asId('branch-sanaa'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      name: 'فرع صنعاء',
      city: 'صنعاء',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: asId('branch-aden'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      name: 'فرع عدن',
      city: 'عدن',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  // المتاجر الأربعة (متجران لكل فرع).
  stores: [
    {
      id: asId('store-sanaa-haddah'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-sanaa'),
      name: 'متجر حدة',
      code: 'SNH-01',
      taxRatePercent: 5, // نسبة الضريبة 5% (افتراض تجريبي).
      currency: 'YER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: asId('store-sanaa-zubairi'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-sanaa'),
      name: 'متجر الزبيري',
      code: 'SNZ-02',
      taxRatePercent: 5,
      currency: 'YER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: asId('store-aden-crater'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-aden'),
      name: 'متجر كريتر',
      code: 'ADC-03',
      taxRatePercent: 5,
      currency: 'YER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: asId('store-aden-mansoura'),
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-aden'),
      name: 'متجر المنصورة',
      code: 'ADM-04',
      taxRatePercent: 5,
      currency: 'YER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

// واجهة المصدر.
export interface TenancySource {
  // يجلب شجرة المستأجر للمستخدم (حسب نطاق دوره).
  getTenantData(userId: string, roleScope: string): Promise<TenantData>;
}

// مصدر محلي (Mock) — يفضّل ملف الإعداد إن وُجد، وإلا البيانات التجريبية.
export class MockTenancySource implements TenancySource {
  // setupSource اختياري: إن مُرّر ووُجد ملف إعداد استخدمناه.
  constructor(private readonly setupSource?: SetupSource) {}

  async getTenantData(): Promise<TenantData> {
    // 1) إن توفّر مصدر إعداد، نحاول قراءة الملف.
    if (this.setupSource) {
      const profile: StoreSetupProfile | null = await this.setupSource.getProfile();
      if (profile) {
        // ملف إعداد محفوظ → نبني الهرمية منه.
        return buildTenancyFromProfile(profile).data;
      }
    }
    // 2) لا إعداد بعد → البيانات التجريبية (نسخة مستقلة).
    return JSON.parse(JSON.stringify(DEMO_TENANT)) as TenantData;
  }
}
