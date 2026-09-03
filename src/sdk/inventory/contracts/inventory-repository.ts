/**
 * عقد مستودع المخزون — PHASE 31 · قسم 30.
 */
import type { AsyncResult, PaginatedResult, ProductId, StockMovementId } from '@/sdk/core';
import type { InventorySummary, LowStockAlert, StockLevel, StockMovement } from './inventory-contracts';
import type { MovementListQuery } from './inventory-commands';

// مستودع المخزون (حركات + مستويات).
export interface InventoryRepository {
  // يسرد مستويات المخزون مُرقَّمة.
  listLevels(query?: MovementListQuery): AsyncResult<PaginatedResult<StockLevel>>;
  // يقرأ مستوى مخزون منتج واحد.
  getLevel(productId: ProductId): AsyncResult<StockLevel>;
  // يسجّل حركة جديدة في السجل (لا تُعدَّل بعدها).
  recordMovement(movement: StockMovement): AsyncResult<StockMovement>;
  // يقرأ حركة واحدة.
  getMovement(id: StockMovementId): AsyncResult<StockMovement>;
  // يسرد الحركات مُرقَّمة.
  listMovements(query?: MovementListQuery): AsyncResult<PaginatedResult<StockMovement>>;
  // يضبط رصيد منتج (يُستدعى بعد تسجيل الحركة).
  setQuantity(productId: ProductId, quantity: number): AsyncResult<StockLevel>;
  // ملخص المخزون للوحة المؤشرات.
  getSummary(): AsyncResult<InventorySummary>;
  // تنبيهات نقص المخزون.
  getLowStockAlerts(): AsyncResult<readonly LowStockAlert[]>;
}
