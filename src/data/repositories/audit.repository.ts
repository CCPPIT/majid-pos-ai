/**
 * مستودع سجل التدقيق (PHASE 27).
 * يكتب مدخلات التدقيق (لا تعديل/حذف للمدخلات — append-only) ويقرأ/يفلتر/يلخّص
 * عبر منطق المجال النقي. يبث حدثًا لكل مدخلة جديدة (لا يُلتقط هو نفسه لتفادي
 * حلقة لا نهائية — أحداث التدقيق غير مشمولة في EVENT_MAP).
 */
import { filterEntries, summarizeAudit } from '@/domain/audit';
import type { AuditActor, AuditEntry, AuditFilter, AuditSummary } from '@/domain/audit';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import { logger } from '@/core/logging/logger';
import type { AuditLogSource } from '../sources/audit.source';

// واجهة المستودع.
export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>; // يسجّل مدخلة واحدة.
  list(filter?: AuditFilter): Promise<AuditEntry[]>; // يقرأ مفلترًا (الأحدث أولًا).
  summary(): Promise<AuditSummary>; // ملخص إحصائي.
}

export class AppAuditRepository implements AuditRepository {
  constructor(private readonly source: AuditLogSource) {} // المصدر المحلي.

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.source.appendAll([entry]);
      // نبث حدث تدقيق (لا يُسجَّل مرة أخرى؛ مستبعد من EVENT_MAP).
      appEventBus.emit(DOMAIN_EVENTS.AUDIT_RECORDED, { id: entry.id, action: entry.action });
    } catch (error) {
      logger.warn('Audit record failed', { error: String(error) });
    }
  }

  async list(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    const entries = await this.source.list();
    return filterEntries(entries, filter);
  }

  async summary(): Promise<AuditSummary> {
    return summarizeAudit(await this.source.list());
  }
}

// يبني المنفّذ من جلسة المستخدم (يستخدمها الرابط عند تسجيل الأحداث).
export function sessionActor(session: { user?: { id?: string; fullName?: string; phone?: string } } | null): AuditActor {
  const user = session?.user;
  if (!user?.id) {
    return { id: 'device', label: 'device' };
  }
  return { id: String(user.id), label: user.fullName ?? user.phone ?? String(user.id) };
}
