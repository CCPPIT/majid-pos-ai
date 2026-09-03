/**
 * خدمة تعدد المستأجرين — PHASE 31 · أقسام 10 و58.
 * مسؤوليتها: بناء نطاق الاستعلام من السياق، وحراسة كل عملية أعمال ضد
 * غياب المستأجر/المتجر، وتضييق أي قائمة على بيانات المستأجر الحالي فقط.
 */
import {
  ContextError,
  failure,
  success,
  type Result,
  type ScopeFilter,
  type SDKContext,
  type SDKContextStore,
  type TenantScopedFields,
} from '@/sdk/core';
import { SCOPE_RANK, type PermissionScope } from '@/sdk/rbac';
import type { TenancyRepository } from '../contracts/tenancy-repository';
import type {
  AccessibleStore,
  ActiveTenancy,
  TenancyHierarchy,
} from '../contracts/tenancy-contracts';
import { MIN_STORE_SWITCH_SCOPE } from '../contracts/tenancy-contracts';

/**
 * يبني نطاق الاستعلام من السياق حسب نطاق صلاحية المستخدم.
 * القاعدة: كلما ضاق نطاق المستخدم زادت حقول المطابقة (تضييق أشد للبيانات).
 */
export const buildScopeFilter = (context: SDKContext, userScope: PermissionScope): ScopeFilter => {
  // المستأجر أساس العزل ويُضاف دائمًا.
  const scope: {
    tenantId?: ScopeFilter['tenantId'];
    organizationId?: ScopeFilter['organizationId'];
    branchId?: ScopeFilter['branchId'];
    storeId?: ScopeFilter['storeId'];
  } = { tenantId: context.tenantId };
  // نطاق المؤسسة أو أضيق → نطابق المؤسسة أيضًا.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.organization) scope.organizationId = context.organizationId;
  // نطاق الفرع أو أضيق → نطابق الفرع.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.branch) scope.branchId = context.branchId;
  // نطاق المتجر أو own → نطابق المتجر النشط تحديدًا.
  if (SCOPE_RANK[userScope] <= SCOPE_RANK.store) scope.storeId = context.storeId;
  // نُعيد النطاق المحسوب.
  return scope;
};

// هل الكيان يقع داخل النطاق؟ (يقارن الحقول المطلوبة فقط).
export const matchesScope = (entity: Partial<TenantScopedFields>, scope: ScopeFilter): boolean => {
  // المستأجر يجب أن يتطابق دائمًا عند طلبه (عزل صارم).
  if (scope.tenantId !== undefined && String(entity.tenantId ?? '') !== String(scope.tenantId)) return false;
  // المؤسسة عند طلبها.
  if (scope.organizationId !== undefined && entity.organizationId !== undefined
    && String(entity.organizationId) !== String(scope.organizationId)) return false;
  // الفرع عند طلبه.
  if (scope.branchId !== undefined && entity.branchId !== undefined
    && String(entity.branchId) !== String(scope.branchId)) return false;
  // المتجر عند طلبه.
  if (scope.storeId !== undefined && entity.storeId !== undefined
    && String(entity.storeId) !== String(scope.storeId)) return false;
  // كل الحقول المطلوبة تطابقت.
  return true;
};

// يفلتر قائمة كيانات على النطاق (تُستخدمها كل المستودعات المحلية).
export const filterByScope = <T extends Partial<TenantScopedFields>>(
  items: readonly T[],
  scope: ScopeFilter,
): T[] => items.filter((item) => matchesScope(item, scope));

// الواجهة العلنية لخدمة تعدد المستأجرين (sdk.tenancy).
export interface TenancyService {
  // يحمّل الهرمية الكاملة للمستأجر الحالي.
  getHierarchy(): Promise<Result<TenancyHierarchy>>;
  // السياق النشط (المتجر المختار مع سلسلة آبائه).
  getActive(): Promise<Result<ActiveTenancy>>;
  // المتاجر المتاحة للتبديل حسب نطاق المستخدم.
  getAccessibleStores(userScope: PermissionScope): Promise<Result<readonly AccessibleStore[]>>;
  // هل يُسمح بتبديل المتجر لهذا النطاق؟
  canSwitchStore(userScope: PermissionScope): boolean;
  // يبدّل المتجر النشط ويحدّث السياق (عملة/ضريبة/فرع/مؤسسة).
  switchStore(storeId: string): Promise<Result<ActiveTenancy>>;
  // يبني نطاق الاستعلام الحالي.
  scopeFilter(userScope: PermissionScope): ScopeFilter;
  // يحرس عملية تتطلب مستأجرًا فقط.
  requireTenant(): Result<SDKContext>;
  // يحرس عملية تتطلب مستأجرًا ومتجرًا (كل عمليات نقطة البيع).
  requireStore(): Result<SDKContext>;
}

// تبعيات الخدمة.
export interface TenancyServiceDependencies {
  readonly repository: TenancyRepository; // مستودع الهرمية.
  readonly contextStore: SDKContextStore; // حاوية السياق.
}

// ينشئ خدمة تعدد المستأجرين بالحقن.
export const createTenancyService = (deps: TenancyServiceDependencies): TenancyService => ({
  // الهرمية الكاملة (تتطلب مستأجرًا في السياق).
  getHierarchy: async () => {
    // نقرأ السياق الحالي.
    const context = deps.contextStore.get();
    // بلا مستأجر لا يوجد ما يُحمَّل.
    if (context.tenantId === undefined) return failure(new ContextError(['tenantId']));
    // نطلب الهرمية من المستودع.
    return deps.repository.getHierarchy(context.tenantId);
  },

  // السياق النشط المبني من المتجر المختار.
  getActive: async () => {
    // نقرأ السياق.
    const context = deps.contextStore.get();
    // نحتاج مستأجرًا ومتجرًا معًا لبناء سياق نشط.
    if (context.tenantId === undefined || context.storeId === undefined) {
      // نُبلّغ بأسماء الحقول الناقصة تحديدًا.
      return failure(
        new ContextError([
          ...(context.tenantId === undefined ? ['tenantId'] : []),
          ...(context.storeId === undefined ? ['storeId'] : []),
        ]),
      );
    }
    // نطلب السياق النشط من المستودع.
    return deps.repository.getActiveTenancy(context.tenantId, context.storeId);
  },

  // المتاجر المتاحة للتبديل.
  getAccessibleStores: async (userScope) => {
    // نقرأ السياق.
    const context = deps.contextStore.get();
    // بلا مستأجر لا متاجر.
    if (context.tenantId === undefined) return failure(new ContextError(['tenantId']));
    // نطلبها مفلترة بالنطاق من المستودع.
    return deps.repository.getAccessibleStores(context.tenantId, userScope, context.storeId);
  },

  // التبديل مسموح لنطاق الفرع فأعلى فقط.
  canSwitchStore: (userScope) => SCOPE_RANK[userScope] >= SCOPE_RANK[MIN_STORE_SWITCH_SCOPE],

  // تبديل المتجر النشط.
  switchStore: async (storeId) => {
    // نقرأ السياق.
    const context = deps.contextStore.get();
    // نحتاج مستأجرًا.
    if (context.tenantId === undefined) return failure(new ContextError(['tenantId']));
    // نبني السياق النشط للمتجر الجديد (يتحقق المستودع من انتمائه للمستأجر).
    const activeResult = await deps.repository.getActiveTenancy(
      context.tenantId,
      storeId as ActiveTenancy['storeId'],
    );
    // فشل البناء يعني أن المتجر غير موجود أو خارج المستأجر → نمرّر الخطأ.
    if (!activeResult.success) return activeResult;
    // نحدّث السياق بالمتجر الجديد وسلسلة آبائه وعملته.
    deps.contextStore.patch({
      organizationId: activeResult.data.organizationId,
      branchId: activeResult.data.branchId,
      storeId: activeResult.data.storeId,
      currency: activeResult.data.currency,
    });
    // نحفظ الاختيار ليُستأنف عند التشغيل التالي (تجاهل فشل الحفظ لا يعطّل التبديل).
    await deps.repository.setActiveStore(activeResult.data.storeId);
    // نُعيد السياق النشط الجديد.
    return success(activeResult.data);
  },

  // نطاق الاستعلام الحالي.
  scopeFilter: (userScope) => buildScopeFilter(deps.contextStore.get(), userScope),

  // حراسة المستأجر.
  requireTenant: () => {
    // نقرأ السياق.
    const context = deps.contextStore.get();
    // نتحقق من وجود المستأجر.
    return context.tenantId === undefined ? failure(new ContextError(['tenantId'])) : success(context);
  },

  // حراسة المستأجر + المتجر.
  requireStore: () => {
    // نقرأ السياق.
    const context = deps.contextStore.get();
    // نجمع الحقول الناقصة.
    const missing = [
      ...(context.tenantId === undefined ? ['tenantId'] : []),
      ...(context.storeId === undefined ? ['storeId'] : []),
    ];
    // أي نقص يمنع العملية.
    return missing.length > 0 ? failure(new ContextError(missing)) : success(context);
  },
});
