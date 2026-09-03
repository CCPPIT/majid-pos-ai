/**
 * نقطة تصدير مجال سجل التدقيق (PHASE 27).
 */
export * from './types'; // أنواع المدخلات/الفلترة/الملخص.
export {
  entryFromDomainEvent,
  makeSecurityEntry,
  filterEntries,
  summarizeAudit,
  DEVICE_ACTOR,
} from './logic'; // المنطق النقي للتحويل/الفلترة/التلخيص.
export type { AuditActor } from './logic';
