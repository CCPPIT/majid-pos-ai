/**
 * نقطة تصدير مجال العملاء وCRM والولاء (PHASE 19).
 */
export * from './types'; // أنواع العميل والولاء.
export {
  DEFAULT_LOYALTY,
  TIER_THRESHOLDS,
  TIER_ORDER,
  pointsForAmount,
  tierForSpent,
  isTierUpgrade,
  recordPurchase,
  loyaltySummary,
  newNoteId,
  type RecordPurchaseArgs,
} from './loyalty'; // منطق الولاء.
export {
  NAME_MAX,
  normalizePhone,
  validateCustomerDraft,
  parseTags,
  createCustomerFromDraft,
  applyDraftToCustomer,
  customerToDraft,
} from './factory'; // المُصنِّع والتحقق.
