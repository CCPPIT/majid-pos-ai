/**
 * عقد مستودع المدفوعات — PHASE 31 · قسم 30.
 */
import type { AsyncResult, PaginatedResult, PaymentId, SaleId } from '@/sdk/core';
import type { Payment } from './payment-contracts';
import type { PaymentListQuery } from './payment-commands';

// مستودع الدفعات.
export interface PaymentRepository {
  // يخزّن دفعة جديدة.
  create(payment: Payment): AsyncResult<Payment>;
  // يجلب دفعة بالمعرّف.
  get(id: PaymentId): AsyncResult<Payment>;
  // يحدّث دفعة (تغيّر حالة أو استرجاع).
  update(payment: Payment): AsyncResult<Payment>;
  // يسرد الدفعات مُرقَّمة.
  list(query?: PaymentListQuery): AsyncResult<PaginatedResult<Payment>>;
  // يقرأ كل دفعات فاتورة.
  listBySale(saleId: SaleId): AsyncResult<readonly Payment[]>;
}
