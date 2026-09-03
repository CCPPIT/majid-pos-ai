/**
 * اختبارات سياق المستأجر (PHASE 08).
 * تغطي: بناء نطاق الاستعلام حسب نطاق الدور، فلترة الكيانات،
 * المستودع (بناء السياق، المتاجر المتاحة، حفظ المتجر النشط).
 */
import { asId, type TenantScoped } from '@/core/types/domain';
import {
  buildQueryScope, // بناء نطاق الاستعلام.
  matchesQueryScope, // مطابقة كيان للنطاق.
  filterByScope, // فلترة قائمة.
  type ActiveTenancyContext, // نوع السياق النشط.
} from '@/domain/tenancy/scope';
import { MockTenancySource } from '@/data/sources/tenancy.source';
import {
  AppTenancyRepository,
  type ActiveStoreStore,
} from '@/data/repositories/tenancy.repository';

// سياق نشط تجريبي للاختبارات.
const CTX: ActiveTenancyContext = {
  tenantId: asId('tenant-local'),
  tenantName: 'متاجر ماجد',
  organizationId: asId('org-local'),
  organizationName: 'شركة ماجد',
  branchId: asId('branch-sanaa'),
  branchName: 'فرع صنعاء',
  storeId: asId('store-sanaa-haddah'),
  storeName: 'متجر حدة',
  storeCode: 'SNH-01',
  currency: 'YER',
  taxRatePercent: 5,
};

// مخزن نشط في الذاكرة للاختبار.
const memoryActiveStore = (initial: string | null = null): ActiveStoreStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  if (initial) map.set('key', initial);
  return {
    map,
    getActiveStoreId: async () => map.get('key') ?? null,
    setActiveStoreId: async (id: string) => {
      map.set('key', id);
    },
  };
};

describe('بناء نطاق الاستعلام حسب نطاق الدور', () => {
  it('الكاشير (store) يُقيَّد بالمتجر النشط', () => {
    const scope = buildQueryScope(CTX, 'store');
    expect(scope.tenantId).toBe(CTX.tenantId); // عزل المستأجر.
    expect(scope.organizationId).toBe(CTX.organizationId);
    expect(scope.branchId).toBe(CTX.branchId);
    expect(scope.storeId).toBe(CTX.storeId); // متجر محدد.
  });

  it('مدير الفرع (branch) لا يُقيَّد بمتجر واحد', () => {
    const scope = buildQueryScope(CTX, 'branch');
    expect(scope.branchId).toBe(CTX.branchId);
    expect(scope.storeId).toBeUndefined(); // يرى كل متاجر الفرع.
  });

  it('المدير العام (organization) يرى المؤسسة بلا فرع/متجر', () => {
    const scope = buildQueryScope(CTX, 'organization');
    expect(scope.organizationId).toBe(CTX.organizationId);
    expect(scope.branchId).toBeUndefined();
    expect(scope.storeId).toBeUndefined();
  });

  it('مدير المستأجر (tenant) عزل على المستأجر فقط', () => {
    const scope = buildQueryScope(CTX, 'tenant');
    expect(scope.tenantId).toBe(CTX.tenantId);
    expect(scope.organizationId).toBeUndefined();
  });
});

describe('فلترة الكيانات حسب النطاق', () => {
  const items: TenantScoped[] = [
    {
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-sanaa'),
      storeId: asId('store-sanaa-haddah'),
    } as TenantScoped,
    {
      tenantId: asId('tenant-local'),
      organizationId: asId('org-local'),
      branchId: asId('branch-aden'),
      storeId: asId('store-aden-crater'),
    } as TenantScoped,
    { tenantId: asId('other-tenant'), organizationId: asId('org-other') } as TenantScoped,
  ];

  it('عزل المستأجر يرفض كيانات المستأجرين الآخرين', () => {
    const scope = buildQueryScope(CTX, 'tenant');
    expect(filterByScope(items, scope)).toHaveLength(2);
  });

  it('نطاق المتجر يعيد متجر الكاشير فقط', () => {
    const scope = buildQueryScope(CTX, 'store');
    const result = filterByScope(items, scope);
    expect(result).toHaveLength(1);
    expect(matchesQueryScope(items[0]!, scope)).toBe(true);
    expect(matchesQueryScope(items[1]!, scope)).toBe(false);
  });
});

describe('مستودع المستأجرين', () => {
  it('يحمّل فرعين و4 متاجر', async () => {
    const repo = new AppTenancyRepository(new MockTenancySource(), memoryActiveStore());
    const data = await repo.loadHierarchy('user-1', 'store');
    expect(data.branches).toHaveLength(2);
    expect(data.stores).toHaveLength(4);
  });

  it('يبني السياق الصحيح لمتجر', async () => {
    const repo = new AppTenancyRepository(new MockTenancySource(), memoryActiveStore());
    const data = await repo.loadHierarchy('user-1', 'store');
    const ctx = repo.buildContext(data, asId('store-aden-mansoura'));
    expect(ctx?.storeName).toBe('متجر المنصورة');
    expect(ctx?.branchName).toBe('فرع عدن');
    expect(ctx?.currency).toBe('YER');
    expect(ctx?.taxRatePercent).toBe(5);
  });

  it('يعيد null لمتجر غير موجود', async () => {
    const repo = new AppTenancyRepository(new MockTenancySource(), memoryActiveStore());
    const data = await repo.loadHierarchy('user-1', 'store');
    expect(repo.buildContext(data, asId('not-a-store'))).toBeNull();
  });

  it('يسرد المتاجر مع اسم الفرع', async () => {
    const repo = new AppTenancyRepository(new MockTenancySource(), memoryActiveStore());
    const stores = await repo.listAccessibleStores('user-1', 'store');
    expect(stores).toHaveLength(4);
    const haddah = stores.find((s) => s.store.id === asId('store-sanaa-haddah'));
    expect(haddah?.branchName).toBe('فرع صنعاء');
  });

  it('يحفظ ويستعيد المتجر النشط', async () => {
    const store = memoryActiveStore();
    const repo = new AppTenancyRepository(new MockTenancySource(), store);
    expect(await repo.getActiveStoreId()).toBeNull();
    await repo.setActiveStoreId(asId('store-aden-crater'));
    expect(await repo.getActiveStoreId()).toBe('store-aden-crater');
  });

  it('تبديل المتجر متاح لمدير الفرع وليس للكاشير', () => {
    const repo = new AppTenancyRepository(new MockTenancySource(), memoryActiveStore());
    expect(repo.canSwitchStore('branch')).toBe(true);
    expect(repo.canSwitchStore('store')).toBe(false);
  });
});
