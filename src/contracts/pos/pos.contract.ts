/**
 * عقد نقطة البيع (POS) — PHASE 32 · قسم 31.
 * عملية إتمام البيع تنسّق السلة والفاتورة والدفع والمخزون.
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const POS_CONTRACT_NAME = contractName('pos', 'Checkout');
// النسخة الحالية.
export const POS_CONTRACT_VERSION = domainContractVersion('pos');

// مخطط أمر إتمام البيع (Checkout).
export const checkoutCommandSchema = z.object({
  cartId: z.string().min(1), // السلة.
  paymentMethod: z.string().min(1), // طريقة الدفع.
  tenderedAmount: z.number().finite().nonnegative().optional(), // المبلغ المسلّم (نقدي).
  commandVersion: z.literal(POS_CONTRACT_VERSION), // نسخة الأمر.
});

// نوع أمر الإتمام.
export type CheckoutCommand = z.infer<typeof checkoutCommandSchema>;
