/**
 * خدمة المبيعات — PHASE 31 · أقسام 18 و35 و68.
 * التدفّق الكامل لإنشاء بيع:
 * تحقّق ← تفويض ← نطاق ← بناء السلة ← تسعير ← ضريبة ← خصم ← فاتورة ←
 * مخزون ← حدث مجال ← تدقيق. كل خطوة تُوقف العملية عند فشلها.
 */
import {
  BusinessRuleError,
  ContextError,
  createAuditEvent,
  createDomainEvent,
  failure,
  money,
  success,
  systemClock,
  SDK_DOMAIN_EVENTS,
  type AsyncResult,
  type AuditLogger,
  type Clock,
  type DateRange,
  type EventPublisher,
  type PaginatedResult,
  type Result,
  type SaleId,
  type SDKContext,
  type SDKContextStore,
  type TenantId,
  validateWith,
} from '@/sdk/core';
import { assertCheckoutReady, createCart, addItem as addCartItem, applyDiscount, type Cart } from '@/sdk/cart';
import type { ProductRepository } from '@/sdk/products';
import type { RbacService } from '@/sdk/rbac';
import type { TenancyService } from '@/sdk/tenancy';
import type { Receipt, Sale } from '../contracts/sale-contracts';
import { canCancelSale, canRefundSale } from '../contracts/sale-contracts';
import type { SaleRepository } from '../contracts/sale-repository';
import {
  cancelSaleSchema,
  createSaleSchema,
  refundSaleSchema,
  type CancelSaleCommand,
  type CreateSaleCommand,
  type RefundSaleCommand,
  type SaleListQuery,
} from '../contracts/sale-commands';
import { buildSale, customerRef, markSaleCancelled, markSaleRefunded } from '../commands/sale-factory';

// الواجهة العلنية لخدمة المبيعات (sdk.sales).
export interface SaleService {
  // ينشئ فاتورة من بنود (يبني سلة داخليًا فتُطبَّق كل قواعد التسعير).
  create(command: CreateSaleCommand): AsyncResult<Sale>;
  // ينشئ فاتورة من سلة جاهزة (المسار الأساسي لنقطة البيع).
  createFromCart(cart: Cart, options?: { customerName?: string; cashierName?: string }): AsyncResult<Sale>;
  // يجلب فاتورة.
  get(id: SaleId): AsyncResult<Sale>;
  // يسرد الفواتير.
  list(query?: SaleListQuery): AsyncResult<PaginatedResult<Sale>>;
  // يلغي فاتورة قبل الدفع.
  cancel(command: CancelSaleCommand): AsyncResult<Sale>;
  // يسترجع فاتورة مدفوعة (كليًا أو جزئيًا).
  refund(command: RefundSaleCommand): AsyncResult<Sale>;
  // يبني إيصال فاتورة.
  getReceipt(id: SaleId): AsyncResult<Receipt>;
  // يقرأ سجل المبيعات لفترة (أساس التقارير).
  getHistory(range?: DateRange): AsyncResult<readonly Sale[]>;
}

// تبعيات الخدمة.
export interface SaleServiceDependencies {
  readonly repository: SaleRepository; // مستودع الفواتير.
  readonly products: ProductRepository; // مستودع المنتجات (أسعار وأرصدة).
  readonly rbac: RbacService; // الصلاحيات.
  readonly tenancy: TenancyService; // النطاق.
  readonly contextStore: SDKContextStore; // السياق.
  readonly events: EventPublisher; // الأحداث.
  readonly audit: AuditLogger; // التدقيق.
  readonly clock?: Clock; // الساعة.
  readonly defaultTaxRatePercent?: number; // نسبة الضريبة الافتراضية.
}

// ينشئ خدمة المبيعات بالحقن الكامل.
export const createSaleService = (deps: SaleServiceDependencies): SaleService => {
  // الساعة المستخدمة.
  const clock = deps.clock ?? systemClock;

  // بيانات التدقيق المشتركة من السياق.
  const auditBase = () => {
    // نقرأ السياق مرة واحدة.
    const context = deps.contextStore.get();
    // الحقول المشتركة لكل حدث تدقيق.
    return {
      actor: context.userId ?? ('system' as const),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      branchId: context.branchId,
      storeId: context.storeId,
    };
  };

  // حراسة موحّدة: سياق المتجر + الإذن المطلوب (تُعيد السياق المتحقَّق منه).
  const guard = async (resource: string, action: string): Promise<Result<SDKContext>> => {
    // كل عمليات البيع تتطلب متجرًا نشطًا.
    const contextResult = deps.tenancy.requireStore();
    if (!contextResult.success) return contextResult;
    // فحص الصلاحية والنطاق.
    const decision = await deps.rbac.can({ resource, action });
    // الرفض يُسجَّل في التدقيق ثم يُعاد.
    if (!decision.success) {
      deps.audit.record(
        createAuditEvent({ ...auditBase(), action: `${resource}.${action}`, resource, result: 'denied' }),
      );
      return decision;
    }
    // مسموح — نُعيد السياق ليُستخدم في بناء الفاتورة.
    return success(contextResult.data);
  };

  // يضيّق المستأجر إلى قيمة مؤكّدة (لا تحويل قسري).
  const tenantOf = (context: SDKContext): Result<TenantId> =>
    // غياب المستأجر خطأ سياق صريح.
    context.tenantId === undefined ? failure(new ContextError(['tenantId'])) : success(context.tenantId);

  // ينفّذ حفظ الفاتورة ونشر أحداثها وتدقيقها (خطوات مشتركة بين المسارين).
  const persistSale = async (sale: Sale): AsyncResult<Sale> => {
    // نخزّن الفاتورة.
    const created = await deps.repository.create(sale);
    // فشل التخزين يُمرَّر.
    if (!created.success) return created;
    // السياق للأحداث.
    const context = deps.contextStore.get();
    // حدث إنشاء البيع.
    deps.events.publish(
      createDomainEvent(
        SDK_DOMAIN_EVENTS.SALE_CREATED,
        {
          saleId: String(created.data.id),
          saleNumber: created.data.saleNumber,
          total: created.data.total.amount,
          currency: created.data.currency,
        },
        { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
      ),
    );
    // أثر التدقيق (عملية حسّاسة).
    deps.audit.record(
      createAuditEvent({
        ...auditBase(),
        action: 'sales.create',
        resource: 'sale',
        resourceId: String(created.data.id),
        metadata: {
          saleNumber: created.data.saleNumber,
          total: created.data.total.amount,
          currency: created.data.currency,
          lines: created.data.lines.length,
        },
      }),
    );
    // نُعيد الفاتورة المخزّنة.
    return created;
  };

  return {
    // ── إنشاء فاتورة من بنود مباشرة ──
    create: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(createSaleSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة.
      const allowed = await guard('pos', 'sale.create');
      if (!allowed.success) return allowed;
      // (2ب) المستأجر المؤكّد من السياق المحروس.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (3) نبني سلة داخلية فتُطبَّق قواعد التسعير والمخزون نفسها.
      const context = allowed.data;
      // سلة جديدة بعملة السياق ونسبة الضريبة المطبَّقة.
      let cart = createCart({
        currency: context.currency,
        taxRatePercent: deps.defaultTaxRatePercent ?? 0,
        storeId: context.storeId,
        tenantId: context.tenantId,
        clock,
      });
      // (4) نضيف كل بند بعد قراءة سعره ورصيده الحقيقيين.
      for (const item of command.items) {
        // نقرأ المنتج.
        const product = await deps.products.get(item.productId);
        // منتج غير موجود يُوقف العملية كاملة.
        if (!product.success) return product;
        // نضيفه للسلة (يفرض المحرّك قواعد الرصيد والعملة).
        const added = addCartItem(cart, product.data, item.quantity, clock);
        // فشل الإضافة يُوقف العملية.
        if (!added.success) return added;
        // نثبّت السلة الجديدة.
        cart = added.data;
        // خصم البند إن وُجد.
        if (item.discount) {
          // نطبّقه على البند تحديدًا.
          const discounted = applyDiscount(cart, item.discount, item.productId, clock);
          if (!discounted.success) return discounted;
          cart = discounted.data;
        }
      }
      // (5) خصم الفاتورة العام إن وُجد.
      if (command.discount) {
        const discounted = applyDiscount(cart, command.discount, undefined, clock);
        if (!discounted.success) return discounted;
        cart = discounted.data;
      }
      // (6) نتحقق أن السلة جاهزة للدفع (غير فارغة وإجماليها موجب).
      const ready = assertCheckoutReady(cart);
      if (!ready.success) return ready;
      // (7) الرقم التسلسلي التالي.
      const sequence = await deps.repository.nextSequence();
      if (!sequence.success) return sequence;
      // (8) نبني الفاتورة الثابتة.
      const sale = buildSale({
        cart,
        tenantId: tenant.data,
        sequence: sequence.data,
        customer: customerRef(command.customerId, command.customerName),
        cashierId: context.userId,
        cashierName: command.cashierName ?? 'كاشير',
        clock,
      });
      // (9) نحفظها وننشر أحداثها.
      return persistSale(sale);
    },

    // ── إنشاء فاتورة من سلة جاهزة (مسار نقطة البيع) ──
    createFromCart: async (cart, options) => {
      // (1) الحراسة.
      const allowed = await guard('pos', 'sale.create');
      if (!allowed.success) return allowed;
      // (1ب) المستأجر المؤكّد.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (2) جاهزية السلة.
      const ready = assertCheckoutReady(cart);
      if (!ready.success) return ready;
      // (3) الرقم التسلسلي.
      const sequence = await deps.repository.nextSequence();
      if (!sequence.success) return sequence;
      // (4) بناء الفاتورة.
      const context = allowed.data;
      const sale = buildSale({
        cart,
        tenantId: tenant.data,
        sequence: sequence.data,
        customer: customerRef(undefined, options?.customerName),
        cashierId: context.userId,
        cashierName: options?.cashierName ?? 'كاشير',
        clock,
      });
      // (5) الحفظ والنشر.
      return persistSale(sale);
    },

    // ── جلب فاتورة ──
    get: async (id) => {
      // حراسة القراءة.
      const allowed = await guard('orders', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.get(id);
    },

    // ── سرد الفواتير ──
    list: async (query) => {
      // حراسة القراءة.
      const allowed = await guard('orders', 'read');
      if (!allowed.success) return allowed;
      // تضييق النطاق حسب صلاحية المستخدم.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // التنفيذ.
      return deps.repository.list({ ...query, scope: query?.scope ?? scope });
    },

    // ── إلغاء فاتورة ──
    cancel: async (command) => {
      // (1) تحقّق المدخلات (السبب إلزامي).
      const validated = validateWith(cancelSaleSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن إدارة الطلبات.
      const allowed = await guard('orders', 'manage');
      if (!allowed.success) return allowed;
      // (3) نقرأ الفاتورة.
      const existing = await deps.repository.get(command.saleId);
      if (!existing.success) return existing;
      // (4) قاعدة عمل: لا إلغاء بعد التحصيل.
      if (!canCancelSale(existing.data)) {
        return failure(
          new BusinessRuleError('sdk.sales.error.cannotCancel', { details: { status: existing.data.status } }),
        );
      }
      // (5) التنفيذ.
      const cancelled = await deps.repository.update(markSaleCancelled(existing.data, clock));
      if (!cancelled.success) return cancelled;
      // (6) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(SDK_DOMAIN_EVENTS.SALE_CANCELLED, { saleId: String(command.saleId) }, {
          tenantId: context.tenantId,
          storeId: context.storeId,
          actorId: context.userId,
        }),
      );
      // (7) التدقيق مع السبب.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'sales.cancel',
          resource: 'sale',
          resourceId: String(command.saleId),
          metadata: { reason: command.reasonKey },
        }),
      );
      // الفاتورة الملغاة.
      return cancelled;
    },

    // ── استرجاع فاتورة ──
    refund: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(refundSaleSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن الاسترجاع (نطاقه أوسع في الفهرس القانوني).
      const allowed = await guard('payment', 'refund');
      if (!allowed.success) return allowed;
      // (3) نقرأ الفاتورة.
      const existing = await deps.repository.get(command.saleId);
      if (!existing.success) return existing;
      // (4) قاعدة عمل: الاسترجاع يتطلب تحصيلًا سابقًا.
      if (!canRefundSale(existing.data)) {
        return failure(
          new BusinessRuleError('sdk.sales.error.cannotRefund', { details: { status: existing.data.status } }),
        );
      }
      // (5) المبلغ المسترجع: المحدد أو المتبقي كاملًا.
      const remaining = existing.data.paidAmount.amount - existing.data.refundedAmount.amount;
      const amount = command.amount ?? remaining;
      // (6) قاعدة عمل: لا يتجاوز الاسترجاع المتبقي.
      if (amount > remaining + 0.005) {
        return failure(
          new BusinessRuleError('sdk.sales.error.refundExceedsPaid', {
            details: { requested: amount, remaining },
          }),
        );
      }
      // (7) التنفيذ.
      const refunded = await deps.repository.update(markSaleRefunded(existing.data, amount, clock));
      if (!refunded.success) return refunded;
      // (8) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(
          SDK_DOMAIN_EVENTS.SALE_REFUNDED,
          { saleId: String(command.saleId), amount, currency: existing.data.currency },
          { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
        ),
      );
      // (9) التدقيق (عملية مالية حسّاسة).
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'sales.refund',
          resource: 'sale',
          resourceId: String(command.saleId),
          metadata: {
            amount: money(amount, existing.data.currency).amount,
            currency: existing.data.currency,
            reason: command.reasonKey,
          },
        }),
      );
      // الفاتورة بعد الاسترجاع.
      return refunded;
    },

    // ── الإيصال ──
    getReceipt: async (id) => {
      // حراسة إنشاء/قراءة الإيصال.
      const allowed = await guard('receipt', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.getReceipt(id);
    },

    // ── سجل المبيعات ──
    getHistory: async (range) => {
      // حراسة القراءة.
      const allowed = await guard('orders', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.getHistory(range);
    },
  };
};
