/**
 * بناء طلب البيع من السلة (PHASE 13 — Checkout).
 * منطق نقي بلا آثار جانبية: يحوّل Cart + CartTotals إلى SaleOrder غير قابل
 * للتعديل، برقم طلب بشري، حالة (بانتظار الدفع)، ونسخ نقدية دقيقة.
 */
import { money } from '@/core/money/money';
import { asId, type ID } from '@/core/types/domain';
import type { Cart, CartTotals } from '@/domain/cart';
import type { CreateOrderInput, OrderLine, SaleOrder } from './types';

// يولّد رقم طلب بشري متسلسل: ORD-0001, ORD-0042…
export function formatOrderNumber(sequence: number): string {
  // على الأقل 4 أرقام مع أصفار بادئة.
  return `ORD-${String(Math.max(1, Math.floor(sequence))).padStart(4, '0')}`;
}

// العميل الافتراضي (زائر عابر).
export function walkInCustomer(): CreateOrderInput['customer'] {
  return { type: 'walk_in', name: 'زبون' };
}

// ينشئ طلب بيع من سلة وإجمالياتها ومدخلات السياق.
export function createSaleOrder(
  cart: Cart,
  totals: CartTotals,
  input: CreateOrderInput,
  now: string = new Date().toISOString(),
): SaleOrder {
  // بنود الطلب = لقطات من بنود السلة (مع إجمالي كل بند).
  const lines: OrderLine[] = cart.lines.map((line) => ({
    productId: line.productId,
    sku: line.sku,
    nameAr: line.nameAr,
    nameEn: line.nameEn,
    // نسخة نقدية بسعر الوحدة (نفس العملة).
    unitPrice: money(line.unitPrice.amount, line.unitPrice.currency),
    quantity: line.quantity,
    lineTotal: money(line.unitPrice.amount * line.quantity, cart.currency),
    taxIncluded: line.taxIncluded,
  }));

  // المعرف فريد محليًا (يُستبدل بخادم لاحقًا).
  const id: ID = asId(`order-${input.sequence}-${Date.now()}`);

  return {
    id,
    orderNumber: formatOrderNumber(input.sequence),
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    storeId: input.storeId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    customer: input.customer,
    lines,
    currency: cart.currency,
    // نسخ نقدية من الإجماليات (المحسوبة أصلًا في core/money).
    subtotal: money(totals.subtotal.amount, totals.subtotal.currency),
    discount: money(totals.discount.amount, totals.discount.currency),
    taxAmount: money(totals.taxAmount.amount, totals.taxAmount.currency),
    total: money(totals.total.amount, totals.total.currency),
    taxRatePercent: input.taxRatePercent,
    discountPercent: cart.discountPercent,
    // طلب جديد يُنشأ بانتظار الدفع (PHASE 14 تكمل الدفع).
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    createdAt: now,
    updatedAt: now,
  };
}

// عدد وحدات الصنف في الطلب (مجموع الكميات).
export function orderQuantity(order: SaleOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

// يحوّل طلبًا إلى حالة "مدفوع" بعد نجاح التحصيل (PHASE 14).
export function markOrderPaid(order: SaleOrder, now: string = new Date().toISOString()): SaleOrder {
  return {
    ...order,
    status: 'paid',
    paymentStatus: 'paid',
    updatedAt: now,
  };
}

// اسم البند حسب اللغة.
export function lineName(line: OrderLine, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? line.nameAr : line.nameEn;
}
