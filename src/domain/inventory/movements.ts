/**
 * منطق حركات المخزون النقي (PHASE 17).
 * دوال خالصة تُبنى وتتحقق من حركات المخزون وتحسب أثرها على الرصيد،
 * دون أي تخزين أو واجهة — قابلة للاختبار بالكامل.
 */
import { roundMoney } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId, type ID } from '@/core/types/domain';
import { stockStatusForQuantity } from '@/domain/products/factory';
import type { ProductStockStatus } from '@/domain/products/types';
import type {
  InventoryMovement,
  InventoryMovementType,
  InventoryMovementStatus,
  InventoryLevel,
} from './types';

// إشارة اتجاه الحركة على الرصيد (زيادة/نقص/تعيين).
export type QuantityEffect = 'increase' | 'decrease' | 'set';

// أثر كل نوع حركة على كمية المتجر.
export function effectOf(type: InventoryMovementType): QuantityEffect {
  switch (type) {
    case 'receive': // استلام يزيد.
    case 'transfer_in': // وارد يزيد.
    case 'return': // مرتجع يزيد.
      return 'increase';
    case 'transfer_out': // صادر ينقص.
    case 'sale': // بيع ينقص.
      return 'decrease';
    case 'adjust': // تسوية تعيّن قيمة.
      return 'set';
  }
}

// يحسب الرصيد الجديد بعد حركة واحدة.
export function applyMovement(currentQuantity: number, type: InventoryMovementType, movementQuantity: number): number {
  const effect = effectOf(type);
  if (effect === 'increase') return Math.max(0, currentQuantity + movementQuantity);
  if (effect === 'decrease') return Math.max(0, currentQuantity - movementQuantity);
  return Math.max(0, movementQuantity); // حالة التعيين (تسوية).
}

// هل يمكن تنفيذ عملية إنقاص (بيع/تحويل صادر) بهذه الكمية؟
export function canDeduct(currentQuantity: number, quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0 && currentQuantity >= quantity;
}

// وسائط بناء حركة خام (داخلية).
export interface BuildMovementArgs {
  tenantId: ID; // المستأجر.
  productId: ID; // المنتج.
  type: InventoryMovementType; // النوع.
  quantity: number; // الكمية (موجبة).
  currentQuantity: number; // رصيد المتجر قبل الحركة.
  reason: string; // السبب.
  reference?: string; // مرجع.
  storeId?: ID; // المتجر المالك للرصيد.
  branchId?: ID; // الفرع.
  fromStoreId?: ID; // مصدر التحويل.
  toStoreId?: ID; // وجهة التحويل.
  status?: InventoryMovementStatus; // الحالة (افتراضي مكتملة).
  createdBy?: ID; // المنفّذ.
  occurredAt?: string; // لحظة الحدوث.
  sequence?: number; // رقم تسلسلي للمعرف.
}

// يبني حركة مخزون موثّقة بعد التحقق من صحتها.
export function buildMovement(args: BuildMovementArgs): InventoryMovement {
  const quantity = Math.trunc(args.quantity);
  // الكمية يجب أن تكون موجبة.
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError('inventory.error.quantityInvalid');
  }
  // عمليات الإنقاص تتطلب رصيدًا كافيًا (بيع/تحويل صادر).
  if (effectOf(args.type) === 'decrease' && !canDeduct(args.currentQuantity, quantity)) {
    throw new ValidationError('inventory.error.insufficientStock');
  }
  if (!args.reason?.trim()) {
    throw new ValidationError('inventory.error.reasonRequired');
  }

  const resultingQuantity = applyMovement(args.currentQuantity, args.type, quantity);
  const now = args.occurredAt ?? new Date().toISOString();
  const seq = args.sequence ?? Date.now();

  return {
    id: asId(`inv-mov-${seq}`),
    tenantId: args.tenantId,
    productId: args.productId,
    type: args.type,
    quantity,
    resultingQuantity,
    reason: args.reason.trim(),
    reference: args.reference?.trim() || undefined,
    storeId: args.storeId,
    branchId: args.branchId,
    fromStoreId: args.fromStoreId,
    toStoreId: args.toStoreId,
    status: args.status ?? 'completed',
    createdBy: args.createdBy,
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

// يشتق حالة المخزون من الكمية (يعيد استخدام منطق المنتج الموحّد).
export function statusForQuantity(quantity: number): ProductStockStatus {
  return stockStatusForQuantity(quantity);
}

// القيمة الإجمالية التقديرية للمخزين (تقريب بنفس عملة المتجر).
export function totalStockValue(levels: Pick<InventoryLevel, 'stockValue'>[]): number {
  return roundMoney(levels.reduce((sum, level) => sum + level.stockValue, 0));
}

// عدّ المستويات حسب الحالة (للملخص أعلى الشاشة).
export function summarizeLevels(levels: InventoryLevel[]): {
  total: number; // عدد الأصناف.
  inStock: number; // المتوفر.
  lowStock: number; // المنخفض.
  outOfStock: number; // النافد.
} {
  return levels.reduce(
    (acc, level) => {
      acc.total += 1;
      if (level.status === 'in_stock') acc.inStock += 1;
      else if (level.status === 'low_stock') acc.lowStock += 1;
      else acc.outOfStock += 1;
      return acc;
    },
    { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
  );
}
