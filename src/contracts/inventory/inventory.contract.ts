/**
 * عقد المخزون — PHASE 32 · أقسام 06 · 29 · 35.
 *
 * يفصل كيان الصنف المخزني، أوامر التسوية، والخطأ المستقر
 * INVENTORY_INSUFFICIENT_STOCK الذي تتفرّع عليه الواجهة (قسم 30).
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const INVENTORY_CONTRACT_NAME = contractName('inventory', 'StockItem');
// النسخة الحالية.
export const INVENTORY_CONTRACT_VERSION = domainContractVersion('inventory');

// نوع حركة المخزون.
export const STOCK_MOVEMENT_TYPES = ['receive', 'sale', 'adjust', 'transfer', 'return'] as const;

// مخطط الصنف المخزني.
export const stockItemSchema = z.object({
  id: z.string().min(1), // معرّف الصنف.
  productId: z.string().min(1), // المنتج المرتبط.
  quantity: z.number().int().nonnegative(), // الرصيد الحالي.
  lowStockThreshold: z.number().int().nonnegative(), // حدّ التنبيه.
  warehouseId: z.string().optional(), // المستودع.
});

// نوع الصنف المخزني.
export type StockItem = z.infer<typeof stockItemSchema>;

// مخطط أمر تسوية رصيد (قسم 31).
export const adjustStockCommandSchema = z.object({
  productId: z.string().min(1), // المنتج.
  delta: z.number().int(), // التغيير (+ إضافة / − خصم).
  reason: z.enum(STOCK_MOVEMENT_TYPES), // سبب الحركة.
  note: z.string().trim().max(300).optional(), // ملاحظة.
  commandVersion: z.literal(INVENTORY_CONTRACT_VERSION), // نسخة الأمر.
});

// نوع أمر التسوية.
export type AdjustStockCommand = z.infer<typeof adjustStockCommandSchema>;

// مخطط استعلام الجرد (قسم 32).
export const getInventoryQuerySchema = z.object({
  lowStockOnly: z.boolean().optional(), // المنخفض فقط.
  warehouseId: z.string().optional(), // مستودع محدد.
});

// نوع استعلام الجرد.
export type GetInventoryQuery = z.infer<typeof getInventoryQuerySchema>;

// عقد مستودع المخزون المُنسَّخ (قسم 35).
export interface InventoryRepositoryContract {
  // يجلب رصيد منتج.
  getStock(productId: string): Promise<import('../core').ContractResult<StockItem>>;
  // يسوّي الرصيد بعد تحقّق الكفاية (يرجع خطأ الرصيد غير الكافي عند العجز).
  adjust(command: AdjustStockCommand): Promise<import('../core').ContractResult<StockItem>>;
}
