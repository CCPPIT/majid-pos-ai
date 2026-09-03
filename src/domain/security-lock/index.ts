/**
 * نقطة تصدير مجال أمان القفل التلقائي وسلامة الجهاز (PHASE 26).
 */
export * from './types'; // أنواع الإعدادات/القفل/الجهاز.
export {
  DEFAULT_SECURITY_SETTINGS,
  TIMEOUT_MINUTES,
  timeoutMs,
  shouldLockOnForeground,
  buildDeviceReport,
  normalizeSettings,
} from './policy'; // المنطق النقي للقفل والجهاز.
export type { LockDecisionInput, DeviceFacts } from './policy';
