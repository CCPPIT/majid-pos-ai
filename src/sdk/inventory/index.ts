/**
 * الواجهة العلنية لمجال المخزون — PHASE 31 · قسم 51.
 */

// الكيانات والدوال النقية.
export {
  alertSeverity,
  applyMovement,
  deriveStockLevelStatus,
  movementDirection,
  replayMovements,
  type StockMovement,
  type StockMovementType,
  type StockMovementStatus,
  type StockLevel,
  type StockLevelStatus,
  type InventorySummary,
  type LowStockAlert,
} from './contracts/inventory-contracts';

// الأوامر ومخططاتها.
export {
  adjustStockSchema,
  receiveStockSchema,
  transferStockSchema,
  type AdjustStockCommand,
  type ReceiveStockCommand,
  type TransferStockCommand,
  type DeductStockCommand,
  type MovementListQuery,
} from './contracts/inventory-commands';

// عقد المستودع.
export type { InventoryRepository } from './contracts/inventory-repository';

// الخدمة.
export {
  createInventoryService,
  type InventoryService,
  type InventoryServiceDependencies,
} from './services/inventory-service';
