/**
 * منطق شاشة الدفع (PHASE 14).
 * يدير: تحميل الطلب، اختيار الطريقة، إدخال القبض النقدي وحساب الباقي،
 * ومعالجة الدفع عبر المستودع (مزود-محايد).
 */
import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/core/logging/logger';
import type { PaymentsRepository } from '@/data/repositories/payments.repository';
import type { ID } from '@/core/types/domain';
import { computeTender, quickCashAmounts, type TenderResult } from '@/domain/payments';
import type { PaymentMethod, Payment } from '@/domain/payments/types';
import { ordersRepository, customersRepository } from '@/shared/container';
import type { SaleOrder } from '@/domain/sales/types';
import { asId } from '@/core/types/domain';

// حالة الشاشة.
export type PaymentStatus =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'ready'; order: SaleOrder }
  | { kind: 'processing' }
  | { kind: 'done'; payment: Payment; order: SaleOrder }
  | { kind: 'error'; messageKey: string };

// ما يعرضه الخطاف.
export interface PaymentViewModel {
  status: PaymentStatus;
  method: PaymentMethod;
  tenderText: string;
  tender: TenderResult | null;
  quickAmounts: number[];
  setMethod: (m: PaymentMethod) => void;
  setTenderText: (v: string) => void;
  setQuickTender: (amount: number) => void;
  pay: () => Promise<void>;
  retry: () => Promise<void>;
}

export function usePayment(orderId: ID | null, repository: PaymentsRepository): PaymentViewModel {
  const [status, setStatus] = useState<PaymentStatus>({ kind: 'loading' });
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tenderText, setTenderText] = useState('');

  // تحميل الطلب.
  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!orderId) {
      setStatus({ kind: 'notfound' });
      return;
    }
    const found = await ordersRepository.getOrder(orderId);
    if (!found) {
      setStatus({ kind: 'notfound' });
      return;
    }
    setOrder(found);
    // مدفوع مسبقًا → نعرض النجاح مباشرة.
    if (found.paymentStatus === 'paid') {
      setStatus({ kind: 'done', payment: {} as Payment, order: found });
    } else {
      setStatus({ kind: 'ready', order: found });
    }
  }, [orderId]);

  useEffect(() => {
    Promise.resolve().then(() => load()).catch((e: unknown) => {
      logger.error('Payment order load failed', { error: String(e) });
      setStatus({ kind: 'error', messageKey: 'pay.loadFailed' });
    });
  }, [load]);

  // حساب القبض/الباقي للنقدي.
  const tender: TenderResult | null = (() => {
    if (method !== 'cash' || !order) return null;
    const value = Number(tenderText.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(value) || tenderText.trim() === '') return null;
    return computeTender(order.total, value);
  })();

  // الفئات السريعة.
  const quickAmounts = order ? quickCashAmounts(order.total) : [];

  const setQuickTender = useCallback((amount: number) => setTenderText(String(amount)), []);

  // تنفيذ الدفع.
  const pay = useCallback(async () => {
    if (!order) return;
    setStatus({ kind: 'processing' });
    try {
      // النقدي يتطلب قبضًا كافيًا.
      if (method === 'cash' && (!tender || !tender.isSufficient)) {
        setStatus({ kind: 'ready', order });
        return;
      }
      const result = await repository.payOrder({ order, method, tender: tender ?? undefined });
      if (!result.ok || !result.payment || !result.updatedOrder) {
        setStatus({ kind: 'error', messageKey: result.errorKey ?? 'pay.failed' });
        return;
      }
      setStatus({ kind: 'done', payment: result.payment, order: result.updatedOrder });
      // تحديث ولاء العميل المسجّل (إن وُجد) بعد الدفع الناجح — PHASE 19.
      const registeredCustomerId = result.updatedOrder.customer.customerId;
      if (registeredCustomerId) {
        try {
          await customersRepository.recordPurchaseFor(asId(String(registeredCustomerId)), {
            orderId: result.updatedOrder.id,
            orderNumber: result.updatedOrder.orderNumber,
            totalAmount: result.updatedOrder.total.amount,
            currency: result.updatedOrder.total.currency,
            at: new Date().toISOString(),
          });
        } catch (loyaltyError) {
          // فشل الولاء لا يُبطل الدفع؛ نسجّل فقط.
          logger.warn('Loyalty accrual failed', { error: String(loyaltyError) });
        }
      }
    } catch (error) {
      logger.error('Payment failed', { error: String(error) });
      setStatus({ kind: 'error', messageKey: 'pay.failed' });
    }
  }, [order, method, tender, repository]);

  return {
    status,
    method,
    tenderText,
    tender,
    quickAmounts,
    setMethod,
    setTenderText,
    setQuickTender,
    pay,
    retry: load,
  };
}
