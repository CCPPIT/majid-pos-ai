/**
 * عقود مجال المدفوعات — PHASE 31 · أقسام 19 و45.
 * الـSDK لا يعرف أي بوابة دفع بعينها: يتعامل مع مزوّد مجرّد فقط،
 * فيمكن إضافة بوابة جديدة دون تعديل سطر واحد في المجال.
 */
import type {
  AuditableFields,
  CurrencyCode,
  ISODateTime,
  Money,
  PaymentId,
  SaleId,
  PaymentMethodKind,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';

// نعيد تصدير عقد المزوّد من النواة ليستورده المستهلك من مجال المدفوعات.
export type { PaymentProvider, PaymentProviderResult, PaymentAuthorizationRequest } from '@/sdk/core';

// طرق الدفع المدعومة (مجرّدة لا مرتبطة ببوابة).
export type PaymentMethod =
  | 'cash' // نقدًا.
  | 'card' // بطاقة.
  | 'wallet' // محفظة إلكترونية.
  | 'transfer' // تحويل بنكي.
  | 'credit' // آجل على حساب العميل.
  | 'split'; // مقسّم بين طرق متعددة.

// حالة الدفعة.
export type PaymentStatus =
  | 'pending' // بانتظار المعالجة.
  | 'processing' // قيد المعالجة لدى المزوّد.
  | 'succeeded' // نجحت.
  | 'failed' // فشلت.
  | 'cancelled' // أُلغيت قبل الإتمام.
  | 'refunded' // مُسترجعة كليًا.
  | 'partially_refunded'; // مُسترجعة جزئيًا.

// جزء من دفعة مقسّمة (طريقة + مبلغ).
export interface PaymentSplit {
  readonly method: PaymentMethod; // الطريقة.
  readonly amount: Money; // المبلغ بهذه الطريقة.
  readonly reference?: string; // مرجع خارجي (رقم عملية البطاقة مثلًا).
}

// الدفعة الكاملة.
export interface Payment extends TenantScopedFields, AuditableFields {
  readonly id: PaymentId; // المعرّف.
  readonly saleId: SaleId; // الفاتورة المرتبطة.
  readonly method: PaymentMethod; // الطريقة الأساسية.
  readonly status: PaymentStatus; // الحالة.
  readonly currency: CurrencyCode; // العملة.
  readonly amount: Money; // المبلغ المستحق.
  readonly tendered: Money; // المبلغ المُسلَّم (نقدًا).
  readonly change: Money; // الباقي للعميل.
  readonly refundedAmount: Money; // المُسترجَع من هذه الدفعة.
  readonly splits: readonly PaymentSplit[]; // أجزاء الدفع المقسّم.
  readonly providerId?: string; // معرّف المزوّد المستخدم.
  readonly providerReference?: string; // مرجع المزوّد للعملية.
  readonly cashierId?: UserId; // منفّذ التحصيل.
  readonly failureReasonKey?: string; // سبب الفشل (مفتاح ترجمة).
  readonly processedAt?: ISODateTime; // لحظة الإتمام.
}

/**
 * ملاحظة معمارية مهمة (قسم 39):
 * عقد مزوّد الدفع مُعرَّف مرة واحدة في النواة (`PaymentProvider` في
 * `sdk/core/client/providers`) بنموذج authorize/capture الذي تتطلبه البوابات
 * الحقيقية. لا نُعرّف عقدًا منافسًا هنا — نعيد تصديره فقط ونضيف ما يخص المجال:
 * تحويل طريقة الدفع المجرّدة إلى الطريقة التي يفهمها المزوّد.
 */

// يحوّل طريقة الدفع في المجال إلى الطريقة المجرّدة لدى المزوّد.
export const toProviderMethod = (method: PaymentMethod): PaymentMethodKind => {
  // النقد والبطاقة والمحفظة لها مقابل مباشر.
  if (method === 'cash') return 'cash';
  if (method === 'card') return 'card';
  if (method === 'wallet') return 'wallet';
  // التحويل والآجل والمقسّم تُعامل كطرق أخرى لدى البوابة.
  return 'other';
};

// هل الدفعة قابلة للاسترجاع؟
export const canRefundPayment = (payment: Payment): boolean =>
  // فقط الدفعات الناجحة أو المسترجعة جزئيًا وبها رصيد متبقٍ.
  (payment.status === 'succeeded' || payment.status === 'partially_refunded')
  && payment.refundedAmount.amount < payment.amount.amount;

// المبلغ القابل للاسترجاع من دفعة.
export const refundableAmount = (payment: Payment): number =>
  // الفرق بين المحصَّل والمسترجَع (لا يقل عن صفر).
  Math.max(0, payment.amount.amount - payment.refundedAmount.amount);
