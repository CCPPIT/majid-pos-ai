/**
 * خدمة المدفوعات — PHASE 31 · أقسام 19 و45 و68.
 * تدفّق التحصيل: تحقّق ← تفويض ← قراءة الفاتورة ← تحقق المبلغ ←
 * تنفيذ لدى المزوّد ← تخزين الدفعة ← ربطها بالفاتورة ← حدث ← تدقيق.
 * لا يعرف الـSDK أي بوابة: المزوّد يُحقن كمنفذ (Port).
 */
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
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
  type EventPublisher,
  type PaginatedResult,
  type PaymentId,
  type PaymentProvider,
  type Result,
  type SDKContextStore,
  validateWith,
} from '@/sdk/core';
import type { RbacService } from '@/sdk/rbac';
import type { TenancyService } from '@/sdk/tenancy';
import type { SaleRepository } from '@/sdk/sales';
import { markSalePaid } from '@/sdk/sales';
import {
  canRefundPayment,
  refundableAmount,
  toProviderMethod,
  type Payment,
  type PaymentSplit,
} from '../contracts/payment-contracts';
import type { PaymentRepository } from '../contracts/payment-repository';
import {
  processPaymentSchema,
  refundPaymentSchema,
  type PaymentListQuery,
  type ProcessPaymentCommand,
  type RefundPaymentCommand,
} from '../contracts/payment-commands';
import {
  calculateChange,
  isSufficient,
  requiresProvider,
  requiresTendered,
  splitsCoverTotal,
} from '../calculations/payment-calculator';

// الواجهة العلنية لخدمة المدفوعات (sdk.payments).
export interface PaymentService {
  // يعالج دفعة على فاتورة.
  process(command: ProcessPaymentCommand): AsyncResult<Payment>;
  // يجلب دفعة.
  get(id: PaymentId): AsyncResult<Payment>;
  // يسرد الدفعات.
  list(query?: PaymentListQuery): AsyncResult<PaginatedResult<Payment>>;
  // يسترجع دفعة (كليًا أو جزئيًا).
  refund(command: RefundPaymentCommand): AsyncResult<Payment>;
  // يقرأ طرق الدفع المتاحة فعليًا (حسب المزوّدين المسجّلين).
  availableMethods(): readonly Payment['method'][];
}

// تبعيات الخدمة.
export interface PaymentServiceDependencies {
  readonly repository: PaymentRepository; // مستودع الدفعات.
  readonly sales: SaleRepository; // مستودع الفواتير (لربط الدفعة).
  readonly rbac: RbacService; // الصلاحيات.
  readonly tenancy: TenancyService; // النطاق.
  readonly contextStore: SDKContextStore; // السياق.
  readonly events: EventPublisher; // الأحداث.
  readonly audit: AuditLogger; // التدقيق.
  readonly providers?: readonly PaymentProvider[]; // مزوّدو الدفع المسجّلون (عقد النواة).
  readonly clock?: Clock; // الساعة.
}

// عدّاد داخلي لتوليد معرّفات الدفعات.
let paymentSequence = 0;

// ينشئ خدمة المدفوعات بالحقن.
export const createPaymentService = (deps: PaymentServiceDependencies): PaymentService => {
  // الساعة المستخدمة.
  const clock = deps.clock ?? systemClock;
  // قائمة المزوّدين (فارغة تعني نقدًا وآجلًا فقط).
  const providers = deps.providers ?? [];

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

  // حراسة موحّدة (سياق + صلاحية).
  const guard = async (resource: string, action: string): Promise<Result<true>> => {
    // كل عمليات الدفع تتطلب متجرًا نشطًا.
    const contextResult = deps.tenancy.requireStore();
    if (!contextResult.success) return contextResult;
    // فحص الصلاحية.
    const decision = await deps.rbac.can({ resource, action });
    // الرفض يُسجَّل ثم يُعاد.
    if (!decision.success) {
      deps.audit.record(
        createAuditEvent({ ...auditBase(), action: `${resource}.${action}`, resource, result: 'denied' }),
      );
      return decision;
    }
    // مسموح.
    return success(true);
  };

  // يجد مزوّدًا يدعم طريقة الدفع المطلوبة (بعد تحويلها للطريقة المجرّدة).
  const findProvider = (method: Payment['method']): PaymentProvider | undefined =>
    providers.find((provider) => provider.supports(toProviderMethod(method)));

  return {
    // ── معالجة دفعة ──
    process: async (command) => {
      // (1) تحقّق المدخلات (يشمل قواعد النقد والدفع المقسّم).
      const validated = validateWith(processPaymentSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن التحصيل.
      const allowed = await guard('payment', 'process');
      if (!allowed.success) return allowed;
      // (3) نقرأ الفاتورة المستهدفة.
      const sale = await deps.sales.get(command.saleId);
      if (!sale.success) return sale;
      // (4) قاعدة عمل: لا تحصيل على فاتورة ملغاة أو مسترجعة.
      if (sale.data.status === 'cancelled' || sale.data.status === 'refunded') {
        return failure(
          new BusinessRuleError('sdk.payments.error.saleNotPayable', { details: { status: sale.data.status } }),
        );
      }
      // (5) قاعدة عمل: لا تحصيل يتجاوز المتبقي على الفاتورة.
      const outstanding = sale.data.total.amount - sale.data.paidAmount.amount;
      if (command.amount > outstanding + 0.005) {
        return failure(
          new BusinessRuleError('sdk.payments.error.amountExceedsOutstanding', {
            details: { requested: command.amount, outstanding },
          }),
        );
      }
      // (6) عملة العملية من الفاتورة (مصدر الحقيقة).
      const currency = sale.data.currency;
      // المبلغ المستحق كنقود.
      const due = money(command.amount, currency);
      // (7) الدفع النقدي: تحقّق كفاية المُسلَّم.
      const tendered = money(command.tendered ?? command.amount, currency);
      if (requiresTendered(command.method) && !isSufficient(due, tendered)) {
        return failure(
          new ValidationError('sdk.payments.error.insufficientTendered', {
            tendered: 'sdk.validation.insufficientAmount',
          }),
        );
      }
      // (8) الدفع المقسّم: تحقّق تطابق مجموع الأجزاء مع المستحق.
      const splits: PaymentSplit[] = (command.splits ?? []).map((split) => ({
        method: split.method,
        amount: money(split.amount, currency),
        reference: split.reference,
      }));
      if (command.method === 'split' && !splitsCoverTotal(splits, due)) {
        return failure(
          new ValidationError('sdk.payments.error.splitMismatch', {
            splits: 'sdk.validation.splitTotalMismatch',
          }),
        );
      }
      // (9) الطرق التي تتطلب مزوّدًا: نتحقق من توفّره ثم ننفّذ لديه.
      let providerReference: string | undefined;
      let providerId: string | undefined;
      // معرّف الدفعة: يُحجز مبكرًا في مسار البوابة، ويُولَّد هنا في المسار المحلي.
      let reservedPaymentId: PaymentId | undefined;
      if (requiresProvider(command.method)) {
        // نبحث عن مزوّد مناسب.
        const provider = findProvider(command.method);
        // غياب المزوّد خطأ صريح لا تجاهل صامت.
        if (!provider) {
          return failure(
            new BusinessRuleError('sdk.payments.error.noProvider', { details: { method: command.method } }),
          );
        }
        // معرّف الدفعة المحلي يُحجز قبل مخاطبة البوابة (لربط العمليتين).
        const localPaymentId = `pay-${(paymentSequence += 1)}-${clock.timestamp().toString(36)}` as PaymentId;
        // (أ) نفوّض المبلغ لدى البوابة (حجز دون تحصيل).
        const authorization = await provider.authorize({
          paymentId: localPaymentId,
          saleId: command.saleId,
          reference: command.reference ?? sale.data.saleNumber,
          method: toProviderMethod(command.method),
          amount: due,
        });
        // فشل الاتصال بالبوابة يُعاد كخطأ كما هو.
        if (!authorization.success) return authorization;
        // رفض التفويض يُخزَّن كدفعة فاشلة ثم يُعاد كخطأ.
        if (!authorization.data.authorized) {
          // نبني الدفعة الفاشلة لأثر التدقيق.
          const failed: Payment = {
            id: localPaymentId,
            saleId: command.saleId,
            method: command.method,
            status: 'failed',
            currency,
            amount: due,
            tendered: money(0, currency),
            change: money(0, currency),
            refundedAmount: money(0, currency),
            splits,
            providerId: provider.id,
            providerReference: authorization.data.providerReference,
            cashierId: deps.contextStore.get().userId,
            failureReasonKey: 'sdk.payments.error.declined',
            tenantId: sale.data.tenantId,
            storeId: sale.data.storeId,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          // نخزّنها (سجل المحاولات الفاشلة مطلوب للتدقيق المالي).
          await deps.repository.create(failed);
          // ننشر حدث الفشل.
          deps.events.publish(
            createDomainEvent(
              SDK_DOMAIN_EVENTS.PAYMENT_FAILED,
              { paymentId: String(failed.id), saleId: String(command.saleId), reason: failed.failureReasonKey },
              { tenantId: sale.data.tenantId, storeId: sale.data.storeId, actorId: failed.cashierId },
            ),
          );
          // ونُعيد الخطأ للمستدعي.
          return failure(
            new BusinessRuleError(failed.failureReasonKey ?? 'sdk.payments.error.declined', {
              details: { reference: authorization.data.providerReference },
            }),
          );
        }
        // (ب) نحصّل المبلغ المفوَّض فعليًا (لا نكتفي بالحجز).
        const capture = await provider.capture(authorization.data.providerReference, due);
        // فشل الاتصال يُعاد.
        if (!capture.success) return capture;
        // فشل التحصيل بعد تفويض ناجح حالة تتطلب تدخّلًا (الحجز قائم والمال لم يُقبض).
        if (!capture.data.captured) {
          return failure(
            new BusinessRuleError('sdk.payments.error.captureFailed', {
              details: { reference: authorization.data.providerReference },
            }),
          );
        }
        // نحتفظ بمرجع المزوّد للدفعة الناجحة.
        providerReference = capture.data.providerReference;
        providerId = provider.id;
        // نستخدم المعرّف المحجوز نفسه للدفعة الناجحة.
        reservedPaymentId = localPaymentId;
      }
      // (10) نبني الدفعة الناجحة.
      const payment: Payment = {
        id: reservedPaymentId ?? (`pay-${(paymentSequence += 1)}-${clock.timestamp().toString(36)}` as PaymentId),
        saleId: command.saleId,
        method: command.method,
        status: 'succeeded',
        currency,
        amount: due,
        // المُسلَّم يساوي المستحق في غير النقد.
        tendered: requiresTendered(command.method) ? tendered : due,
        // الباقي يُحسب للنقد فقط.
        change: requiresTendered(command.method) ? calculateChange(due, tendered) : money(0, currency),
        refundedAmount: money(0, currency),
        splits,
        providerId,
        providerReference,
        cashierId: deps.contextStore.get().userId,
        tenantId: sale.data.tenantId,
        storeId: sale.data.storeId,
        processedAt: clock.now(),
        createdAt: clock.now(),
        updatedAt: clock.now(),
      };
      // (11) نخزّن الدفعة.
      const created = await deps.repository.create(payment);
      if (!created.success) return created;
      // (12) نحدّث الفاتورة بالمبلغ المُحصَّل (ربط الدفعة بالبيع).
      const updatedSale = await deps.sales.update(
        markSalePaid(sale.data, command.amount, created.data.id, clock),
      );
      // فشل تحديث الفاتورة تعارض صريح (الدفعة مخزّنة والفاتورة لم تُحدَّث).
      if (!updatedSale.success) {
        return failure(
          new ConflictError('sdk.payments.error.saleUpdateFailed', {
            details: { paymentId: String(created.data.id) },
          }),
        );
      }
      // (13) أحداث المجال: نجاح الدفع، واكتمال البيع إن سُدِّد بالكامل.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(
          SDK_DOMAIN_EVENTS.PAYMENT_COMPLETED,
          {
            paymentId: String(created.data.id),
            saleId: String(command.saleId),
            amount: command.amount,
            method: command.method,
            currency,
          },
          { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
        ),
      );
      // اكتمال الفاتورة يُنشر كحدث منفصل (تستهلكه التقارير والمخزون).
      if (updatedSale.data.status === 'paid') {
        deps.events.publish(
          createDomainEvent(
            SDK_DOMAIN_EVENTS.SALE_COMPLETED,
            {
              saleId: String(updatedSale.data.id),
              saleNumber: updatedSale.data.saleNumber,
              total: updatedSale.data.total.amount,
              currency,
              lines: updatedSale.data.lines.map((line) => ({
                productId: String(line.productId),
                quantity: line.quantity,
              })),
            },
            { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
          ),
        );
      }
      // (14) أثر التدقيق المالي.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'payments.process',
          resource: 'payment',
          resourceId: String(created.data.id),
          metadata: {
            saleId: String(command.saleId),
            method: command.method,
            amount: command.amount,
            currency,
          },
        }),
      );
      // الدفعة الناجحة.
      return created;
    },

    // ── جلب دفعة ──
    get: async (id) => {
      // حراسة القراءة.
      const allowed = await guard('payment', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.get(id);
    },

    // ── سرد الدفعات ──
    list: async (query) => {
      // حراسة القراءة.
      const allowed = await guard('payment', 'read');
      if (!allowed.success) return allowed;
      // تضييق النطاق.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // التنفيذ.
      return deps.repository.list({ ...query, scope: query?.scope ?? scope });
    },

    // ── استرجاع دفعة ──
    refund: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(refundPaymentSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن الاسترجاع (أعلى حساسية).
      const allowed = await guard('payment', 'refund');
      if (!allowed.success) return allowed;
      // (3) نقرأ الدفعة.
      const existing = await deps.repository.get(command.paymentId);
      if (!existing.success) return existing;
      // (4) قاعدة عمل: قابلية الاسترجاع.
      if (!canRefundPayment(existing.data)) {
        return failure(
          new BusinessRuleError('sdk.payments.error.cannotRefund', { details: { status: existing.data.status } }),
        );
      }
      // (5) المبلغ: المحدد أو المتبقي كاملًا.
      const remaining = refundableAmount(existing.data);
      const amount = command.amount ?? remaining;
      // (6) قاعدة عمل: لا يتجاوز المتبقي.
      if (amount > remaining + 0.005) {
        return failure(
          new BusinessRuleError('sdk.payments.error.refundExceedsPayment', {
            details: { requested: amount, remaining },
          }),
        );
      }
      // (7) الاسترجاع لدى المزوّد إن كانت العملية عبره.
      if (existing.data.providerId !== undefined && existing.data.providerReference !== undefined) {
        // نبحث عن المزوّد الأصلي بالمعرّف.
        const provider = providers.find((candidate) => candidate.id === existing.data.providerId);
        // غيابه يمنع الاسترجاع (لا استرجاع وهمي).
        if (!provider) {
          return failure(new NotFoundError('paymentProvider', existing.data.providerId));
        }
        // ننفّذ الاسترجاع بتوقيع عقد النواة.
        const outcome = await provider.refund(
          existing.data.providerReference,
          money(amount, existing.data.currency),
        );
        // فشل الاتصال يُعاد كما هو.
        if (!outcome.success) return outcome;
        // رفض المزوّد للاسترجاع يُعاد كخطأ قاعدة عمل.
        if (!outcome.data.captured) {
          return failure(
            new BusinessRuleError('sdk.payments.error.refundDeclined', {
              details: { reference: outcome.data.providerReference },
            }),
          );
        }
      }
      // (8) نحدّث الدفعة بالمبلغ المسترجع.
      const totalRefunded = existing.data.refundedAmount.amount + amount;
      // هل استُرجع كامل المبلغ؟
      const fullyRefunded = totalRefunded + 0.005 >= existing.data.amount.amount;
      // الدفعة المحدّثة.
      const updated = await deps.repository.update({
        ...existing.data,
        refundedAmount: money(totalRefunded, existing.data.currency),
        status: fullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: clock.now(),
      });
      if (!updated.success) return updated;
      // (9) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(
          SDK_DOMAIN_EVENTS.SALE_REFUNDED,
          { paymentId: String(command.paymentId), saleId: String(existing.data.saleId), amount },
          { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
        ),
      );
      // (10) التدقيق مع السبب.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'payments.refund',
          resource: 'payment',
          resourceId: String(command.paymentId),
          metadata: { amount, currency: existing.data.currency, reason: command.reasonKey },
        }),
      );
      // الدفعة بعد الاسترجاع.
      return updated;
    },

    // ── الطرق المتاحة فعليًا ──
    availableMethods: () => {
      // النقد والآجل متاحان دائمًا (معالجة محلية).
      const methods: Payment['method'][] = ['cash', 'credit'];
      // نضيف ما يدعمه المزوّدون المسجّلون فعلًا.
      for (const method of ['card', 'wallet', 'transfer'] as const) {
        // نضيف الطريقة إن وُجد مزوّد يدعمها.
        if (providers.some((provider) => provider.supports(toProviderMethod(method)))) methods.push(method);
      }
      // الدفع المقسّم متاح متى توفّرت طريقتان على الأقل.
      if (methods.length >= 2) methods.push('split');
      // القائمة النهائية.
      return methods;
    },
  };
};
