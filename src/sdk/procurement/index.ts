/**
 * مجال المشتريات — PHASE 31 · قسم 23.
 * دورة الشراء: طلب → أمر شراء → استلام → أثر على المخزون.
 */
import type {
  AsyncResult,
  AuditableFields,
  ISODateTime,
  Money,
  PaginatedResult,
  ProductId,
  PurchaseOrderId,
  QueryOptions,
  SupplierId,
  TenantScopedFields,
} from '@/sdk/core';

// حالة أمر الشراء.
export type PurchaseOrderStatus =
  | 'draft' // مسودّة.
  | 'pending_approval' // بانتظار الاعتماد.
  | 'approved' // معتمد.
  | 'ordered' // مُرسَل للمورّد.
  | 'partially_received' // مستلم جزئيًا.
  | 'received' // مستلم بالكامل.
  | 'cancelled'; // ملغى.

// المورّد.
export interface Supplier extends TenantScopedFields, AuditableFields {
  readonly id: SupplierId; // المعرّف.
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly phone?: string; // الهاتف.
  readonly email?: string; // البريد.
  readonly active: boolean; // نشط؟
}

// بند أمر شراء.
export interface PurchaseOrderLine {
  readonly productId: ProductId; // المنتج.
  readonly quantity: number; // الكمية المطلوبة.
  readonly receivedQuantity: number; // المستلم منها.
  readonly unitCost: Money; // تكلفة الوحدة.
  readonly lineTotal: Money; // إجمالي البند.
}

// أمر الشراء.
export interface PurchaseOrder extends TenantScopedFields, AuditableFields {
  readonly id: PurchaseOrderId; // المعرّف.
  readonly orderNumber: string; // الرقم البشري.
  readonly supplierId: SupplierId; // المورّد.
  readonly status: PurchaseOrderStatus; // الحالة.
  readonly lines: readonly PurchaseOrderLine[]; // البنود.
  readonly total: Money; // الإجمالي.
  readonly expectedAt?: ISODateTime; // موعد التسليم المتوقّع.
  readonly receivedAt?: ISODateTime; // لحظة الاستلام.
}

// استعلام سرد أوامر الشراء.
export interface PurchaseOrderQuery extends QueryOptions {
  readonly status?: PurchaseOrderStatus; // تضييق بالحالة.
  readonly supplierId?: SupplierId; // تضييق بالمورّد.
}

// مستودع المشتريات.
export interface ProcurementRepository {
  // يسرد المورّدين.
  listSuppliers(query?: QueryOptions): AsyncResult<PaginatedResult<Supplier>>;
  // يسرد أوامر الشراء.
  listOrders(query?: PurchaseOrderQuery): AsyncResult<PaginatedResult<PurchaseOrder>>;
  // يجلب أمر شراء.
  getOrder(id: PurchaseOrderId): AsyncResult<PurchaseOrder>;
  // ينشئ أمر شراء.
  createOrder(order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): AsyncResult<PurchaseOrder>;
  // يعتمد أمر شراء (عملية تتطلب صلاحية اعتماد).
  approveOrder(id: PurchaseOrderId): AsyncResult<PurchaseOrder>;
  // يسجّل استلام كميات (يولّد حركات مخزون).
  receiveOrder(id: PurchaseOrderId, received: readonly { productId: ProductId; quantity: number }[]): AsyncResult<PurchaseOrder>;
}

// هل اكتمل استلام كل بنود الأمر؟ (دالة نقية).
export const isFullyReceived = (order: PurchaseOrder): boolean =>
  // كل بند استُلمت كميته كاملة.
  order.lines.every((line) => line.receivedQuantity >= line.quantity);

// هل يمكن اعتماد الأمر؟
export const canApprove = (order: PurchaseOrder): boolean =>
  // الاعتماد ممكن للمسودّة والمعلّقة فقط.
  order.status === 'draft' || order.status === 'pending_approval';
