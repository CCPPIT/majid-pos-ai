/**
 * مستودع المزامنة / محرّك الطابور (PHASE 23).
 * يسجّل الكتابات المحلية كطفرات تُحفظ على الجهاز أولًا (Offline-First)، ويدفعها
 * عبر مزوّد المزامنة عند الاتصال. المزوّد اليوم محاكي محلي صادق؛ غدًا بوابة HTTP.
 * يبث أحداثًا عبر ناقل المجال (queued/completed/failed) لتحدّثها الواجهة.
 */
import {
  createMutation,
  enqueue as enqueuePure,
  nextPending,
  markInflight,
  markSynced,
  markFailed,
  replaceById,
  summarizeQueue,
  findDuplicate,
  type ConnectivityPort,
  type EnqueueArgs,
  type SyncAdapter,
} from '@/domain/sync';
import type { MutationRecord, QueueSummary, SyncOutcome } from '@/domain/sync/types';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import { logger } from '@/core/logging/logger';
import type { SyncQueueSource } from '../sources/sync.source';

// واجهة المستودع.
export interface SyncRepository {
  // يسجّل كتابة محلية (يمنع التكرار المنطقي للطفرات المعلّقة).
  enqueue(args: EnqueueArgs): Promise<MutationRecord>;
  // يحاول دفع كل الطفرات المعلّقة (يتحقق من الاتصال أولًا).
  flush(): Promise<SyncOutcome>;
  list(): Promise<MutationRecord[]>;
  summary(): Promise<QueueSummary>;
  // يحذف الطفرات المنسّقة القديمة (يُبقي الطابور صغيرًا).
  prune(keepSynced?: number): Promise<void>;
}

export class AppSyncRepository implements SyncRepository {
  constructor(
    private readonly source: SyncQueueSource, // التخزين المحلي للطابور.
    private readonly adapter: SyncAdapter, // مزوّد الإرسال (محاكي اليوم).
    private readonly connectivity: ConnectivityPort, // منفذ الاتصال.
  ) {}

  async enqueue(args: EnqueueArgs): Promise<MutationRecord> {
    const queue = await this.source.list();
    // منع طفرة مكررة معلّقة لنفس الكيان/الإجراء/المعرف.
    const dup = findDuplicate(queue, args.entity, args.action, args.localId);
    if (dup) {
      logger.debug('Mutation already queued', { key: `${args.entity}:${args.action}:${args.localId}` });
      return dup;
    }
    const mutation = createMutation(args);
    await this.source.replaceAll(enqueuePure(queue, mutation));
    appEventBus.emit(DOMAIN_EVENTS.SYNC_QUEUED, { id: String(mutation.id), entity: mutation.entity });
    // نحاول الدفع فورًا في حال الاتصال (لا نُفشل إن لم يكن).
    void this.flush().catch((e) => logger.warn('Auto flush after enqueue failed', { error: String(e) }));
    return mutation;
  }

  async flush(): Promise<SyncOutcome> {
    // لا نرسل دون اتصال (التطبيق يعمل محليًا؛ الطابور ينتظر).
    const connection = await this.connectivity.getState();
    if (connection === 'offline') {
      return { processed: 0, succeeded: 0, failed: 0, remainingPending: (await this.summary()).pending };
    }

    let queue = await this.source.list();
    const batch = nextPending(queue, 25); // دفعة بحد أقصى.
    let succeeded = 0;
    let failed = 0;

    for (const pending of batch) {
      const inflight = markInflight(pending);
      queue = replaceById(queue, inflight);
      await this.source.replaceAll(queue);

      try {
        const result = await this.adapter.push(inflight);
        if (result.ok) {
          const synced = markSynced(inflight, result.remoteRef);
          queue = replaceById(queue, synced);
          succeeded += 1;
        } else {
          const failedRecord = markFailed(inflight, result.error ?? 'sync.failed');
          queue = replaceById(queue, failedRecord);
          failed += 1;
          appEventBus.emit(DOMAIN_EVENTS.SYNC_FAILED, { id: String(inflight.id), error: result.error });
        }
      } catch (error) {
        const failedRecord = markFailed(inflight, String(error));
        queue = replaceById(queue, failedRecord);
        failed += 1;
        appEventBus.emit(DOMAIN_EVENTS.SYNC_FAILED, { id: String(inflight.id), error: String(error) });
      }
      await this.source.replaceAll(queue);
    }

    if (succeeded > 0) {
      appEventBus.emit(DOMAIN_EVENTS.SYNC_COMPLETED, { succeeded });
    }

    const summary = summarizeQueue(queue);
    return {
      processed: batch.length,
      succeeded,
      failed,
      remainingPending: summary.pending,
    };
  }

  async list(): Promise<MutationRecord[]> {
    const queue = await this.source.list();
    // الأحدث أولًا للعرض.
    return [...queue].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async summary(): Promise<QueueSummary> {
    return summarizeQueue(await this.source.list());
  }

  async prune(keepSynced = 50): Promise<void> {
    const queue = await this.source.list();
    // نُبقي غير المنسّقة كلها + آخر `keepSynced` منسّقة فقط.
    const synced = queue.filter((m) => m.status === 'synced').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const keepSyncedIds = new Set(synced.slice(0, keepSynced).map((m) => String(m.id)));
    const kept = queue.filter((m) => m.status !== 'synced' || keepSyncedIds.has(String(m.id)));
    await this.source.replaceAll(kept);
  }
}
