/**
 * خدمة العملاء — PHASE 31 · أقسام 21 و22 و68.
 */
import {
  BusinessRuleError,
  ConflictError,
  createAuditEvent,
  createDomainEvent,
  failure,
  success,
  SDK_DOMAIN_EVENTS,
  type AsyncResult,
  type AuditLogger,
  type CustomerId,
  type EventPublisher,
  type PaginatedResult,
  type Result,
  type SDKContext,
  type SDKContextStore,
  validateWith,
} from '@/sdk/core';
import type { RbacService } from '@/sdk/rbac';
import type { TenancyService } from '@/sdk/tenancy';
import {
  calculatePoints,
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerCommand,
  type Customer,
  type CustomerListQuery,
  type CustomerPurchaseRef,
  type CustomerRepository,
  type UpdateCustomerCommand,
} from '../contracts/customer-contracts';

// الواجهة العلنية لخدمة العملاء (sdk.customers).
export interface CustomerService {
  // يسرد العملاء.
  list(query?: CustomerListQuery): AsyncResult<PaginatedResult<Customer>>;
  // يجلب عميلًا.
  get(id: CustomerId): AsyncResult<Customer>;
  // يبحث بالهاتف.
  findByPhone(phone: string): AsyncResult<Customer | null>;
  // ينشئ عميلًا (يمنع تكرار الهاتف).
  create(command: CreateCustomerCommand): AsyncResult<Customer>;
  // يعدّل عميلًا.
  update(command: UpdateCustomerCommand): AsyncResult<Customer>;
  // يسجّل شراءً على ملفه.
  recordPurchase(id: CustomerId, purchase: CustomerPurchaseRef): AsyncResult<Customer>;
  // يستبدل نقاطًا.
  redeemPoints(id: CustomerId, points: number): AsyncResult<Customer>;
}

// تبعيات الخدمة.
export interface CustomerServiceDependencies {
  readonly repository: CustomerRepository; // المستودع.
  readonly rbac: RbacService; // الصلاحيات.
  readonly tenancy: TenancyService; // النطاق.
  readonly contextStore: SDKContextStore; // السياق.
  readonly events: EventPublisher; // الأحداث.
  readonly audit: AuditLogger; // التدقيق.
}

// ينشئ خدمة العملاء بالحقن.
export const createCustomerService = (deps: CustomerServiceDependencies): CustomerService => {
  // بيانات التدقيق المشتركة.
  const auditBase = () => {
    // السياق الحالي.
    const context = deps.contextStore.get();
    // الحقول المشتركة.
    return {
      actor: context.userId ?? ('system' as const),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      branchId: context.branchId,
      storeId: context.storeId,
    };
  };

  // حراسة موحّدة (العملاء يتبعون المستأجر لا المتجر بالضرورة).
  const guard = async (action: string): Promise<Result<SDKContext>> => {
    // نتحقق من وجود مستأجر.
    const contextResult = deps.tenancy.requireTenant();
    if (!contextResult.success) return contextResult;
    // فحص الصلاحية.
    const decision = await deps.rbac.can({ resource: 'customers', action });
    // الرفض يُسجَّل.
    if (!decision.success) {
      deps.audit.record(
        createAuditEvent({ ...auditBase(), action: `customers.${action}`, resource: 'customers', result: 'denied' }),
      );
      return decision;
    }
    // مسموح مع السياق.
    return success(contextResult.data);
  };

  return {
    // ── السرد ──
    list: async (query) => {
      // حراسة القراءة.
      const allowed = await guard('read');
      if (!allowed.success) return allowed;
      // تضييق النطاق.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // التنفيذ.
      return deps.repository.list({ ...query, scope: query?.scope ?? scope });
    },

    // ── الجلب ──
    get: async (id) => {
      // حراسة القراءة.
      const allowed = await guard('read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.get(id);
    },

    // ── البحث بالهاتف ──
    findByPhone: async (phone) => {
      // حراسة القراءة.
      const allowed = await guard('read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.findByPhone(phone);
    },

    // ── الإنشاء ──
    create: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(createCustomerSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة.
      const allowed = await guard('create');
      if (!allowed.success) return allowed;
      // (3) قاعدة عمل: الهاتف مُعرّف فريد عمليًا (منع التكرار).
      if (command.phone !== undefined && command.phone.trim().length > 0) {
        // نبحث عن عميل بنفس الهاتف.
        const existing = await deps.repository.findByPhone(command.phone);
        // وجوده تعارض صريح.
        if (existing.success && existing.data !== null) {
          return failure(new ConflictError('sdk.customers.error.phoneTaken', { details: { phone: command.phone } }));
        }
      }
      // (4) التنفيذ.
      const created = await deps.repository.create(command);
      if (!created.success) return created;
      // (5) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(
          SDK_DOMAIN_EVENTS.CUSTOMER_CREATED,
          { customerId: String(created.data.id), name: created.data.fullName },
          { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
        ),
      );
      // (6) التدقيق.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'customers.create',
          resource: 'customer',
          resourceId: String(created.data.id),
        }),
      );
      // العميل المُنشأ.
      return created;
    },

    // ── التعديل ──
    update: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(updateCustomerSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة.
      const allowed = await guard('update');
      if (!allowed.success) return allowed;
      // (3) قاعدة عمل: منع تكرار الهاتف مع عميل آخر.
      if (command.phone !== undefined && command.phone.trim().length > 0) {
        // نبحث عن حامل الهاتف.
        const existing = await deps.repository.findByPhone(command.phone);
        // تعارض إن كان عميلًا مختلفًا.
        if (existing.success && existing.data !== null && String(existing.data.id) !== String(command.id)) {
          return failure(new ConflictError('sdk.customers.error.phoneTaken', { details: { phone: command.phone } }));
        }
      }
      // (4) التنفيذ.
      const updated = await deps.repository.update(command);
      if (!updated.success) return updated;
      // (5) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(
          SDK_DOMAIN_EVENTS.CUSTOMER_UPDATED,
          { customerId: String(updated.data.id) },
          { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
        ),
      );
      // (6) التدقيق.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'customers.update',
          resource: 'customer',
          resourceId: String(command.id),
        }),
      );
      // العميل المعدَّل.
      return updated;
    },

    // ── تسجيل شراء ──
    recordPurchase: async (id, purchase) => {
      // حراسة التعديل (تسجيل الشراء يغيّر رصيد الولاء).
      const allowed = await guard('update');
      if (!allowed.success) return allowed;
      // التنفيذ (المستودع يحدّث الإنفاق والنقاط والشريحة).
      const updated = await deps.repository.recordPurchase(id, purchase);
      if (!updated.success) return updated;
      // التدقيق مع النقاط المكتسبة.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'customers.recordPurchase',
          resource: 'customer',
          resourceId: String(id),
          metadata: {
            saleId: String(purchase.saleId),
            amount: purchase.total.amount,
            pointsEarned: calculatePoints(purchase.total.amount),
          },
        }),
      );
      // العميل المحدَّث.
      return updated;
    },

    // ── استبدال النقاط ──
    redeemPoints: async (id, points) => {
      // (1) الحراسة بإذن منفصل (عملية ذات قيمة مالية).
      const allowed = await guard('loyalty.redeem');
      if (!allowed.success) return allowed;
      // (2) قاعدة عمل: نقاط موجبة فقط.
      if (!Number.isInteger(points) || points <= 0) {
        return failure(new BusinessRuleError('sdk.customers.error.invalidPoints'));
      }
      // (3) نقرأ العميل للتحقق من رصيده.
      const customer = await deps.repository.get(id);
      if (!customer.success) return customer;
      // (4) قاعدة عمل: لا استبدال بما يتجاوز الرصيد.
      if (points > customer.data.pointsBalance) {
        return failure(
          new BusinessRuleError('sdk.customers.error.insufficientPoints', {
            details: { requested: points, balance: customer.data.pointsBalance },
          }),
        );
      }
      // (5) التنفيذ.
      const updated = await deps.repository.redeemPoints(id, points);
      if (!updated.success) return updated;
      // (6) التدقيق (خصم قيمة).
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'customers.redeemPoints',
          resource: 'customer',
          resourceId: String(id),
          metadata: { points, remaining: updated.data.pointsBalance },
        }),
      );
      // العميل المحدَّث.
      return updated;
    },
  };
};
