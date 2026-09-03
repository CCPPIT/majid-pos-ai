/**
 * أنواع طلبات البيع (PHASE 13 — Checkout).
 * طلب البيع (Sale Order) لقطة ثابتة تُولَّد من السلة لحظة الإتمام:
 * بنود بالأسعار والكميات، إجماليات مالية، عميل، وحالة دفع/طلب.
 * المدفوعات الفعلية تأتي في PHASE 14.
 */
import type { ID, ISODateString } from '@/core/types/domain';
import type { CurrencyCode, Money } from '@/core/money/money';

// حالة الطلب دورة حياته.
export type SaleOrderStatus =
  | 'pending_payment' // أُنشئ ولم يُدفع بعد (مخرجات PHASE 13).
  | 'paid' // مدفوع كاملًا (PHASE 14).
  | 'partially_paid' // مدفوع جزئيًا (PHASE 14).
  | 'cancelled' | 'refunded'; // ملغي/مسترجع (مراحل لاحقة).

// حالة الدفع المختصرة.
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

// بند طلب (لقطة من بند السلة).
export interface OrderLine {
  productId: ID; // معرف المنتج.
  sku: string; // رمز الصنف.
  nameAr: string; // اسم عربي.
  nameEn: string; // اسم إنجليزي.
  unitPrice: Money; // سعر الوحدة لحظة البيع.
  quantity: number; // الكمية المباعة.
  lineTotal: Money; // إجمالي البند (سعر × كمية).
  taxIncluded: boolean; // شمول الضريبة.
}

// مرجع العميل على الطلب (مبسّط حتى CRM في PHASE 19).
export interface OrderCustomer {
  type: 'walk_in' | 'named' | 'registered'; // زائر عابر، عميل باسم، أو عميل مسجّل (CRM).
  name: string; // الاسم (افتراضي "زبون" للعابر).
  customerId?: ID; // معرف العميل المسجّل (PHASE 19) — لربط الولاء.
  phone?: string; // هاتف العميل المسجّل (اختياري).
}

// كيان طلب البيع.
export interface SaleOrder extends AuditTimestamps {
  id: ID; // معرف الطلب.
  orderNumber: string; // رقم العرض/الطلب البشري (ORD-0001).
  tenantId?: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر (تضييق الطلبات).
  cashierId?: ID; // معرف الكاشير.
  cashierName: string; // اسم الكاشير (من الجلسة).
  customer: OrderCustomer; // العميل.
  lines: OrderLine[]; // البنود.
  currency: CurrencyCode; // العملة.
  subtotal: Money; // الإجمالي قبل الضريبة/الخصم.
  discount: Money; // الخصم.
  taxAmount: Money; // الضريبة.
  total: Money; // الإجمالي النهائي.
  taxRatePercent: number; // نسبة الضريبة المطبقة.
  discountPercent: number; // نسبة الخصم المطبقة.
  status: SaleOrderStatus; // حالة الطلب.
  paymentStatus: PaymentStatus; // حالة الدفع.
  createdAt: ISODateString; // لحظة الإنشاء.
  updatedAt: ISODateString; // آخر تحديث.
}

// طوابع زمنية (مطابقة Auditable دون فرض معرفات إضافية).
interface AuditTimestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// مدخلات إنشاء طلب من سلة.
export interface CreateOrderInput {
  storeId?: ID; // المتجر النشط.
  tenantId?: ID;
  organizationId?: ID;
  branchId?: ID;
  cashierId?: ID;
  cashierName: string; // اسم الكاشير.
  customer: OrderCustomer; // العميل.
  taxRatePercent: number; // نسبة الضريبة.
  sequence: number; // الرقم التسلسلي للطلب (لتوليد رقم الطلب).
}
