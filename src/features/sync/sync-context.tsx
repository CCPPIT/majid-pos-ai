/**
 * مزوّد المزامنة وحالة الاتصال (PHASE 23).
 * يعرض للواجهة حالة الاتصال وملخص الطابور، يستمع لأحداث المزامنة لتحديث
 * العدّاد حيًا، ويوفر دفعًا يدويًا (sync now). التطبيق يعمل دون اتصال أصلًا؛
 * هذا المكوّن يعكس حالة طابور التكامل المستقبلي بشفافية (لا تزوير).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { connectivityPort, syncRepository } from '@/shared/container';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import { wireSyncEvents } from '@/shared/sync/sync-bootstrap';
import { logger } from '@/core/logging/logger';
import type { ConnectivityState, QueueSummary, SyncOutcome } from '@/domain/sync/types';

// ما يعرضه المزوّد.
interface SyncContextValue {
  connectivity: ConnectivityState; // حالة الاتصال.
  summary: QueueSummary; // ملخص الطابور.
  syncing: boolean; // هل الدفع جارٍ؟
  syncNow: () => Promise<SyncOutcome | null>; // دفع يدوي.
  refresh: () => Promise<void>; // تحديث الملخص.
}

const SyncContext = createContext<SyncContextValue | null>(null);

// ملخص فارغ مبدئي.
const EMPTY_SUMMARY: QueueSummary = { total: 0, pending: 0, inflight: 0, failed: 0, synced: 0 };

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [connectivity, setConnectivity] = useState<ConnectivityState>('unknown');
  const [summary, setSummary] = useState<QueueSummary>(EMPTY_SUMMARY);
  const [syncing, setSyncing] = useState(false);

  // تحديث ملخص الطابور من المستودع.
  const refresh = useCallback(async () => {
    try {
      setSummary(await syncRepository.summary());
    } catch (error) {
      logger.warn('Sync summary failed', { error: String(error) });
    }
  }, []);

  // دفع يدوي للطابور.
  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const outcome = await syncRepository.flush();
      await refresh();
      await syncRepository.prune(); // ننظّف الطفرات المنسّقة القديمة.
      await refresh();
      return outcome;
    } catch (error) {
      logger.warn('Manual sync failed', { error: String(error) });
      return null;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    // ربط أحداث المجال بالطابور (مرة واحدة).
    const unwire = wireSyncEvents();

    // الاشتراك بحالة الاتصال.
    const unsubConnectivity = connectivityPort.subscribe((state) => setConnectivity(state));

    // تحديث العدّاد عند أحداث المزامنة.
    const onChanged = () => void refresh();
    const offQueued = appEventBus.on(DOMAIN_EVENTS.SYNC_QUEUED, onChanged);
    const offCompleted = appEventBus.on(DOMAIN_EVENTS.SYNC_COMPLETED, onChanged);
    const offFailed = appEventBus.on(DOMAIN_EVENTS.SYNC_FAILED, onChanged);

    // تحديث أولي غير متزامن (لا setState متزامن داخل جسم الأثر).
    Promise.resolve()
      .then(() => refresh())
      .catch((error: unknown) => logger.warn('Sync provider init failed', { error: String(error) }));

    return () => {
      unwire();
      unsubConnectivity();
      offQueued();
      offCompleted();
      offFailed();
    };
  }, [refresh]);

  const value = useMemo<SyncContextValue>(
    () => ({ connectivity, summary, syncing, syncNow, refresh }),
    [connectivity, summary, syncing, syncNow, refresh],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// خطاف وصول للمزوّد.
export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    // إن استُخدم خارج المزوّد نعيد قيمًا آمنة (لا نكسر الشاشات).
    return {
      connectivity: 'unknown',
      summary: EMPTY_SUMMARY,
      syncing: false,
      syncNow: async () => null,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
