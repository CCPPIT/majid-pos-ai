/**
 * أوامر المخزون ومخططاتها — PHASE 31 · أقسام 20 و42.
 */
import { z } from 'zod';
import type { DateRange, ProductId, QueryOptions, StoreId } from '@/sdk/core';
import type { StockMovementType } from './inventory-contracts';

// أمر تسوية رصيد (جرد).
export interface AdjustStockCommand {
  readonly productId: ProductId; // المنتج.
  readonly newQuantity: number; // الرصيد الفعلي بعد الجرد.
  readonly reasonKey: string; // السبب (إلزامي للتدقيق).
  readonly reference?: string; // مرجع.
}

// أمر استلام بضاعة.
export interface ReceiveStockCommand {
  readonly productId: ProductId; // المنتج.
  readonly quantity: number; // الكمية المستلمة.
  readonly reasonKey: string; // السبب.
  readonly reference?: string; // رقم فاتورة الشراء.
}

// أمر تحويل بين متجرين.
export interface TransferStockCommand {
  readonly productId: ProductId; // المنتج.
  readonly quantity: number; // الكمية المحوّلة.
  readonly fromStoreId: StoreId; // المصدر.
  readonly toStoreId: StoreId; // الوجهة.
  readonly reasonKey: string; // السبب.
  readonly reference?: string; // مرجع.
}

// أمر خصم مخزون بيع (يُستدعى من تدفّق البيع).
export interface DeductStockCommand {
  readonly productId: ProductId; // المنتج.
  readonly quantity: number; // الكمية المباعة.
  readonly reference: string; // رقم الفاتورة.
}

// استعلام سجل الحركات.
export interface MovementListQuery extends QueryOptions {
  readonly productId?: ProductId; // حركات منتج محدد.
  readonly type?: StockMovementType; // تضييق بالنوع.
  readonly dateRange?: DateRange; // نطاق زمني.
}

// حدود الكميات المقبولة في الأوامر.
const quantitySchema = z
  .number()
  .int('sdk.validation.integer')
  .nonnegative('sdk.validation.negativeQuantity')
  .max(1_000_000, 'sdk.validation.quantityTooLarge');

// مخطط التسوية.
export const adjustStockSchema = z.object({
  productId: z.string().trim().min(1, 'sdk.validation.required'), // المنتج.
  newQuantity: quantitySchema, // الرصيد الجديد (صفر مسموح — نفاد).
  reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired').max(200), // السبب.
  reference: z.string().trim().max(120).optional(), // المرجع.
});

// مخطط الاستلام.
export const receiveStockSchema = z.object({
  productId: z.string().trim().min(1, 'sdk.validation.required'), // المنتج.
  // الاستلام يتطلب كمية موجبة (لا استلام صفر).
  quantity: quantitySchema.refine((value) => value > 0, 'sdk.validation.quantityPositive'),
  reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired').max(200), // السبب.
  reference: z.string().trim().max(120).optional(), // المرجع.
});

// مخطط التحويل.
export const transferStockSchema = z
  .object({
    productId: z.string().trim().min(1, 'sdk.validation.required'), // المنتج.
    quantity: quantitySchema.refine((value) => value > 0, 'sdk.validation.quantityPositive'), // الكمية.
    fromStoreId: z.string().trim().min(1, 'sdk.validation.required'), // المصدر.
    toStoreId: z.string().trim().min(1, 'sdk.validation.required'), // الوجهة.
    reasonKey: z.string().trim().min(1, 'sdk.validation.reasonRequired').max(200), // السبب.
    reference: z.string().trim().max(120).optional(), // المرجع.
  })
  // قاعدة عبر-حقلية: لا تحويل من متجر إلى نفسه.
  .refine((value) => value.fromStoreId !== value.toStoreId, {
    message: 'sdk.validation.sameStoreTransfer',
    path: ['toStoreId'],
  });
