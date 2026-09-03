/**
 * أوامر واستعلامات المبيعات — PHASE 31 · أقسام 18 و33 و42.
 */
import { z } from 'zod';
import type {
  CustomerId,
  DateRange,
  ProductId,
  QueryOptions,
  SaleId,
} from '@/sdk/core';
import type { Discount } from '@/sdk/cart';
import type { SalePaymentStatus, SaleStatus } from './sale-contracts';

// بند مطلوب في أمر إنشاء فاتورة (حين تُبنى الفاتورة من مدخلات مباشرة).
export interface CreateSaleLineInput {
  readonly productId: ProductId; // المنتج.
  readonly quantity: number; // الكمية.
  readonly discount?: Discount; // خصم البند.
}

// أمر إنشاء فاتورة بيع.
export interface CreateSaleCommand {
  readonly customerId?: CustomerId; // العميل المسجّل (اختياري).
  readonly customerName?: string; // اسم العميل غير المسجّل.
  readonly items: readonly CreateSaleLineInput[]; // البنود.
  readonly discount?: Discount; // خصم على الفاتورة.
  readonly cashierName?: string; // اسم الكاشير (من الجلسة عادةً).
  readonly note?: string; // ملاحظة.
}

// أمر إلغاء فاتورة.
export interface CancelSaleCommand {
  readonly saleId: SaleId; // الفاتورة.
  readonly reasonKey: string; // سبب الإلغاء (إلزامي للتدقيق).
}

// أمر استرجاع (كلي أو جزئي).
export interface RefundSaleCommand {
  readonly saleId: SaleId; // الفاتورة.
  readonly amount?: number; // المبلغ (غيابه = استرجاع كامل).
  readonly reasonKey: string; // سبب الاسترجاع (إلزامي).
}

// استعلام سرد الفواتير.
export interface SaleListQuery extends QueryOptions {
  readonly status?: SaleStatus; // تضييق بالحالة.
  readonly paymentStatus?: SalePaymentStatus; // تضييق بحالة الدفع.
  readonly customerId?: CustomerId; // فواتير عميل محدد.
  readonly dateRange?: DateRange; // نطاق زمني.
}

// مخطط بند الإنشاء.
const saleLineSchema = z.object({
  productId: z.string().trim().min(1, 'sdk.validation.required'), // المنتج.
  quantity: z
    .number()
    .int('sdk.validation.integer')
    .positive('sdk.validation.quantityPositive')
    .max(999, 'sdk.validation.quantityTooLarge'), // الكمية.
  discount: z
    .object({
      type: z.enum(['percentage', 'fixed']), // نوع الخصم.
      value: z.number().nonnegative('sdk.validation.negativeAmount'), // قيمته.
      reasonKey: z.string().optional(), // سببه.
    })
    .optional(),
});

// مخطط أمر إنشاء فاتورة.
export const createSaleSchema = z.object({
  customerId: z.string().trim().optional(), // العميل.
  customerName: z.string().trim().max(120).optional(), // اسم العميل.
  // فاتورة بلا بنود مرفوضة صراحةً.
  items: z.array(saleLineSchema).min(1, 'sdk.validation.saleEmpty').max(200, 'sdk.validation.tooManyItems'),
  discount: saleLineSchema.shape.discount, // خصم الفاتورة.
  cashierName: z.string().trim().max(120).optional(), // الكاشير.
  note: z.string().trim().max(500).optional(), // ملاحظة.
});

// مخطط أمر الإلغاء.
export const cancelSaleSchema = z.object({
  saleId: z.string().trim().min(1, 'sdk.validation.required'), // الفاتورة.
  reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired'), // السبب.
});

// مخطط أمر الاسترجاع.
export const refundSaleSchema = z.object({
  saleId: z.string().trim().min(1, 'sdk.validation.required'), // الفاتورة.
  amount: z.number().positive('sdk.validation.amountPositive').optional(), // المبلغ.
  reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired'), // السبب.
});
