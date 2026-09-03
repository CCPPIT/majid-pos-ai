/**
 * مُصنِّع الفاتورة — PHASE 31 · قسم 18.
 * يحوّل سلة محسوبة إلى فاتورة ثابتة. دالة نقية تمامًا: نفس السلة ونفس
 * الرقم التسلسلي ونفس الساعة تُنتج نفس الفاتورة بايتًا ببايت.
 */
import {
  money,
  systemClock,
  zeroMoney,
  type Clock,
  type CustomerId,
  type SaleId,
  type SaleLineId,
  type TenantId,
  type UserId,
} from '@/sdk/core';
import { calculateTotals, lineTotalAfterDiscount, type Cart } from '@/sdk/cart';
import type { Sale, SaleCustomerRef, SaleLine } from '../contracts/sale-contracts';

// يولّد رقم فاتورة بشريًّا متسلسلًا (ORD-0001).
export const formatSaleNumber = (sequence: number): string =>
  // أربع خانات على الأقل مع أصفار بادئة.
  `ORD-${String(Math.max(1, Math.trunc(sequence))).padStart(4, '0')}`;

// العميل الافتراضي (زائر عابر) حين لا يُحدَّد عميل.
export const walkInCustomer = (name = 'زبون'): SaleCustomerRef => ({
  kind: 'walk_in',
  name,
});

// يبني مرجع عميل من المدخلات (مسجّل · باسم · عابر).
export const customerRef = (customerId?: CustomerId, name?: string, phone?: string): SaleCustomerRef => {
  // عميل مسجّل حين يوجد معرّف.
  if (customerId !== undefined) {
    return { kind: 'registered', name: name ?? 'عميل', customerId, phone };
  }
  // عميل باسم فقط حين يوجد اسم غير فارغ.
  if (name !== undefined && name.trim().length > 0) {
    return { kind: 'named', name: name.trim(), phone };
  }
  // وإلا زائر عابر.
  return walkInCustomer();
};

// مدخلات بناء الفاتورة.
export interface BuildSaleInput {
  readonly cart: Cart; // السلة المصدر.
  readonly tenantId: TenantId; // المستأجر المؤكّد (تتحقق منه الخدمة قبل البناء).
  readonly sequence: number; // الرقم التسلسلي للفاتورة.
  readonly customer: SaleCustomerRef; // العميل.
  readonly cashierId?: UserId; // الكاشير.
  readonly cashierName: string; // اسمه.
  readonly clock?: Clock; // الساعة (للاختبارات الحتمية).
}

/**
 * يبني فاتورة ثابتة من سلة محسوبة.
 * كل المبالغ منسوخة من إجماليات السلة المحسوبة بمحرّك واحد (لا إعادة حساب).
 */
export const buildSale = (input: BuildSaleInput): Sale => {
  // الساعة المستخدمة.
  const clock = input.clock ?? systemClock;
  // لحظة البيع.
  const now = clock.now();
  // إجماليات السلة (المصدر الوحيد للأرقام).
  const totals = calculateTotals(input.cart);
  // عملة الفاتورة.
  const currency = input.cart.currency;

  // بنود الفاتورة كلقطات ثابتة من بنود السلة.
  const lines: SaleLine[] = input.cart.items.map((item, index) => ({
    // معرّف بند مشتق من رقم الفاتورة وموضعه (حتمي لا عشوائي).
    id: `line-${input.sequence}-${index + 1}` as SaleLineId,
    productId: item.productId,
    sku: item.sku,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    quantity: item.quantity,
    // سعر الوحدة من لقطة التسعير (لا من الكتالوج الحالي).
    unitPrice: item.pricing.unitPrice,
    // إجمالي البند بعد خصمه الخاص.
    lineTotal: lineTotalAfterDiscount(item),
    discount: item.discount,
    taxIncluded: item.pricing.taxIncluded,
  }));

  // الفاتورة المكتملة (بانتظار الدفع).
  return {
    // معرّف حتمي مبني على التسلسل والطابع الزمني.
    id: `sale-${input.sequence}-${clock.timestamp().toString(36)}` as SaleId,
    saleNumber: formatSaleNumber(input.sequence),
    // معرّف المعاملة للمطابقة الخارجية.
    transactionId: `TXN-${input.sequence}-${clock.timestamp().toString(36).toUpperCase()}`,
    // حقول النطاق: المستأجر مؤكّد من الخدمة، والمتجر من السلة.
    tenantId: input.tenantId,
    storeId: input.cart.storeId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    customer: input.customer,
    lines,
    currency,
    // نسخ المبالغ من الإجماليات المحسوبة.
    subtotal: money(totals.subtotal.amount, currency),
    discount: money(totals.totalDiscount.amount, currency),
    taxAmount: money(totals.taxAmount.amount, currency),
    total: money(totals.total.amount, currency),
    // لم يُحصَّل شيء بعد.
    paidAmount: zeroMoney(currency),
    refundedAmount: zeroMoney(currency),
    taxRatePercent: input.cart.taxRatePercent,
    // فاتورة جديدة تنتظر الدفع.
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentIds: [],
    soldAt: now,
    createdAt: now,
    updatedAt: now,
  };
};

// يحوّل فاتورة إلى حالة "مدفوعة" بعد تحصيل كامل المبلغ.
export const markSalePaid = (
  sale: Sale,
  paidAmount: number,
  paymentId: Sale['paymentIds'][number],
  clock: Clock = systemClock,
): Sale => {
  // المبلغ المُحصَّل التراكمي.
  const totalPaid = sale.paidAmount.amount + paidAmount;
  // هل غطّى كامل الإجمالي؟ (مع تسامح لخانتين).
  const fullyPaid = totalPaid + 0.005 >= sale.total.amount;
  // فاتورة محدّثة.
  return {
    ...sale,
    paidAmount: money(totalPaid, sale.currency),
    // الحالة تتبع اكتمال التحصيل.
    status: fullyPaid ? 'paid' : 'partially_paid',
    paymentStatus: fullyPaid ? 'paid' : 'partial',
    // نضيف معرّف الدفعة لسجل الفاتورة.
    paymentIds: [...sale.paymentIds, paymentId],
    updatedAt: clock.now(),
  };
};

// يحوّل فاتورة إلى حالة "ملغاة".
export const markSaleCancelled = (sale: Sale, clock: Clock = systemClock): Sale => ({
  ...sale,
  status: 'cancelled',
  cancelledAt: clock.now(),
  updatedAt: clock.now(),
});

// يسجّل استرجاعًا (كليًا أو جزئيًا) على الفاتورة.
export const markSaleRefunded = (sale: Sale, refundAmount: number, clock: Clock = systemClock): Sale => {
  // إجمالي المسترجع التراكمي.
  const totalRefunded = sale.refundedAmount.amount + refundAmount;
  // هل استُرجع كامل المُحصَّل؟
  const fullyRefunded = totalRefunded + 0.005 >= sale.paidAmount.amount;
  // فاتورة محدّثة.
  return {
    ...sale,
    refundedAmount: money(totalRefunded, sale.currency),
    status: fullyRefunded ? 'refunded' : 'partially_refunded',
    paymentStatus: fullyRefunded ? 'refunded' : sale.paymentStatus,
    refundedAt: clock.now(),
    updatedAt: clock.now(),
  };
};
