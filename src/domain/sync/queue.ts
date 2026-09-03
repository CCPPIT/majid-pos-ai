/**
 * منطق طابور المزامنة النقي (PHASE 23).
 * دوال خالصة تدير قائمة الطفرات: إضافة، اختيار التالي، تعليم النجاح/الفشل،
 * سياسة إعادة المحاولة، والتجميع (QueueSummary). لا تخزين ولا واجهة.
 */
import { asId } from '@/core/types/domain';
import type {
  MutationAction,
  MutationEntity,
  MutationRecord,
  QueueSummary,
} from './types';

// أقصى محاولات افتراضي قبل اعتبار الطفرة فشلًا دائمًا.
export const DEFAULT_MAX_ATTEMPTS = 5;

// وسائط إنشاء طفرة.
export interface EnqueueArgs {
  entity: MutationEntity; // الكيان.
  action: MutationAction; // العملية.
  localId: string; // المعرف المحلي.
  ref?: string; // مرجع بشري.
  payload?: Record<string, unknown>; // الحمولة.
  maxAttempts?: number; // أقصى محاولات.
  now?: string; // لحظة التسجيل.
}

// ينشئ سجل طفرة جديدًا بحالة "بانتظار".
export function createMutation(args: EnqueueArgs): MutationRecord {
  const now = args.now ?? new Date().toISOString();
  return {
    id: asId(`mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    entity: args.entity,
    action: args.action,
    localId: args.localId,
    ref: args.ref,
    payload: args.payload ?? {},
    status: 'pending',
    attempts: 0,
    maxAttempts: args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    createdAt: now,
    updatedAt: now,
  };
}

// يضيف طفرة جديدة لقائمة (نقي: يعيد قائمة جديدة).
export function enqueue(queue: readonly MutationRecord[], mutation: MutationRecord): MutationRecord[] {
  return [mutation, ...queue];
}

// الطفرات المعلّقة (الأقدم أولًا = FIFO) وحد أقصى اختياري للدفعة.
export function nextPending(queue: readonly MutationRecord[], limit?: number): MutationRecord[] {
  const pending = queue.filter((m) => m.status === 'pending');
  // الترتيب الزمني التصاعدي (الأقدم أولًا).
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return limit ? pending.slice(0, limit) : pending;
}

// يعليم طفرة أنها قيد الإرسال ويزيد عدد المحاولات.
export function markInflight(mutation: MutationRecord, now: string = new Date().toISOString()): MutationRecord {
  return { ...mutation, status: 'inflight', attempts: mutation.attempts + 1, updatedAt: now };
}

// يعليم الطفرة نجاحًا (مزامنة).
export function markSynced(mutation: MutationRecord, remoteRef?: string, now: string = new Date().toISOString()): MutationRecord {
  return {
    ...mutation,
    status: 'synced',
    lastError: undefined,
    syncedAt: now,
    updatedAt: now,
    ...(remoteRef ? { payload: { ...mutation.payload, remoteRef } } : {}),
  };
}

// يعليم الطفرة فشلًا؛ تعود "بانتظار" إن كانت ضمن حد المحاولات، وإلا "فشلت".
export function markFailed(mutation: MutationRecord, error: string, now: string = new Date().toISOString()): MutationRecord {
  const exhausted = mutation.attempts >= mutation.maxAttempts;
  return {
    ...mutation,
    status: exhausted ? 'failed' : 'pending', // محاولة أخرى لاحقًا.
    lastError: error,
    updatedAt: now,
  };
}

// يطبّق تحديثًا على طفرة بالمعرف داخل قائمة (نقي).
export function replaceById(queue: readonly MutationRecord[], updated: MutationRecord): MutationRecord[] {
  return queue.map((m) => (String(m.id) === String(updated.id) ? updated : m));
}

// يجمّع حالات الطابور للعرض.
export function summarizeQueue(queue: readonly MutationRecord[]): QueueSummary {
  const summary: QueueSummary = { total: queue.length, pending: 0, inflight: 0, failed: 0, synced: 0 };
  for (const m of queue) {
    if (m.status === 'pending') summary.pending += 1;
    else if (m.status === 'inflight') summary.inflight += 1;
    else if (m.status === 'failed') summary.failed += 1;
    else if (m.status === 'synced') summary.synced += 1;
  }
  return summary;
}

// هل توجد طفرات معلّقة (تحتاج إرسال)؟
export function hasPending(queue: readonly MutationRecord[]): boolean {
  return queue.some((m) => m.status === 'pending' || m.status === 'inflight');
}

// يبني مفتاح إزالة تكرار منطقي (كيان + إجراء + معرف محلي) لمنع تكرار طفرة.
export function mutationDedupKey(entity: MutationEntity, action: MutationAction, localId: string): string {
  return `${entity}:${action}:${localId}`;
}

// يمنع إضافة طفرة مكررة (نفس المفتاح المنطقي وحالة ليست ناجحة بعد).
export function findDuplicate(
  queue: readonly MutationRecord[],
  entity: MutationEntity,
  action: MutationAction,
  localId: string,
): MutationRecord | undefined {
  const key = mutationDedupKey(entity, action, localId);
  return queue.find(
    (m) =>
      mutationDedupKey(m.entity, m.action, m.localId) === key &&
      (m.status === 'pending' || m.status === 'inflight'),
  );
}
