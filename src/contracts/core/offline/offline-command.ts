/**
 * عقود الأوامر غير المتصلة — PHASE 32 · أقسام 40 و41.
 *
 * حرج لنقطة بيع ماجد: الأوامر تُنشأ دون اتصال وتنتظر عودة الشبكة.
 * الأمر المُنتظَر قد يكون من نسخة عقد قديمة، لذا يحمل نسخته صراحةً،
 * وعند التنفيذ يُرحَّل عبر محرّك الترحيل (Old Command ← Migration ←
 * Current Command) — لا تُحذف الأوامر القديمة بلا استراتيجية (قسم 41).
 */
import type { Branded, CommandId, StoreId, TenantId, UserId } from '../primitives/ids';
import type { ISODateTime } from '../metadata/metadata';

// حالة الأمر غير المتصل عبر دورة حياته.
export type OfflineCommandStatus =
  | 'queued' // في الطابور بانتظار الاتصال.
  | 'migrating' // قيد الترحيل لنسخة العقد الحالية.
  | 'ready' // جاهز للإرسال.
  | 'syncing' // قيد الإرسال.
  | 'completed' // نُفّذ بنجاح.
  | 'failed' // فشل نهائي/يحتاج تدخلًا.
  | 'conflicted'; // تعارض يحتاج حسمًا.

// الغلاف الموحّد لأمر غير متصل (قسم 40 — كل الحقول إلزامية).
export interface OfflineCommandEnvelope<TPayload = unknown> {
  readonly commandId: CommandId; // معرّف فريد لتتبّع الأثر (Idempotency).
  readonly commandType: string; // نوع الأمر (مثل: sales.create).
  readonly commandVersion: string; // نسخة عقد الأمر وقت الإنشاء (قسم 40).
  readonly createdAt: ISODateTime; // لحظة الإنشاء (أثناء عدم الاتصال).
  readonly tenantId: TenantId; // المستأجر.
  readonly storeId: StoreId; // المتجر.
  readonly createdBy?: UserId; // المستخدم المنفِّذ (أمين الصندوق).
  readonly payload: TPayload; // حمولة الأمر المُطبَّعة.
  readonly idempotencyKey: string; // مفتاح منع التكرار عند إعادة الإرسال.
  readonly status: OfflineCommandStatus; // الحالة الحالية.
  readonly attemptCount: number; // عدد محاولات الإرسال.
  readonly lastError?: string; // آخر خطأ (للتشخيص).
  readonly schemaVersion: number; // نسخة مخطط التخزين المحلي (قسم 39).
}

// مدخل إنشاء أمر غير متصل (يُملأ الباقي تلقائيًا).
export interface CreateOfflineCommandInput<TPayload> {
  readonly commandType: string; // النوع.
  readonly commandVersion: string; // النسخة.
  readonly payload: TPayload; // الحمولة.
  readonly tenantId: TenantId; // المستأجر.
  readonly storeId: StoreId; // المتجر.
  readonly createdBy?: UserId; // المنفِّذ.
}

// عدّاد محلي للمعرّفات.
let commandSequence = 0;

// يولّد معرّف أمر فريدًا.
export const generateCommandId = (): CommandId => {
  commandSequence = (commandSequence + 1) % 1_000_000;
  return `cmd_${Date.now().toString(36)}_${commandSequence.toString(36)}` as CommandId;
};

// يبني غلاف أمر غير متصل جديدًا بحالة «في الطابور».
export const createOfflineCommand = <TPayload>(
  input: CreateOfflineCommandInput<TPayload>,
): OfflineCommandEnvelope<TPayload> => {
  // المعرّف يُولَّد مرة واحدة ويُستخدم أيضًا مفتاح idempotency.
  const commandId = generateCommandId();
  return Object.freeze({
    commandId,
    commandType: input.commandType,
    commandVersion: input.commandVersion,
    createdAt: new Date().toISOString(),
    tenantId: input.tenantId,
    storeId: input.storeId,
    createdBy: input.createdBy,
    payload: input.payload,
    idempotencyKey: commandId as unknown as Branded<string, 'IdempotencyKey'> as unknown as string,
    status: 'queued' as OfflineCommandStatus,
    attemptCount: 0,
    schemaVersion: 1, // النسخة الحالية لمخطط التخزين المحلي.
  });
};

// نسخة مخطط البيانات المحلية الحالية — قسم 39 (Storage Schema Version).
export const LOCAL_STORAGE_SCHEMA_VERSION = 1 as const;

/**
 * يحدّث حالة الأمر عبر دورة الحياة (يعيد نسخة مجمّدة جديدة — لا تعديل
 * لكائن قائم، فالأمر المُنتظَر سجلّ تاريخي).
 */
export const transitionOfflineCommand = <TPayload>(
  command: OfflineCommandEnvelope<TPayload>,
  next: Partial<Pick<OfflineCommandEnvelope<TPayload>, 'status' | 'lastError' | 'payload' | 'commandVersion'>>,
): OfflineCommandEnvelope<TPayload> =>
  Object.freeze({
    ...command,
    ...next,
    // عدد المحاولات يزيد عند الانتقال لمحاولة إرسال.
    attemptCount: next.status === 'syncing' ? command.attemptCount + 1 : command.attemptCount,
  });
