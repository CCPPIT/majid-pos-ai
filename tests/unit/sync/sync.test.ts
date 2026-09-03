/**
 * اختبارات منطق المزامنة (PHASE 23).
 * تغطي المنطق النقي للطابور (إنشاء، FIFO، حالات، إعادة محاولة، تجميع، إزالة
 * تكرار) ومستودع المزامنة (دفع متصل/غير متصل، فشل المزوّد، إزالة التكرار،
 * التقليم) بتخزين محلي محاكى ومزوّد مزامنة قابل للتحكم.
 */
import {
  createMutation,
  enqueue,
  nextPending,
  markInflight,
  markSynced,
  markFailed,
  summarizeQueue,
  findDuplicate,
  mutationDedupKey,
  DEFAULT_MAX_ATTEMPTS,
  type EnqueueArgs,
} from '@/domain/sync';
import type { MutationRecord, SyncResult } from '@/domain/sync/types';
import { DefaultConnectivityPort } from '@/domain/sync';
import type { SyncAdapter } from '@/domain/sync';
import { LocalSyncQueueSource, type SyncStore } from '@/data/sources/sync.source';
import { AppSyncRepository } from '@/data/repositories/sync.repository';

// وسيطة إنشاء طفرة بسيطة للاختبارات.
function args(over: Partial<EnqueueArgs> = {}): EnqueueArgs {
  return { entity: 'order', action: 'create', localId: 'o1', now: '2026-02-15T10:00:00.000Z', ...over };
}

describe('sync queue pure logic', () => {
  test('createMutation defaults to pending with zero attempts', () => {
    const m = createMutation(args());
    expect(m.status).toBe('pending');
    expect(m.attempts).toBe(0);
    expect(m.maxAttempts).toBe(DEFAULT_MAX_ATTEMPTS);
    expect(m.payload).toEqual({});
    expect(m.createdAt).toBe('2026-02-15T10:00:00.000Z');
    expect(m.syncedAt).toBeUndefined();
    expect(m.lastError).toBeUndefined();
  });

  test('enqueue prepends and nextPending returns oldest-first (FIFO)', () => {
    const a = createMutation(args({ localId: 'a', now: '2026-02-15T10:00:00.000Z' }));
    const b = createMutation(args({ localId: 'b', now: '2026-02-15T11:00:00.000Z' }));
    // التخزين: الأحدث أولًا (b ثم a).
    const queue = enqueue(enqueue([], a), b);
    expect(queue[0]?.localId).toBe('b');
    // المعالجة: الأقدم أولًا (a ثم b).
    const pending = nextPending(queue);
    expect(pending.map((m) => m.localId)).toEqual(['a', 'b']);
  });

  test('nextPending respects limit', () => {
    const ms = [1, 2, 3].map((i) =>
      createMutation(args({ localId: `o${i}`, now: `2026-02-15T10:0${i}:00.000Z` })),
    );
    const queue = ms.reduce((q, m) => enqueue(q, m), [] as MutationRecord[]);
    expect(nextPending(queue, 2).map((m) => m.localId)).toEqual(['o1', 'o2']);
  });

  test('markInflight increments attempts', () => {
    const m = createMutation(args());
    const inflight = markInflight(m, '2026-02-15T10:01:00.000Z');
    expect(inflight.status).toBe('inflight');
    expect(inflight.attempts).toBe(1);
  });

  test('markSynced clears error, sets syncedAt and stores remoteRef', () => {
    const inflight = { ...markInflight(createMutation(args())), lastError: 'boom' };
    const synced = markSynced(inflight, 'remote-123', '2026-02-15T10:02:00.000Z');
    expect(synced.status).toBe('synced');
    expect(synced.syncedAt).toBe('2026-02-15T10:02:00.000Z');
    expect(synced.lastError).toBeUndefined();
    expect((synced.payload as { remoteRef?: string }).remoteRef).toBe('remote-123');
  });

  test('markFailed retries while under maxAttempts then fails permanently', () => {
    // maxAttempts = 2: المحاولة الأولى (attempts=1) تعيد pending، الثانية (attempts=2) تفشل دائمًا.
    let m = createMutation(args({ maxAttempts: 2 }));
    m = markInflight(m); // attempts=1.
    let r = markFailed(m, 'err', '2026-02-15T10:01:00.000Z');
    expect(r.status).toBe('pending');
    expect(r.lastError).toBe('err');
    m = markInflight(r); // attempts=2.
    r = markFailed(m, 'err', '2026-02-15T10:02:00.000Z');
    expect(r.status).toBe('failed');
  });

  test('summarizeQueue counts each status', () => {
    const queue: MutationRecord[] = [
      createMutation(args({ localId: '1' })),
      markSynced(markInflight(createMutation(args({ localId: '2' }))), 'ref'),
      { ...createMutation(args({ localId: '3' })), status: 'inflight', attempts: 1 },
      { ...createMutation(args({ localId: '4', maxAttempts: 0 })), status: 'failed' },
    ];
    const s = summarizeQueue(queue);
    expect(s).toEqual({ total: 4, pending: 1, inflight: 1, synced: 1, failed: 1 });
  });

  test('dedup key format', () => {
    expect(mutationDedupKey('order', 'create', 'o1')).toBe('order:create:o1');
  });

  test('findDuplicate blocks a pending duplicate but allows after synced', () => {
    const m = createMutation(args({ localId: 'dup' }));
    expect(findDuplicate([m], 'order', 'create', 'dup')).toBeDefined();
    const synced = markSynced(m);
    expect(findDuplicate([synced], 'order', 'create', 'dup')).toBeUndefined();
    // كيان مختلف لا يُعد تكرارًا.
    expect(findDuplicate([m], 'payment', 'create', 'dup')).toBeUndefined();
  });
});

// مخزن مزامنة محاكى في الذاكرة.
function makeMemoryStore(): SyncStore & { blob: Record<string, string> } {
  const blob: Record<string, string> = {};
  return {
    blob,
    getString: async (key: string) => blob[key] ?? null,
    setString: async (key: string, value: string) => { blob[key] = value; },
  };
}

// مزوّد مزامنة محاكى قابل للتحكم.
function makeAdapter(behavior: { failIds?: Set<string>; calls?: number }): SyncAdapter {
  return {
    name: 'fake',
    async push(mutation: MutationRecord): Promise<SyncResult> {
      behavior.calls = (behavior.calls ?? 0) + 1;
      if (behavior.failIds?.has(mutation.localId)) {
        return { ok: false, error: 'remote rejected' };
      }
      return { ok: true, remoteRef: `remote:${mutation.localId}` };
    },
  };
}

describe('AppSyncRepository', () => {
  test('flush does nothing when offline and never calls adapter', async () => {
    const store = makeMemoryStore();
    const conn = new DefaultConnectivityPort();
    conn.set('offline');
    const behavior = { calls: 0 };
    const repo = new AppSyncRepository(new LocalSyncQueueSource(store), makeAdapter(behavior), conn);

    const rec = await repo.enqueue(args());
    // الدفع التلقائي لن يرسل شيئًا دون اتصال.
    const outcome = await repo.flush();
    expect(outcome.processed).toBe(0);
    expect(outcome.succeeded).toBe(0);
    expect(behavior.calls).toBe(0);
    // الطفرة تبقى معلّقة.
    expect((await repo.summary()).pending).toBe(1);
    expect(rec.status).toBe('pending');
  });

  test('flush pushes pending mutations and marks them synced when online', async () => {
    const store = makeMemoryStore();
    const conn = new DefaultConnectivityPort();
    conn.set('online');
    const behavior = { calls: 0 };
    const repo = new AppSyncRepository(new LocalSyncQueueSource(store), makeAdapter(behavior), conn);

    // enqueue يدفع تلقائيًا؛ ننتظر استقراره ثم نتحقق.
    await repo.enqueue(args({ localId: 'o1' }));
    await new Promise((r) => setTimeout(r, 0));
    const s = await repo.summary();
    expect(s.synced).toBe(1);
    expect(s.pending).toBe(0);
    expect(behavior.calls).toBeGreaterThanOrEqual(1);
  });

  test('adapter failure marks mutation failed (after retries) and reports failure', async () => {
    const store = makeMemoryStore();
    const conn = new DefaultConnectivityPort();
    conn.set('online');
    // نفشل دائمًا للطفرة bad؛ maxAttempts صغير لتسريع الفشل الدائم.
    const behavior = { calls: 0, failIds: new Set(['bad']) };
    const repo = new AppSyncRepository(new LocalSyncQueueSource(store), makeAdapter(behavior), conn);

    await repo.enqueue(args({ localId: 'bad', maxAttempts: 1 }));
    // الدفع التلقائي: المحاولة الأولى سترفع attempts إلى 1 = maxAttempts → فشل دائم.
    await new Promise((r) => setTimeout(r, 0));
    const s = await repo.summary();
    expect(s.failed).toBe(1);
  });

  test('enqueue dedups identical pending mutations (offline)', async () => {
    const store = makeMemoryStore();
    const conn = new DefaultConnectivityPort();
    conn.set('offline');
    const repo = new AppSyncRepository(new LocalSyncQueueSource(store), makeAdapter({}), conn);

    const first = await repo.enqueue(args({ localId: 'dup' }));
    const second = await repo.enqueue(args({ localId: 'dup' }));
    expect(String(second.id)).toBe(String(first.id));
    expect((await repo.summary()).total).toBe(1);
  });

  test('prune removes old synced but keeps non-synced', async () => {
    const store = makeMemoryStore();
    const conn = new DefaultConnectivityPort();
    conn.set('online');
    const repo = new AppSyncRepository(new LocalSyncQueueSource(store), makeAdapter({}), conn);

    // طفرتان متزامنتان وواحدة معلّقة (دون اتصال مؤقتًا).
    conn.set('online');
    await repo.enqueue(args({ localId: 's1' }));
    await repo.enqueue(args({ localId: 's2' }));
    await new Promise((r) => setTimeout(r, 0));
    conn.set('offline');
    await repo.enqueue(args({ localId: 'p1' }));

    await repo.prune(1); // نُبقي منسّقة واحدة فقط.
    const s = await repo.summary();
    expect(s.synced).toBe(1); // أُزيلت منسّقة قديمة.
    expect(s.pending).toBe(1); // المعلّقة محفوظة.
  });
});
