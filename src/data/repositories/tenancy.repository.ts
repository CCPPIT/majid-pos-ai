/**
 * مستودع المستأجرين (Tenancy Repository) — قسم 38.
 * يوفّر الهرمية (مستأجر/مؤسسة/فروع/متاجر)، يحدد المتاجر التي يستطيع
 * المستخدم تبديلها حسب نطاق دوره، ويحفظ المتجر النشط على الجهاز.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import type { ID } from '@/core/types/domain';
import { SCOPE_RANK, type Scope } from '@/domain/security/scopes';
import type { Branch, Store } from '@/domain/tenancy/types';
import type { ActiveTenancyContext } from '@/domain/tenancy/scope';
import type { TenancySource, TenantData } from '../sources/tenancy.source';

// عنصر متجر مع اسم الفرع (للعرض في المبدّل).
export interface AccessibleStore {
  store: Store; // المتجر.
  branchId: ID; // الفرع.
  branchName: string; // اسم الفرع.
}

// واجهة تخزين بسيطة للمتجر النشط (تُمرر من الطبقة الأعلى).
export interface ActiveStoreStore {
  getActiveStoreId(): Promise<string | null>; // قراءة المعرف المحفوظ.
  setActiveStoreId(id: string): Promise<void>; // حفظ المعرف.
}

// المستودع: يلف المصدر + حفظ الاختيار.
export interface TenancyRepository {
  // يحمّل الهرمية الكاملة.
  loadHierarchy(userId: string, roleScope: Scope): Promise<TenantData>;
  // المتاجر التي يمكن للمستخدم التبديل بينها (مفلترة بالنطاق).
  listAccessibleStores(userId: string, roleScope: Scope): Promise<AccessibleStore[]>;
  // هل تبديل المتجر متاح لهذا الدور؟ (النطاق ≥ فرع).
  canSwitchStore(roleScope: Scope): boolean;
  // يبني السياق النشط لمتجر معين.
  buildContext(data: TenantData, storeId: ID): ActiveTenancyContext | null;
  // المتجر النشط محفوظًا (إن وُجد).
  getActiveStoreId(): Promise<string | null>;
  // يحفظ المتجر النشط.
  setActiveStoreId(id: ID): Promise<void>;
}

export class AppTenancyRepository implements TenancyRepository {
  // نبني المستودع بالمصدر + مخزن الاختيار.
  constructor(
    private readonly source: TenancySource,
    private readonly activeStore: ActiveStoreStore,
  ) {}

  async loadHierarchy(userId: string, roleScope: Scope): Promise<TenantData> {
    // نفوّض للمصدر (Mock اليوم، API غدًا).
    return this.source.getTenantData(userId, roleScope);
  }

  canSwitchStore(roleScope: Scope): boolean {
    // تبديل المتجر متاح لمن نطاقه فرع أو أوسع (يرى عدة متاجر).
    // الكاشير (متجر/own) يُثبّت على متجره (لكن حاليًا التجربة تتيح البيع على أي متجر للعرض).
    return SCOPE_RANK[roleScope] >= SCOPE_RANK.branch;
  }

  async listAccessibleStores(userId: string, roleScope: Scope): Promise<AccessibleStore[]> {
    const data = await this.loadHierarchy(userId, roleScope);
    // خريطة الفرع: معرف → اسم.
    const branchName = new Map<ID, string>(data.branches.map((b: Branch) => [b.id, b.name]));
    // نعيد المتاجر مع اسم فرعها.
    return data.stores.map((store: Store) => ({
      store,
      branchId: store.branchId,
      branchName: branchName.get(store.branchId) ?? '',
    }));
  }

  buildContext(data: TenantData, storeId: ID): ActiveTenancyContext | null {
    // نبحث عن المتجر.
    const store = data.stores.find((s) => s.id === storeId);
    if (!store) return null;
    // نبحث عن الفرع والمؤسسة والمستأجر.
    const branch = data.branches.find((b) => b.id === store.branchId);
    if (!branch) return null;
    // نبني السياق النشط كاملًا.
    return {
      tenantId: data.tenant.id,
      tenantName: data.tenant.name,
      organizationId: data.organization.id,
      organizationName: data.organization.name,
      branchId: branch.id,
      branchName: branch.name,
      storeId: store.id,
      storeName: store.name,
      storeCode: store.code,
      currency: store.currency,
      taxRatePercent: store.taxRatePercent,
    };
  }

  getActiveStoreId(): Promise<string | null> {
    return this.activeStore.getActiveStoreId();
  }

  setActiveStoreId(id: ID): Promise<void> {
    return this.activeStore.setActiveStoreId(String(id));
  }
}

// مخزن المتجر النشط فوق المستودع العام للتفضيلات (مفتاح STORAGE_KEYS.activeStore).
export class PreferencesActiveStoreStore implements ActiveStoreStore {
  // نستخدم مصدر النصوص نفسه للتفضيلات.
  constructor(
    private readonly getString: (key: string) => Promise<string | null>,
    private readonly setString: (key: string, value: string) => Promise<void>,
  ) {}

  async getActiveStoreId(): Promise<string | null> {
    return this.getString(STORAGE_KEYS.activeStore);
  }

  async setActiveStoreId(id: string): Promise<void> {
    await this.setString(STORAGE_KEYS.activeStore, id);
  }
}
