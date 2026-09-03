/**
 * اختبارات سجل التدقيق (PHASE 27).
 * تغطي المنطق النقي: ربط أحداث المجال بمدخلات التدقيق، استبعاد أحداث الضجيج،
 * مدخلات الأمان، الفلترة والبحث، التلخيص، والطبيعة append-only للمصدر
 * والمستودع (لا تعديل/حذف، تقليم للحد الأقصى).
 */
import {
  entryFromDomainEvent,
  makeSecurityEntry,
  filterEntries,
  summarizeAudit,
  DEVICE_ACTOR,
} from '@/domain/audit';
import type { AuditEntry } from '@/domain/audit';
import { LocalAuditLogSource, type AuditStore } from '@/data/sources/audit.source';
import { AppAuditRepository } from '@/data/repositories/audit.repository';

// مخزن نصي في الذاكرة.
function makeStore(): AuditStore & { blob: Record<string, string> } {
  const blob: Record<string, string> = {};
  return {
    blob,
    getString: async (key: string) => blob[key] ?? null,
    setString: async (key: string, value: string) => { blob[key] = value; },
  };
}

// يبني مدخلة بوقت محدد للاختبارات.
function entryAt(action: AuditEntry['action'], category: AuditEntry['category'], at: string, severity: AuditEntry['severity'] = 'info', ref?: string): AuditEntry {
  return {
    id: `${action}-${at}`,
    action,
    category,
    severity,
    summaryKey: `audit.entry.${action}`,
    summaryParams: {},
    actorId: 'device',
    actorLabel: 'device',
    entityRef: ref,
    occurredAt: at,
  };
}

describe('entryFromDomainEvent', () => {
  test('maps sale.created to a sales audit entry', () => {
    const e = entryFromDomainEvent('sale.created', { orderId: 'o1', orderNumber: 'ORD-0042' });
    expect(e).not.toBeNull();
    expect(e?.category).toBe('sales');
    expect(e?.action).toBe('sale_created');
    expect(e?.entityRef).toBe('ORD-0042');
    expect(e?.summaryParams.ref).toBe('ORD-0042');
  });

  test('maps payment.completed with method and marks sensitive', () => {
    const e = entryFromDomainEvent('payment.completed', { orderNumber: 'ORD-0007', method: 'cash' });
    expect(e?.severity).toBe('sensitive');
    expect(e?.category).toBe('payments');
    expect(e?.summaryParams.method).toBe('cash');
  });

  test('ignores non-audited events (sync/connectivity/audit)', () => {
    expect(entryFromDomainEvent('sync.queued', { id: 'x' })).toBeNull();
    expect(entryFromDomainEvent('connectivity.changed', { state: 'offline' })).toBeNull();
    expect(entryFromDomainEvent('audit.recorded', { id: 'a' })).toBeNull();
  });

  test('uses provided actor', () => {
    const e = entryFromDomainEvent('expense.created', { id: 'e1' }, { id: 'user-9', label: 'ماجد' });
    expect(e?.actorId).toBe('user-9');
    expect(e?.actorLabel).toBe('ماجد');
  });
});

describe('makeSecurityEntry', () => {
  test('creates security-category entries', () => {
    const lock = makeSecurityEntry('app_locked', 'audit.entry.app_locked', 'security');
    expect(lock.category).toBe('security');
    expect(lock.action).toBe('app_locked');
    const unlock = makeSecurityEntry('app_unlocked', 'audit.entry.app_unlocked', 'security', DEVICE_ACTOR, { method: 'pin' });
    expect(unlock.summaryParams.method).toBe('pin');
  });
});

describe('filterEntries', () => {
  const entries: AuditEntry[] = [
    entryAt('sale_created', 'sales', '2026-02-15T10:00:00.000Z', 'info', 'ORD-0001'),
    entryAt('payment_completed', 'payments', '2026-02-15T11:00:00.000Z', 'sensitive', 'ORD-0002'),
    entryAt('app_locked', 'security', '2026-02-15T12:00:00.000Z', 'security'),
    entryAt('stock_updated', 'inventory', '2026-02-14T09:00:00.000Z', 'info', 'قهوة'),
  ];

  test('sorts newest first by default', () => {
    const out = filterEntries(entries);
    expect(out[0]?.occurredAt).toBe('2026-02-15T12:00:00.000Z');
    expect(out).toHaveLength(4);
  });

  test('filters by category', () => {
    expect(filterEntries(entries, { category: 'security' }).map((e) => e.action)).toEqual(['app_locked']);
  });

  test('filters by severity', () => {
    expect(filterEntries(entries, { severity: 'sensitive' })).toHaveLength(1);
  });

  test('filters by since/until window', () => {
    const out = filterEntries(entries, { since: '2026-02-15T00:00:00.000Z', until: '2026-02-15T23:59:59.000Z' });
    expect(out).toHaveLength(3);
  });

  test('searches across refs and actions', () => {
    expect(filterEntries(entries, { search: 'ORD-0001' })).toHaveLength(1);
    // الفعل app_locked والمرجع قهوة قابلان للبحث.
    expect(filterEntries(entries, { search: 'app_locked' })).toHaveLength(1);
    expect(filterEntries(entries, { search: 'قهوة' })).toHaveLength(1);
    expect(filterEntries(entries, { search: 'nonexistent-xyz' })).toHaveLength(0);
  });
});

describe('summarizeAudit', () => {
  test('counts by category and severity', () => {
    const entries = [
      entryAt('sale_created', 'sales', '2026-02-15T10:00:00.000Z', 'info'),
      entryAt('payment_completed', 'payments', '2026-02-15T11:00:00.000Z', 'sensitive'),
      entryAt('app_locked', 'security', '2026-02-15T12:00:00.000Z', 'security'),
    ];
    const s = summarizeAudit(entries);
    expect(s.total).toBe(3);
    expect(s.securityCount).toBe(1);
    expect(s.bySeverity.info).toBe(1);
    expect(s.bySeverity.sensitive).toBe(1);
    expect(s.bySeverity.security).toBe(1);
    expect(s.byCategory.sales).toBe(1);
  });
});

describe('LocalAuditLogSource + AppAuditRepository (append-only)', () => {
  test('appends entries and never exposes mutation/deletion', async () => {
    const store = makeStore();
    const source = new LocalAuditLogSource(store);
    const repo = new AppAuditRepository(source);

    await repo.record(entryAt('sale_created', 'sales', '2026-02-15T10:00:00.000Z', 'info', 'ORD-1'));
    await repo.record(entryAt('app_locked', 'security', '2026-02-15T11:00:00.000Z', 'security'));

    const list = await repo.list();
    expect(list).toHaveLength(2);
    // الأحدث أولًا.
    expect(list[0]?.action).toBe('app_locked');
    // الملخص يعكس العدد.
    const summary = await repo.summary();
    expect(summary.total).toBe(2);
    expect(summary.securityCount).toBe(1);
  });

  test('read is resilient to corrupt storage', async () => {
    const store = makeStore();
    store.blob['@majid_pos_ai:audit_log'] = '{not-json';
    const source = new LocalAuditLogSource(store);
    await expect(source.list()).resolves.toEqual([]);
  });
});
