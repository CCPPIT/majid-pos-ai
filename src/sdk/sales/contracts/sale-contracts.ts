/**
 * عقود مجال المبيعات — PHASE 31 · قسم 18.
 * الفاتورة (Sale) لقطة ثابتة لا تتغيّر بعد إنشائها: بنودها وأسعارها
 * وإجمالياتها محفوظة كما كانت لحظة البيع، فلا يغيّرها تعديل لاحق في الكتالوج.
 */
import type {
  AuditableFields,
  CurrencyCode,
  CustomerId,
  ISODateTime,
  Money,
  PaymentId,
  ProductId,
  SaleId,
  SaleLineId,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';
import type { Discount } from '@/sdk/cart';

// حالة الفاتورة عبر دورة حياتها.
export type SaleStatus =
  | 'draft' // مسودّة (سلة تحوّلت ولم تُثبَّت).
  | 'pending_payment' // مُنشأة بانتظار الدفع.
  | 'paid' // مدفوعة بالكامل.
  | 'partially_paid' // مدفوعة جزئيًا.
  | 'cancelled' // ملغاة قبل الدفع.
  | 'refunded' // مسترجعة كليًا.
  | 'partially_refunded'; // مسترجعة جزئيًا.

// حالة الدفع المختصرة.
export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

// مرجع العميل على الفاتورة.
export interface SaleCustomerRef {
  readonly kind: 'walk_in' | 'named' | 'registered'; // زائر · باسم · مسجّل.
  readonly name: string; // الاسم المعروض.
  readonly customerId?: CustomerId; // معرّف العميل المسجّل.
  readonly phone?: string; // هاتفه.
}

// بند الفاتورة (لقطة ثابتة من بند السلة).
export interface SaleLine {
  readonly id: SaleLineId; // معرّف البند.
  readonly productId: ProductId; // المنتج.
  readonly sku: string; // رمز الصنف.
  readonly nameAr: string; // الاسم العربي وقت البيع.
  readonly nameEn: string; // الاسم الإنجليزي وقت البيع.
  readonly quantity: number; // الكمية المباعة.
  readonly unitPrice: Money; // سعر الوحدة وقت البيع.
  readonly lineTotal: Money; // إجمالي البند بعد خصمه.
  readonly discount?: Discount; // خصم البند إن وُجد.
  readonly taxIncluded: boolean; // هل السعر شامل الضريبة؟
}

// الفاتورة الكاملة.
export interface Sale extends TenantScopedFields, AuditableFields {
  readonly id: SaleId; // المعرّف.
  readonly saleNumber: string; // الرقم البشري (ORD-0001).
  readonly transactionId: string; // معرّف المعاملة (للمطابقة مع البوابة).
  readonly cashierId?: UserId; // الكاشير المنفّذ.
  readonly cashierName: string; // اسمه (لقطة).
  readonly customer: SaleCustomerRef; // العميل.
  readonly lines: readonly SaleLine[]; // البنود.
  readonly currency: CurrencyCode; // العملة.
  readonly subtotal: Money; // المجموع قبل الخصم.
  readonly discount: Money; // إجمالي الخصم.
  readonly taxAmount: Money; // الضريبة.
  readonly total: Money; // الإجمالي المستحق.
  readonly paidAmount: Money; // المُحصَّل فعلًا.
  readonly refundedAmount: Money; // المُسترجَع.
  readonly taxRatePercent: number; // نسبة الضريبة المطبَّقة.
  readonly status: SaleStatus; // حالة الفاتورة.
  readonly paymentStatus: SalePaymentStatus; // حالة الدفع.
  readonly paymentIds: readonly PaymentId[]; // الدفعات المرتبطة.
  readonly soldAt: ISODateTime; // لحظة البيع.
  readonly cancelledAt?: ISODateTime; // لحظة الإلغاء.
  readonly refundedAt?: ISODateTime; // لحظة الاسترجاع.
}

// سطر في الإيصال (تمثيل عرض جاهز للطباعة/المشاركة).
export interface ReceiptLine {
  readonly labelAr: string; // الوصف بالعربية.
  readonly labelEn: string; // الوصف بالإنجليزية.
  readonly quantity: number; // الكمية.
  readonly amount: Money; // القيمة.
}

// الإيصال الكامل.
export interface Receipt {
  readonly saleId: SaleId; // الفاتورة.
  readonly saleNumber: string; // رقمها.
  readonly storeName: string; // اسم المتجر.
  readonly storeCode: string; // كوده.
  readonly cashierName: string; // الكاشير.
  readonly customerName: string; // العميل.
  readonly lines: readonly ReceiptLine[]; // البنود.
  readonly subtotal: Money; // المجموع.
  readonly discount: Money; // الخصم.
  readonly tax: Money; // الضريبة.
  readonly total: Money; // الإجمالي.
  readonly paidAmount: Money; // المدفوع.
  readonly changeDue: Money; // الباقي.
  readonly issuedAt: ISODateTime; // لحظة الإصدار.
}

// هل الفاتورة قابلة للإلغاء؟ (قاعدة عمل نقية).
export const canCancelSale = (sale: Sale): boolean =>
  // الإلغاء ممكن فقط قبل أي تحصيل.
  sale.status === 'pending_payment' || sale.status === 'draft';

// هل الفاتورة قابلة للاسترجاع؟
export const canRefundSale = (sale: Sale): boolean =>
  // الاسترجاع يتطلب تحصيلًا سابقًا ولم يُسترجع كامل المبلغ بعد.
  (sale.status === 'paid' || sale.status === 'partially_refunded')
  && sale.refundedAmount.amount < sale.paidAmount.amount;

// المبلغ المتبقي المستحق على الفاتورة.
export const outstandingAmount = (sale: Sale): number =>
  // الفرق بين الإجمالي والمُحصَّل (لا يقل عن صفر).
  Math.max(0, sale.total.amount - sale.paidAmount.amount);
