/**
 * عقد الدفع — PHASE 32 · أقسام 25 · 29 · 36 · 37.
 *
 * يُصمَّم بحيث تُضاف طرق دفع مستقبلًا (wallet · bank_transfer · مزوّد
 * محلي/دولي) دون إعادة تصميم الدفع كله (قسم 37). إضافة قيمة تعداد
 * متوافقة، وحذفها كاسر (قسم 25) — ونتعامل مع القيم المجهولة بأمان.
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const PAYMENT_CONTRACT_NAME = contractName('payments', 'Payment');
// نسخة العقد الحالية.
export const PAYMENT_CONTRACT_VERSION = domainContractVersion('payments');

/**
 * طرق الدفع المعروفة (قسم 37 — قابلة للتوسّع).
 * إضافة قيمة هنا MINOR؛ إزالتها MAJOR (قسم 25).
 */
export const PAYMENT_METHODS = ['cash', 'card', 'qr'] as const;

// مخطط طريقة الدفع: يقبل القيم المعروفة، ويسجّل المجهولة في fallback.
export const paymentMethodSchema = z.union([
  z.enum(PAYMENT_METHODS), // القيم المعروفة.
  z.string(), // أي قيمة مستقبلية (مثل wallet) لا تكسر القرّاء القدامى (قسم 25).
]);

// نوع طريقة الدفع (القيم المعروفة + أي نص مستقبلي).
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// حالة الدفع.
export const PAYMENT_STATUSES = ['pending', 'authorized', 'completed', 'failed', 'declined', 'refunded'] as const;

// مخطط كيان الدفعة (قسم 22).
export const paymentSchema = z.object({
  id: z.string().min(1), // المعرّف.
  saleId: z.string().min(1), // الفاتورة المرتبطة.
  method: paymentMethodSchema, // الطريقة (قابلة للتوسّع).
  amount: z.number().finite().nonnegative(), // المبلغ.
  currency: z.string().trim().length(3), // العملة.
  status: z.enum(PAYMENT_STATUSES), // الحالة.
  providerRef: z.string().optional(), // مرجع البوابة الخارجية.
});

// نوع الدفعة المشتقّ.
export type Payment = z.infer<typeof paymentSchema>;

// مخطط أمر إنشاء دفعة (قسم 31 — مُنسَّخ).
export const createPaymentCommandSchema = z.object({
  saleId: z.string().min(1), // الفاتورة.
  method: paymentMethodSchema, // الطريقة.
  amount: z.number().finite().positive(), // المبلغ (موجب).
  currency: z.string().trim().length(3), // العملة.
  commandVersion: z.literal(PAYMENT_CONTRACT_VERSION), // نسخة الأمر (قسم 31).
});

// نوع أمر الدفع.
export type CreatePaymentCommand = z.infer<typeof createPaymentCommandSchema>;

/**
 * عقد مزوّد الدفع المُنسَّخ (قسم 36).
 * عند تغيّر كاسر يُنشأ PaymentProviderV2 مع محوّل، لا يُكسر V1.
 */
export interface PaymentProviderContractV1 {
  readonly providerVersion: '1.0.0'; // نسخة عقد المزوّد.
  readonly supportedMethods: readonly PaymentMethod[]; // الطرق المدعومة.
  // ينفّذ التفويض لدى البوابة ويعيد نتيجة موصّفة.
  authorize(
    command: CreatePaymentCommand,
  ): Promise<import('../core').ContractResult<{ providerRef: string; status: Payment['status'] }>>;
}

// حارس وقت التشغيل: هل طريقة الدفع من القيم المعروفة؟ (للتعامل مع المجهول).
export const isKnownPaymentMethod = (method: string): method is (typeof PAYMENT_METHODS)[number] =>
  (PAYMENT_METHODS as readonly string[]).includes(method);
