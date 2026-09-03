/**
 * نقطة تصدير مجال المخزون (PHASE 17).
 */
export * from './types'; // أنواع الحركات والمستويات والطلبات.
export {
  effectOf,
  applyMovement,
  canDeduct,
  buildMovement,
  statusForQuantity,
  totalStockValue,
  summarizeLevels,
  type BuildMovementArgs,
  type QuantityEffect,
} from './movements'; // منطق الحركات النقي.
