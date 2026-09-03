/**
 * بناء الإيصال (PHASE 15 — Receipts).
 * دالتان نقيتان:
 *  - buildReceipt: يجمع كيان Receipt من الطلب (+الدفعة) باستخدام منسّق مبالغ
 *    وتسميات مترجمة تُمرر من الواجهة (المجال مستقل عن i18n).
 *  - receiptToText: يحوّل الإيصال لنص أحادي البعد للمشاركة/الطباعة الحرارية.
 */
import type { Payment } from '@/domain/payments/types';
import type { SaleOrder } from '@/domain/sales/types';
import type { Receipt, ReceiptHeader, ReceiptTotalRow } from './types';

// منسّق مبلغ: قيمة رقمية → نص (يوفره i18n).
export type MoneyFormatter = (amount: number, currency: string) => string;

// التسميات المترجمة التي يحتاجها الإيصال (تُمرر من الواجهة).
export interface ReceiptLabels {
  subtotal: string; // الإجمالي قبل الضريبة.
  discount: string; // الخصم.
  tax: string; // الضريبة.
  total: string; // الإجمالي.
  customer: string; // العميل.
  cashier: string; // الكاشير.
  items: string; // عدد الأصناف.
  tendered: string; // المُسلَّم.
  change: string; // الباقي.
  reference: string; // رقم العملية.
  paymentMethod: string; // طريقة الدفع.
  paid: string; // مدفوع.
  unpaid: string; // بانتظار الدفع.
  thanks: string; // سطر الشكر.
}

// سياق بناء الإيصال.
export interface BuildReceiptContext {
  header: ReceiptHeader; // ترويسة المتجر.
  formatMoney: MoneyFormatter; // منسّق المبالغ.
  labels: ReceiptLabels; // التسميات المترجمة.
  locale: 'ar' | 'en'; // اللغة (لاختيار اسم الصنف).
  dateText: string; // التاريخ/الوقت منسّقًا.
  paymentMethodLabel?: string; // تسمية طريقة الدفع (إن دُفع).
}

// يبني كيان الإيصال من طلب ودفعة اختيارية.
export function buildReceipt(
  order: SaleOrder,
  payment: Payment | null,
  ctx: BuildReceiptContext,
): Receipt {
  const { formatMoney, labels, locale } = ctx;
  const ccy = order.currency;

  // سطور الأصناف (قيم نصية جاهزة).
  const lines = order.lines.map((line) => ({
    name: locale === 'ar' ? line.nameAr : line.nameEn,
    quantity: line.quantity,
    unitPriceText: formatMoney(line.unitPrice.amount, ccy),
    lineTotalText: formatMoney(line.lineTotal.amount, ccy),
  }));

  // صفوف الإجماليات.
  const totals: ReceiptTotalRow[] = [
    { label: labels.subtotal, value: formatMoney(order.subtotal.amount, ccy) },
  ];
  if (order.discount.amount > 0) {
    totals.push({ label: labels.discount, value: `- ${formatMoney(order.discount.amount, ccy)}` });
  }
  totals.push({ label: labels.tax, value: formatMoney(order.taxAmount.amount, ccy) });
  totals.push({ label: labels.total, value: formatMoney(order.total.amount, ccy), emphasis: true });

  // معلومات الدفع (إن وُجدت دفعة مكتملة).
  const receiptPayment = payment
    ? {
        methodLabel: ctx.paymentMethodLabel ?? labels.paymentMethod,
        totalText: formatMoney(order.total.amount, ccy),
        tenderedText: payment.tendered ? formatMoney(payment.tendered.amount, ccy) : undefined,
        changeText: payment.changeDue && payment.changeDue.amount > 0 ? formatMoney(payment.changeDue.amount, ccy) : undefined,
        reference: payment.reference,
      }
    : undefined;

  return {
    header: ctx.header,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    dateText: ctx.dateText,
    customerName: order.customer.name,
    cashierName: order.cashierName,
    lines,
    totals,
    payment: receiptPayment,
    footerText: labels.thanks,
    isPaid: order.paymentStatus === 'paid',
  };
}

// عرض ثابت للإيصال النصي (عدد أحرف تقريبي للطابعات الحرارية 32 عمودًا).
const LINE_WIDTH = 32;

// سطر فاصل من العارضات.
function divider(char: string = '-'): string {
  return char.repeat(LINE_WIDTH);
}

// يضبط نصًا على عرض السطر (يمين/يسار حسب اللغة) — تبسيط: نستخدم مسافات.
function padPair(left: string, right: string): string {
  const space = Math.max(1, LINE_WIDTH - left.length - right.length);
  return `${left}${' '.repeat(space)}${right}`;
}

// يحوّل الإيصال لنص قابل للمشاركة/الطباعة.
export function receiptToText(receipt: Receipt, labels: ReceiptLabels): string {
  const out: string[] = [];

  // ترويسة المركز.
  out.push(center(receipt.header.businessName));
  if (receipt.header.branchName) out.push(center(receipt.header.branchName));
  out.push(center(receipt.header.storeName));
  if (receipt.header.phoneLine) out.push(center(receipt.header.phoneLine));
  out.push(divider('='));

  // رقم الطلب والتاريخ والحالة.
  out.push(center(receipt.orderNumber));
  out.push(center(receipt.dateText));
  out.push(center(receipt.isPaid ? labels.paid : labels.unpaid));
  out.push(divider());

  // الأصناف.
  for (const line of receipt.lines) {
    out.push(line.name);
    out.push(padPair(`${line.quantity} × ${line.unitPriceText}`, line.lineTotalText));
  }
  out.push(divider());

  // الإجماليات.
  for (const row of receipt.totals) {
    out.push(padPair(row.label, row.value));
  }
  out.push(divider('='));

  // الدفع.
  if (receipt.payment) {
    out.push(padPair(labels.paymentMethod, receipt.payment.methodLabel));
    if (receipt.payment.tenderedText) out.push(padPair(labels.tendered, receipt.payment.tenderedText));
    if (receipt.payment.changeText) out.push(padPair(labels.change, receipt.payment.changeText));
    if (receipt.payment.reference) out.push(padPair(labels.reference, receipt.payment.reference));
    out.push(divider());
  }

  // العميل والكاشير وعدد الأصناف.
  out.push(padPair(labels.customer, receipt.customerName));
  out.push(padPair(labels.cashier, receipt.cashierName));
  out.push(divider());
  out.push(center(receipt.footerText));

  return out.join('\n');
}

// يوسّط نصًا ضمن عرض السطر.
function center(text: string): string {
  const padding = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
  return `${' '.repeat(padding)}${text}`;
}

// إجمالي عدد وحدات الأصناف في الإيصال (للعرض).
export function receiptItemCount(receipt: Receipt): number {
  return receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
}
