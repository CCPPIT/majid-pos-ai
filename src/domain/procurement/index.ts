/**
 * نقطة تصدير مجال المشتريات (PHASE 18).
 */
export * from './types'; // أنواع المورّدين وأوامر الشراء.
export {
  formatPurchaseOrderNumber,
  validateSupplierDraft,
  createSupplierFromDraft,
  buildOrderLine,
  calculateTotals,
  createPurchaseOrder,
  canTransition,
  transitionPurchaseOrder,
  isReceivable,
  isFullyReceived,
  recordReceipt,
  totalOrderedQuantity,
  totalReceivedQuantity,
} from './logic'; // منطق المشتريات النقي.
