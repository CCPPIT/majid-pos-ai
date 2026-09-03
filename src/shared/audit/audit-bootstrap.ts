/**
 * ربط سجل التدقيق بأحداث المجال (PHASE 27).
 * يشترك في أحداث الكتابة المهمة عبر ناقل المجال ويسجّلها كمدخلات تدقيق
 * append-only. المستودعات تبثّ أحداثًا ولا تعرف شيئًا عن التدقيق (فك الارتباط).
 * حدث التدقيق نفسه غير مشمول بالالتقاط لتفادي حلقة لانهائية.
 */
import { appEventBus, DOMAIN_EVENTS, type DomainEvent } from '@/core/events/EventBus';
import { entryFromDomainEvent, type AuditActor } from '@/domain/audit';
import { auditRepository } from '@/shared/container';
import { logger } from '@/core/logging/logger';

// الأحداث المُدقَّقة (الكتابة المهمة)؛ أحداث المزامنة/الاتصال/التدقيق ضجيج مستبعد.
const AUDITED_EVENTS = [
  DOMAIN_EVENTS.SALE_CREATED,
  DOMAIN_EVENTS.PAYMENT_COMPLETED,
  DOMAIN_EVENTS.PRODUCT_CREATED,
  DOMAIN_EVENTS.CUSTOMER_CREATED,
  DOMAIN_EVENTS.PURCHASE_ORDER_CREATED,
  DOMAIN_EVENTS.STOCK_UPDATED,
  DOMAIN_EVENTS.EXPENSE_CREATED,
  DOMAIN_EVENTS.EMPLOYEE_CREATED,
] as const;

// هل تم الربط سابقًا؟ (تفادي اشتراك مزدوج في HMR).
let wired = false;

// يربط الالتقاط؛ يستقبل دالة تجلب المنفّذ الحالي (من جلسة المستخدم).
export function wireAudit(getActor: () => AuditActor): () => void {
  if (wired) return () => undefined;
  wired = true;

  const unsubs: (() => void)[] = AUDITED_EVENTS.map((eventName) =>
    appEventBus.on(eventName, (event: DomainEvent) => {
      const entry = entryFromDomainEvent(eventName, event.payload, getActor(), event.occurredAt);
      if (entry) {
        void auditRepository.record(entry).catch((error: unknown) => {
          logger.warn('Audit capture failed', { event: eventName, error: String(error) });
        });
      }
    }),
  );

  // دالة فك الاشتراك عند التفكيك.
  return () => {
    for (const off of unsubs) off();
    wired = false;
  };
}
