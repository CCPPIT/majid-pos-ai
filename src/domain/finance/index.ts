/**
 * نقطة تصدير مجال المالية (PHASE 20).
 */
export * from './types'; // أنواع القيود والمصاريف والملخص.
export {
  entriesFromOrders,
  entriesFromPurchaseOrders,
  entriesFromExpenses,
  withinRange,
  filterEntries,
  rangeForPeriod,
  summarize,
  groupByAccount,
  validateExpenseDraft,
  createExpense,
} from './logic'; // المنطق النقي.
