/**
 * مستودع المدفوعات (PHASE 14).
 * ينسّق: معالجة الدفعة عبر المزود (محايد)، تخزين سجل الدفعة،
 * وتحديث حالة الطلب إلى "مدفوع". واجهته ثابتة عند ربط بوابة حقيقية.
 */
import type { ID } from '@/core/types/domain';
import {
  completePayment,
  createPayment,
  failPayment,
} from '@/domain/payments/calculations';
import type { Payment, PaymentMethod, TenderResult } from '@/domain/payments/types';
import type { PaymentProvider } from '@/domain/payments/provider';
import { markOrderPaid } from '@/domain/sales/order';
import type { SaleOrder } from '@/domain/sales/types';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import type { PaymentsSource } from '../sources/payments.source';
import type { OrdersSource } from '../sources/orders.source';

// نتيجة محاولة الدفع.
export interface PayResult {
  ok: boolean;
  payment?: Payment; // الدفعة (نجحت أو فشلت).
  updatedOrder?: SaleOrder; // الطلب بعد التحديث.
  errorKey?: string; // سبب الفشل (مفتاح ترجمة).
}

// واجهة المستودع.
export interface PaymentsRepository {
  // يعالج دفعة لطلب: المزود → التخزين → تحديث الطلب.
  payOrder(input: {
    order: SaleOrder;
    method: PaymentMethod;
    tender?: TenderResult; // للنقدي (قبض/باقي).
  }): Promise<PayResult>;
  // يجلب دفعات طلب معين.
  listPaymentsForOrder(orderId: ID): Promise<Payment[]>;
  // يجلب كل الدفعات (مستخدمة في تقارير طرق الدفع — PHASE 22).
  listAllPayments(): Promise<Payment[]>;
}

// التنفيذ المحلي.
export class AppPaymentsRepository implements PaymentsRepository {
  constructor(
    private readonly provider: PaymentProvider, // مزود الدفع (محاكى اليوم).
    private readonly paymentsSource: PaymentsSource, // تخزين الدفعات.
    private readonly ordersSource: OrdersSource, // لتحديث حالة الطلب.
  ) {}

  async payOrder(input: {
    order: SaleOrder;
    method: PaymentMethod;
    tender?: TenderResult;
  }): Promise<PayResult> {
    const { order, method, tender } = input;

    // النقدي يتطلب قبضًا كافيًا.
    if (method === 'cash' && tender && !tender.isSufficient) {
      return { ok: false, errorKey: 'pay.error.insufficientCash' };
    }
    if (!this.provider.supports(method)) {
      return { ok: false, errorKey: 'pay.error.unsupported' };
    }

    // ننشئ سجل الدفعة (مع القبض/الباقي للنقدي).
    let payment = createPayment(
      order.id,
      order.orderNumber,
      method,
      order.total,
      tender?.tendered,
      tender?.changeDue,
    );

    // نعالج عبر المزود (محاكى/بوابة).
    const outcome = await this.provider.process({
      method,
      amount: order.total,
      orderNumber: order.orderNumber,
    });

    if (!('reference' in outcome)) {
      const failed = failPayment(payment);
      await this.paymentsSource.appendPayment(failed);
      return { ok: false, payment: failed, errorKey: outcome.errorKey };
    }

    // نجاح: نكمل الدفعة ونخزّنها.
    payment = completePayment(payment, outcome.reference);
    await this.paymentsSource.appendPayment(payment);

    // نحدّث الطلب إلى مدفوع ونحفظه.
    const updatedOrder = markOrderPaid(order);
    await this.ordersSource.updateOrder(updatedOrder);

    // نبث اكتمال الدفع ليلتقطه طابور المزامنة (PHASE 23).
    appEventBus.emit(DOMAIN_EVENTS.PAYMENT_COMPLETED, {
      orderId: String(order.id),
      orderNumber: order.orderNumber,
      paymentId: String(payment.id),
      method: payment.method,
    });

    return { ok: true, payment, updatedOrder };
  }

  async listPaymentsForOrder(orderId: ID): Promise<Payment[]> {
    const all = await this.paymentsSource.listPayments();
    return all.filter((p) => String(p.orderId) === String(orderId));
  }

  // كل الدفعات (لتقارير طرق الدفع).
  async listAllPayments(): Promise<Payment[]> {
    return this.paymentsSource.listPayments();
  }
}
