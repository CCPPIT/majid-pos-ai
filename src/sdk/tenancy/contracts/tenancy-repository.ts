/**
 * عقد مستودع تعدد المستأجرين — PHASE 31 · قسم 30.
 * التنفيذ المحلي يقرأ الهرمية من إعداد المتجر المخزّن على الجهاز؛
 * التنفيذ البعيد سيقرأها من MAJID API بنفس العقد تمامًا.
 */
import type { AsyncResult, StoreId, TenantId } from '@/sdk/core';
import type { PermissionScope } from '@/sdk/rbac';
import type { AccessibleStore, ActiveTenancy, TenancyHierarchy } from './tenancy-contracts';

// مستودع الهرمية والمتجر النشط.
export interface TenancyRepository {
  // يحمّل الهرمية الكاملة لمستأجر.
  getHierarchy(tenantId: TenantId): AsyncResult<TenancyHierarchy>;
  // يبني السياق النشط لمتجر داخل مستأجر (يفشل إن كان المتجر خارج المستأجر).
  getActiveTenancy(tenantId: TenantId, storeId: StoreId): AsyncResult<ActiveTenancy>;
  // يسرد المتاجر المتاحة للتبديل حسب نطاق المستخدم.
  getAccessibleStores(
    tenantId: TenantId,
    userScope: PermissionScope,
    activeStoreId?: StoreId,
  ): AsyncResult<readonly AccessibleStore[]>;
  // يقرأ المتجر النشط المحفوظ (null عند أول تشغيل).
  getActiveStore(): AsyncResult<StoreId | null>;
  // يحفظ المتجر النشط.
  setActiveStore(storeId: StoreId): AsyncResult<void>;
}
