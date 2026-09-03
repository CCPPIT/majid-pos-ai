/**
 * عقد مستودع المبيعات — PHASE 31 · قسم 30.
 */
import type { AsyncResult, DateRange, Money, PaginatedResult, PaymentId, SaleId } from '@/sdk/core';
import type { Receipt, Sale } from './sale-contracts';
import type { SaleListQuery } from './sale-commands';

// مستودع الفواتير.
export interface SaleRepository {
  // يخزّن فاتورة جديدة (مبنية مسبقًا في طبقة المجال).
  create(sale: Sale): AsyncResult<Sale>;
  // يجلب فاتورة بالمعرّف (خطأ NotFound عند الغياب).
  get(id: SaleId): AsyncResult<Sale>;
  // يسرد الفواتير مُرقَّمة.
  list(query?: SaleListQuery): AsyncResult<PaginatedResult<Sale>>;
  // يحدّث فاتورة قائمة (تغيّر حالة/دفع/استرجاع).
  update(sale: Sale): AsyncResult<Sale>;
  // يقرأ الرقم التسلسلي التالي للفواتير (لتوليد رقم بشري متسلسل).
  nextSequence(): AsyncResult<number>;
  // يبني إيصال فاتورة.
  getReceipt(id: SaleId): AsyncResult<Receipt>;
  // يسجّل ربط دفعة بفاتورة ويحدّث المبلغ المُحصَّل.
  attachPayment(id: SaleId, paymentId: PaymentId, amount: Money): AsyncResult<Sale>;
  // يقرأ سجل مبيعات ضمن نطاق زمني (أساس التقارير والتحليلات).
  getHistory(range?: DateRange): AsyncResult<readonly Sale[]>;
}
