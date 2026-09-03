/**
 * أنواع المدفوعات (PHASE 14 — Payments).
 * تصميم مزود-محايد: طريقة الدفع (نقدي/بطاقة/QR/محفظة) تُعالَج عبر واجهة
 * PaymentProvider واحدة، فتُضاف بوابات حقيقية لاحقًا دون تغيير الشاشة.
 * كل المبالغ كائنات Money حقيقية.
 */
import type { ID, ISODateString } from '@/core/types/domain';
import type { Money } from '@/core/money/money';

// طرق الدفع المدعومة.
export type PaymentMethod =
  | 'cash' // نقدي (له قبض وباقي).
  | 'card' // بطاقة (مدين/ائتمان).
  | 'qr' // مسح QR (محفظة/تحويل).
  | 'wallet'; // محفظة رقمية داخل التطبيق.

// حالة معالجة الدفعة.
export type PaymentState =
  | 'pending' // أُنشئت ولم تُعالج.
  | 'processing' // قيد المعالجة (البوابة).
  | 'completed' // نجحت.
  | 'failed' | 'cancelled'; // فشلت/أُلغيت.

// سجل دفعة واحدة مقابل طلب.
export interface Payment {
  id: ID; // معرف الدفعة.
  orderId: ID; // الطلب المرتبط.
  orderNumber: string; // رقم الطلب (للعرض/الإيصال).
  method: PaymentMethod; // الطريقة.
  amount: Money; // المبلغ المدفوع (المحصّل).
  // للنقدي: المبلغ المُسلَّم والباقي المرتجع.
  tendered?: Money; // ما سلّمه الزبون.
  changeDue?: Money; // الباقي المُعاد.
  reference?: string; // مرجع البوابة (رقم عملية/إذن).
  state: PaymentState; // الحالة.
  createdAt: ISODateString; // لحظة الإنشاء.
  completedAt?: ISODateString; // لحظة النجاح.
}

// نتيجة حساب القبض/الباقي للنقدي.
export interface TenderResult {
  totalDue: Money; // المبلغ المطلوب.
  tendered: Money; // المُسلَّم.
  changeDue: Money; // الباقي (صفر إن كان القبض مطابقًا/أقل).
  isSufficient: boolean; // هل القبض يكفي المطلوب؟
}

// نتيجة معالجة الدفع من المزود.
export interface PaymentOutcome {
  ok: boolean; // نجح؟
  reference?: string; // مرجع العملية عند النجاح.
  reasonKey?: string; // مفتاح رسالة سبب الفشل.
}
