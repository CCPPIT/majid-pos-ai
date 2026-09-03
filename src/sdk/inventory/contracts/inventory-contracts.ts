/**
 * عقود مجال المخزون — PHASE 31 · قسم 20.
 * سجل الحركات (Ledger) هو مصدر الحقيقة: كل تغيّر رصيد يُسجَّل كحركة
 * لا تُحذف ولا تُعدَّل، والرصيد الحالي أثرٌ لها. هذا يجعل الجرد قابلًا
 * للمراجعة ويمنع التلاعب الصامت بالكميات.
 */
import type {
  AuditableFields,
  CurrencyCode,
  ISODateTime,
  Money,
  ProductId,
  StockMovementId,
  StoreId,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';

// نوع حركة المخزون (يحدد اتجاه الأثر على الرصيد).
export type StockMovementType =
  | 'receive' // استلام — يزيد.
  | 'adjust' // تسوية جرد — يضبط على قيمة.
  | 'transfer_out' // تحويل صادر — ينقص.
  | 'transfer_in' // تحويل وارد — يزيد.
  | 'sale' // بيع — ينقص.
  | 'return'; // مرتجع — يزيد.

// حالة الحركة (التحويل قد يكون قيد الطريق).
export type StockMovementStatus = 'completed' | 'in_transit' | 'cancelled';

// حالة مستوى المخزون المشتقة.
export type StockLevelStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// حركة مخزون واحدة (سطر ثابت في السجل).
export interface StockMovement extends TenantScopedFields, AuditableFields {
  readonly id: StockMovementId; // معرّف الحركة.
  readonly productId: ProductId; // المنتج المتأثر.
  readonly type: StockMovementType; // نوعها.
  readonly quantity: number; // كميتها (موجبة دائمًا؛ الاتجاه من النوع).
  readonly previousQuantity: number; // الرصيد قبلها.
  readonly resultingQuantity: number; // الرصيد بعدها.
  readonly reasonKey: string; // سببها (مفتاح ترجمة أو نص قصير).
  readonly reference?: string; // مرجع خارجي (فاتورة/تحويل).
  readonly fromStoreId?: StoreId; // متجر المصدر (للتحويل).
  readonly toStoreId?: StoreId; // متجر الوجهة (للتحويل).
  readonly status: StockMovementStatus; // حالتها.
  readonly performedBy?: UserId; // منفّذها.
  readonly occurredAt: ISODateTime; // لحظة حدوثها.
}

// مستوى مخزون منتج (لقطة محسوبة).
export interface StockLevel {
  readonly productId: ProductId; // المنتج.
  readonly nameAr: string; // اسمه بالعربية.
  readonly nameEn: string; // اسمه بالإنجليزية.
  readonly sku: string; // رمز الصنف.
  readonly quantity: number; // الرصيد الحالي.
  readonly reserved: number; // المحجوز (سلال مفتوحة/طلبات معلّقة).
  readonly available: number; // المتاح للبيع (الرصيد − المحجوز).
  readonly lowStockThreshold: number; // حدّ التنبيه.
  readonly status: StockLevelStatus; // الحالة المشتقة.
  readonly unitValue: Money; // قيمة الوحدة.
  readonly stockValue: Money; // قيمة الرصيد الإجمالية.
  readonly currency: CurrencyCode; // العملة.
  readonly lastMovementAt?: ISODateTime; // آخر حركة.
}

// ملخص المخزون (لوحة المؤشرات).
export interface InventorySummary {
  readonly totalProducts: number; // عدد الأصناف.
  readonly totalQuantity: number; // مجموع الكميات.
  readonly totalValue: Money; // قيمة المخزون.
  readonly lowStockCount: number; // أصناف تحت الحد.
  readonly outOfStockCount: number; // أصناف نافدة.
  readonly currency: CurrencyCode; // العملة.
}

// تنبيه نقص مخزون.
export interface LowStockAlert {
  readonly productId: ProductId; // المنتج.
  readonly nameAr: string; // اسمه.
  readonly quantity: number; // رصيده.
  readonly threshold: number; // حدّه.
  readonly severity: 'warning' | 'critical'; // شدّة التنبيه.
}

// يشتق حالة المستوى من الرصيد والحد.
export const deriveStockLevelStatus = (quantity: number, threshold: number): StockLevelStatus => {
  // رصيد صفر أو أقل = نافد.
  if (quantity <= 0) return 'out_of_stock';
  // رصيد عند الحد أو تحته = منخفض.
  if (quantity <= threshold) return 'low_stock';
  // غير ذلك متوفر.
  return 'in_stock';
};

// يحسب أثر نوع الحركة على الرصيد (+1 زيادة، −1 نقص، 0 ضبط مباشر).
export const movementDirection = (type: StockMovementType): 1 | -1 | 0 => {
  // الأنواع الزائدة للرصيد.
  if (type === 'receive' || type === 'transfer_in' || type === 'return') return 1;
  // الأنواع الناقصة.
  if (type === 'sale' || type === 'transfer_out') return -1;
  // التسوية تضبط الرصيد على قيمة مطلقة.
  return 0;
};

// يحسب الرصيد الناتج عن حركة (دالة نقية — أساس إعادة بناء السجل).
export const applyMovement = (currentQuantity: number, type: StockMovementType, quantity: number): number => {
  // اتجاه الأثر.
  const direction = movementDirection(type);
  // التسوية تضع القيمة مباشرة.
  if (direction === 0) return Math.max(0, quantity);
  // غير ذلك نضيف أو نطرح مع منع السالب.
  return Math.max(0, currentQuantity + direction * quantity);
};

// يعيد بناء الرصيد من سجل حركات كامل (تدقيق الجرد).
export const replayMovements = (movements: readonly StockMovement[]): number =>
  // نطبّق الحركات بالترتيب على رصيد ابتدائي صفري.
  movements
    .filter((movement) => movement.status === 'completed')
    .reduce((quantity, movement) => applyMovement(quantity, movement.type, movement.quantity), 0);

// شدّة تنبيه النقص (نافد = حرج).
export const alertSeverity = (quantity: number): LowStockAlert['severity'] =>
  quantity <= 0 ? 'critical' : 'warning';
