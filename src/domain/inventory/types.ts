/**
 * أنواع مجال المخزون (PHASE 17 — Inventory).
 * سجل حركات المخزون (Ledger) مصدر الحقيقة لكل تغيّر كمية:
 * استلام/تسوية/تحويل/بيع. الكمية في المنتج تُشتق وتُحدَّث من هذا السجل.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { ProductStockStatus } from '@/domain/products/types';

// نوع حركة المخزون.
export type InventoryMovementType =
  | 'receive' // استلام بضاعة (مشتريات/تزويد) — يزيد الرصيد.
  | 'adjust' // تسوية رصيد (فروقات جرد/تالف) — يضع الرصيد قيمة محددة.
  | 'transfer_out' // تحويل صادر من متجر — ينقص رصيد المصدر.
  | 'transfer_in' // تحويل وارد إلى متجر — يزيد رصيد الوجهة.
  | 'sale' // بيع (يُسجَّل آليًا من نقطة البيع لاحقًا).
  | 'return'; // مرتجع — يزيد الرصيد.

// حالات حركة التحويل بين المتاجر (حتى تتوفر المزامنة).
export type InventoryMovementStatus = 'completed' | 'in_transit' | 'cancelled';

// حركة مخزون واحدة (سطر في سجل الحركات).
export interface InventoryMovement extends Auditable {
  id: ID; // معرف الحركة.
  tenantId: ID; // المستأجر.
  productId: ID; // المنتج المتأثر.
  type: InventoryMovementType; // نوع الحركة.
  quantity: number; // كمية الحركة (موجبة دائمًا؛ الاتجاه من النوع).
  // رصيد المتجر بعد الحركة (لحظة تطبيقها) — يتيح مراجعة الأثر.
  resultingQuantity: number;
  reason: string; // سبب الحركة (مفتاح i18n أو نص قصير).
  reference?: string; // مرجع خارجي (رقم فاتورة شراء/تحويل).
  storeId?: ID; // المتجر المالك للرصيد.
  branchId?: ID; // الفرع.
  // وجهة/مصدر التحويل (للtransfer_out/transfer_in).
  toStoreId?: ID; // المتجر الوجهة.
  fromStoreId?: ID; // المتجر المصدر.
  status: InventoryMovementStatus; // حالة الحركة.
  // منفّذ الحركة createdBy موروث من Auditable (نوع ID).
  occurredAt: ISODateString; // لحظة حدوث الحركة.
}

// مستوى مخزون منتج واحد (يُبنى من الكتالوج + آخر حركة).
export interface InventoryLevel {
  productId: ID; // معرف المنتج.
  nameAr: string; // الاسم بالعربية.
  nameEn: string; // الاسم بالإنجليزية.
  barcode: string; // الباركود.
  sku: string; // رمز الصنف.
  quantity: number; // الكمية الحالية.
  status: ProductStockStatus; // حالة المخزون المشتقة.
  unitValue: number; // قيمة الوحدة (سعر البيع كأساس تقريبي).
  currency: string; // العملة.
  // قيمة المخزون التقديرية (كمية × قيمة الوحدة) — تقريبية للحسابات المالية لاحقًا.
  stockValue: number;
  lastMovementAt?: ISODateString; // لحظة آخر حركة.
  categoryId: string; // التصنيف.
}

// طلب تسوية رصيد (من الشاشة).
export interface AdjustStockInput {
  productId: ID; // المنتج.
  newQuantity: number; // الرصيد الفعلي بعد الجرد.
  reason: string; // سبب التسوية.
  storeId?: ID; // المتجر.
  branchId?: ID; // الفرع.
  reference?: string; // مرجع اختياري.
}

// طلب استلام بضاعة.
export interface ReceiveStockInput {
  productId: ID; // المنتج.
  quantity: number; // الكمية المستلمة (موجبة).
  reason: string; // سبب/ملاحظة.
  storeId?: ID; // المتجر.
  branchId?: ID; // الفرع.
  reference?: string; // رقم فاتورة الشراء.
}

// طلب تحويل بين متجرين.
export interface TransferStockInput {
  productId: ID; // المنتج.
  quantity: number; // الكمية المحوّلة.
  fromStoreId: ID; // المتجر المصدر.
  toStoreId: ID; // المتجر الوجهة.
  storeId?: ID; // متجر التنفيذ (المصدر عادة).
  branchId?: ID; // الفرع.
  reason: string; // سبب التحويل.
}

// معايير استعلام الحركات/المستويات.
export interface InventoryQuery {
  search?: string; // بحث بالاسم/الباركود.
  status?: ProductStockStatus; // فلترة بحالة المخزون.
  storeId?: ID; // تضييق المتجر.
  branchId?: ID; // تضييق الفرع.
  limit?: number; // حد عدد النتائج.
}
