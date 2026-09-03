/**
 * منطق القبض/الباقي وإنشاء الدفعة (PHASE 14 — Payments).
 * دوال نقية بلا آثار جانبية — حسابات نقدية حقيقية عبر core/money.
 */
import { money, subtractMoney, type Money } from '@/core/money/money';
import { asId, type ID } from '@/core/types/domain';
import type { Payment, PaymentMethod, TenderResult } from './types';

// يحسب الباقي للدفع النقدي: المُسلَّم − المطلوب.
export function computeTender(totalDue: Money, tenderedAmount: number): TenderResult {
  const tendered = money(tenderedAmount, totalDue.currency);
  const difference = tendered.amount - totalDue.amount;
  // الباقي لا يقل عن صفر (القيمة الموجبة فقط).
  const changeDue = money(Math.max(0, subtractMoney(tendered, totalDue).amount), totalDue.currency);
  return {
    totalDue,
    tendered,
    changeDue,
    isSufficient: difference >= 0,
  };
}

// يقترح فئات نقدية سريعة للقبض (للأزرار السريعة).
export function quickCashAmounts(totalDue: Money): number[] {
  const due = Math.ceil(totalDue.amount);
  // فئات شائعة بالريال اليمني (ورقية).
  const denominations = [500, 1000, 2000, 5000, 10000, 20000, 50000];
  const quick: number[] = [due]; // المبلغ المضبوط أولًا.
  for (const denom of denominations) {
    // أول فئة أكبر من المطلوب (قبضة واحدة تكفي).
    if (denom >= due) {
      quick.push(denom);
      break;
    }
  }
  // نزيل التكرار ونرتب.
  return [...new Set(quick)].sort((a, b) => a - b);
}

// ينشئ سجل دفعة من بيانات القبض (قبل المعالجة بالمزود).
export function createPayment(
  orderId: ID,
  orderNumber: string,
  method: PaymentMethod,
  amount: Money,
  tendered?: Money,
  changeDue?: Money,
  now: string = new Date().toISOString(),
): Payment {
  return {
    id: asId(`pay-${orderNumber}-${Date.now()}`),
    orderId,
    orderNumber,
    method,
    amount,
    tendered,
    changeDue,
    state: 'pending',
    createdAt: now,
  };
}

// يحوّل الدفعة لحالة النجاح بمرجع البوابة.
export function completePayment(payment: Payment, reference: string, now: string = new Date().toISOString()): Payment {
  return {
    ...payment,
    state: 'completed',
    reference,
    completedAt: now,
  };
}

// يحوّل الدفعة لحالة الفشل.
export function failPayment(payment: Payment): Payment {
  return { ...payment, state: 'failed' };
}

// مفتاح ترجمة طريقة الدفع (للعرض).
export function methodLabelKey(method: PaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'pay.methodCash';
    case 'card':
      return 'pay.methodCard';
    case 'qr':
      return 'pay.methodQr';
    case 'wallet':
      return 'pay.methodWallet';
    default:
      return 'pay.methodCash';
  }
}
