/**
 * مصدر طابور المزامنة المحلي (PHASE 23).
 * يخزّن الطفرات الصادرة على الجهاز (Offline-First) عبر التفضيلات النصية.
 * الطفرات الناجحة تُحتفظ بها لفترة (سجل) ثم تُزال دوريًا بواسطة المستودع.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { MutationRecord } from '@/domain/sync/types';

// واجهة تخزين نصية.
export interface SyncStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// واجهة المصدر.
export interface SyncQueueSource {
  list(): Promise<MutationRecord[]>; // كل الطفرات.
  replaceAll(mutations: MutationRecord[]): Promise<void>; // استبدال كامل (ذرّي).
}

// قراءة JSON آمنة (تتسامح مع الفساد).
async function read(store: SyncStore): Promise<MutationRecord[]> {
  try {
    const raw = await store.getString(STORAGE_KEYS.pendingMutationQueue);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { mutations?: MutationRecord[] };
    return parsed.mutations ?? [];
  } catch (error) {
    logger.warn('Failed to parse sync queue', { error: String(error) });
    return [];
  }
}

export class LocalSyncQueueSource implements SyncQueueSource {
  constructor(private readonly store: SyncStore) {} // نستقبل المخزن.

  // القائمة الأحدث أولًا (تُرتّب حسب الحاجة في المستودع).
  async list(): Promise<MutationRecord[]> {
    return read(this.store);
  }

  // كتابة القائمة كاملة (ذرّية قدر الإمكان على التخزين النصي).
  async replaceAll(mutations: MutationRecord[]): Promise<void> {
    await this.store.setString(STORAGE_KEYS.pendingMutationQueue, JSON.stringify({ mutations }));
  }
}
