/**
 * أنواع مجال المزامنة Offline-First (PHASE 23).
 * طابور صادر (Outbox) يسجّل كل عملية كتابة محلية كـ"طفرة" (Mutation) تُحفظ على
 * الجهاز أولًا، ثم تُرسل للخادم لاحقًا عند توفر الاتصال عبر مزوّد قابل للاستبدال.
 * البيانات محلية أصلًا (تطبيق يعمل دون اتصال)؛ الطابور هو عقدة التكامل المستقبلية.
 */
import type { ID, ISODateString } from '@/core/types/domain';

// حالة الطفرة في الطابور.
export type MutationStatus =
  | 'pending' // بانتظار الإرسال.
  | 'inflight' // قيد الإرسال حاليًا.
  | 'synced' // أُرسلت بنجاح.
  | 'failed'; // فشلت (تُعاد المحاولة وفق العدد الأقصى).

// نوع كيان الطفرة (أي شاشة تكتب بيانات).
export type MutationEntity =
  | 'order'
  | 'payment'
  | 'product'
  | 'customer'
  | 'supplier'
  | 'purchase_order'
  | 'inventory'
  | 'expense'
  | 'employee'
  | 'generic';

// نوع العملية.
export type MutationAction = 'create' | 'update' | 'delete';

// طفرة معلّقة في الطابور الصادر.
export interface MutationRecord {
  id: ID; // معرف الطفرة.
  entity: MutationEntity; // الكيان المتأثر.
  action: MutationAction; // العملية.
  localId: string; // المعرف المحلي للكيان.
  ref?: string; // مرجع بشري (رقم طلب/أمر…).
  payload: Record<string, unknown>; // لقطة الحمولة (تُرسل للخادم مستقبلًا).
  status: MutationStatus; // الحالة.
  attempts: number; // عدد محاولات الإرسال.
  maxAttempts: number; // أقصى محاولات قبل اعتبارها فشلًا دائمًا.
  lastError?: string; // آخر سبب فشل (مفتاح/رسالة).
  createdAt: ISODateString; // لحظة التسجيل (محليًا).
  updatedAt: ISODateString; // آخر تحديث للحالة.
  syncedAt?: ISODateString; // لحظة النجاح.
}

// نتيجة إرسال طفرة عبر المزوّد.
export interface SyncResult {
  ok: boolean; // نجح؟
  remoteRef?: string; // مرجع الخادم (إن وُجد).
  error?: string; // سبب الفشل.
}

// حالة الاتصال.
export type ConnectivityState = 'online' | 'offline' | 'unknown';

// نتيجة دفع الطابور بالكامل.
export interface SyncOutcome {
  processed: number; // طفرات عولجت في هذه الجولة.
  succeeded: number; // نجحت.
  failed: number; // فشلت.
  remainingPending: number; // ما زال معلّقًا.
}

// نسبة المزامنة (0-100) للعرض.
export interface QueueSummary {
  total: number; // كل الطفرات.
  pending: number; // بانتظار الإرسال.
  inflight: number; // قيد الإرسال.
  failed: number; // فشلت.
  synced: number; // نُسّقت بنجاح.
}
