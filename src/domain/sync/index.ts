/**
 * نقطة تصدير مجال المزامنة (PHASE 23).
 */
import type { MutationRecord, SyncResult } from './types';

export * from './types'; // أنواع الطفرات والاتصال.
export {
  DEFAULT_MAX_ATTEMPTS,
  createMutation,
  enqueue,
  nextPending,
  markInflight,
  markSynced,
  markFailed,
  replaceById,
  summarizeQueue,
  hasPending,
  mutationDedupKey,
  findDuplicate,
  type EnqueueArgs,
} from './queue'; // منطق الطابور النقي.
export { DefaultConnectivityPort, type ConnectivityPort } from './connectivity'; // منفذ الاتصال.

/**
 * منفذ مزوّد المزامنة (SyncAdapter).
 * البوابة الحقيقية/API ستنفّذ هذا المنفذ لاحقًا فترسل الطفرة للخادم.
 * اليوم نوفّر محاكيًا صادقًا لا يهدر البيانات (محلي فقط) حتى يتوفر الخادم.
 */
export interface SyncAdapter {
  // يرسل طفرة واحدة للخادم؛ يعيد نتيجة النجاح/الفشل.
  push(mutation: MutationRecord): Promise<SyncResult>;
  // اسم المزوّد (للعرض/السجلات).
  readonly name: string;
}

/**
 * محاكي المزامنة المحلي (لا خادم بعد).
 * يعتبر الطفرة "نُسّقت" فورًا لأن مصدر الحقيقة الحالي هو الجهاز نفسه.
 * عند توفّر الخادم، يُستبدل هذا بمحوّل HTTP حقيقي يطبّق نفس الواجهة.
 */
export class LocalSimulatedSyncAdapter implements SyncAdapter {
  readonly name = 'local-simulated';

  async push(mutation: MutationRecord): Promise<SyncResult> {
    // لا شبكة: نحاكي نجاحًا فوريًا (البيانات محفوظة محليًا أصلًا).
    return { ok: true, remoteRef: `local:${mutation.entity}:${mutation.localId}` };
  }
}
