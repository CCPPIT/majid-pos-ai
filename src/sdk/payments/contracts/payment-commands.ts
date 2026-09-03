/**
 * أوامر المدفوعات ومخططاتها — PHASE 31 · أقسام 19 و42.
 */
import { z } from 'zod';
import type { PaymentId, QueryOptions, SaleId } from '@/sdk/core';
import type { PaymentMethod, PaymentStatus } from './payment-contracts';

// أمر معالجة دفعة.
export interface ProcessPaymentCommand {
  readonly saleId: SaleId; // الفاتورة.
  readonly method: PaymentMethod; // طريقة الدفع.
  readonly amount: number; // المبلغ المستحق.
  readonly tendered?: number; // المُسلَّم (نقدًا).
  readonly splits?: readonly { method: PaymentMethod; amount: number; reference?: string }[]; // أجزاء الدفع المقسّم.
  readonly reference?: string; // مرجع خارجي.
}

// أمر استرجاع دفعة.
export interface RefundPaymentCommand {
  readonly paymentId: PaymentId; // الدفعة.
  readonly amount?: number; // المبلغ (غيابه = استرجاع كامل).
  readonly reasonKey: string; // السبب (إلزامي).
}

// استعلام سرد الدفعات.
export interface PaymentListQuery extends QueryOptions {
  readonly saleId?: SaleId; // دفعات فاتورة محددة.
  readonly method?: PaymentMethod; // تضييق بالطريقة.
  readonly status?: PaymentStatus; // تضييق بالحالة.
}

// فهرس طرق الدفع المسموحة في المخططات.
const methodEnum = z.enum(['cash', 'card', 'wallet', 'transfer', 'credit', 'split']);

// مخطط أمر المعالجة.
export const processPaymentSchema = z
  .object({
    saleId: z.string().trim().min(1, 'sdk.validation.required'), // الفاتورة.
    method: methodEnum, // الطريقة.
    // المبلغ يجب أن يكون موجبًا وضمن حد أعلى معقول.
    amount: z
      .number()
      .positive('sdk.validation.amountPositive')
      .max(1_000_000_000, 'sdk.validation.amountTooLarge'),
    // المُسلَّم لا يكون سالبًا.
    tendered: z.number().nonnegative('sdk.validation.negativeAmount').optional(),
    // أجزاء الدفع المقسّم.
    splits: z
      .array(
        z.object({
          method: methodEnum, // طريقة الجزء.
          amount: z.number().positive('sdk.validation.amountPositive'), // مبلغه.
          reference: z.string().trim().max(120).optional(), // مرجعه.
        }),
      )
      .min(2, 'sdk.validation.splitMinParts') // الدفع المقسّم جزءان على الأقل.
      .max(5, 'sdk.validation.splitMaxParts') // وحد أقصى خمسة.
      .optional(),
    reference: z.string().trim().max(120).optional(), // مرجع خارجي.
  })
  // قاعدة عبر-حقلية: الدفع النقدي يتطلب مبلغًا مُسلَّمًا كافيًا.
  .refine((value) => value.method !== 'cash' || value.tendered !== undefined, {
    message: 'sdk.validation.tenderedRequired',
    path: ['tendered'],
  })
  // قاعدة عبر-حقلية: الدفع المقسّم يتطلب قائمة أجزاء.
  .refine((value) => value.method !== 'split' || (value.splits?.length ?? 0) >= 2, {
    message: 'sdk.validation.splitsRequired',
    path: ['splits'],
  });

// مخطط أمر الاسترجاع.
export const refundPaymentSchema = z.object({
  paymentId: z.string().trim().min(1, 'sdk.validation.required'), // الدفعة.
  amount: z.number().positive('sdk.validation.amountPositive').optional(), // المبلغ.
  reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired'), // السبب.
});
