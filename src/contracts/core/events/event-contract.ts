/**
 * عقود الأحداث المُنسَّخة — PHASE 32 · أقسام 33 و34.
 *
 * أحداث المجال عقود علنية تُخزَّن أحيانًا (صندوق خارجي/غير متصل) وقد
 * يقرأها مستهلك قديم بعد ترقية. لذلك لا يتغيّر شكل الحدث مباشرة، بل:
 *   SaleCompleted.v1 · SaleCompleted.v2 · Event Upcaster (قسم 34)
 * كل حدث يحمل: eventName · eventVersion · eventId · occurredAt ·
 * aggregateId · payload.
 */
import type { EventId, StoreId, TenantId, UserId } from '../primitives/ids';
import type { ISODateTime } from '../metadata/metadata';

// الغلاف الموحّد لكل حدث مجال مُنسَّخ.
export interface VersionedDomainEvent<TPayload = unknown> {
  readonly eventId: EventId; // معرّف الحدث الفريد.
  readonly eventName: string; // اسم الحدث (مثل: sale.completed).
  readonly eventVersion: string; // نسخة الحدث الدلالية (قسم 33).
  readonly occurredAt: ISODateTime; // لحظة الحدوث.
  readonly aggregateId: string; // معرّف الكيان صاحب الحدث (الفاتورة/الدفعة…).
  readonly payload: TPayload; // الحمولة المُطبَّعة.
  readonly tenantId?: TenantId; // المستأجر.
  readonly storeId?: StoreId; // المتجر.
  readonly actorId?: UserId; // المنفِّذ.
}

// بيانات بناء الحدث (يُملأ eventId/occurredAt تلقائيًا عند الحاجة).
export interface EventEnvelopeInput<TPayload> {
  readonly eventName: string; // الاسم.
  readonly eventVersion: string; // النسخة.
  readonly aggregateId: string; // معرّف الكيان.
  readonly payload: TPayload; // الحمولة.
  readonly eventId?: EventId; // المعرّف (يُولَّد إن غاب).
  readonly occurredAt?: ISODateTime; // اللحظة (تُملأ إن غابت).
  readonly tenantId?: TenantId; // المستأجر.
  readonly storeId?: StoreId; // المتجر.
  readonly actorId?: UserId; // المنفِّذ.
}

// عدّاد محلي لتفادي تضارب المعرّفات في نفس المللي ثانية.
let eventSequence = 0;

// يولّد معرّف حدث فريدًا محليًا (يستبدله الخادم لاحقًا عند المزامنة).
export const generateEventId = (): EventId => {
  eventSequence = (eventSequence + 1) % 1_000_000;
  return `evt_${Date.now().toString(36)}_${eventSequence.toString(36)}` as EventId;
};

// يبني غلاف حدث موحّد ومجمّدًا.
export const buildEvent = <TPayload>(input: EventEnvelopeInput<TPayload>): VersionedDomainEvent<TPayload> =>
  Object.freeze({
    eventId: input.eventId ?? generateEventId(),
    eventName: input.eventName,
    eventVersion: input.eventVersion,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    aggregateId: input.aggregateId,
    payload: input.payload,
    tenantId: input.tenantId,
    storeId: input.storeId,
    actorId: input.actorId,
  });

/**
 * رافع أحداث (Event Upcaster) — قسم 34.
 * يحوّل حمولة حدث قديمة إلى الشكل الحالي قبل تسليمها للمستهلك،
 * فيبقى المستهلك مبسوطًا يتعامل مع النسخة الأحدث فقط.
 */
export type EventUpcaster<TFrom = unknown, TTo = unknown> = (payload: TFrom) => TTo;

// يسجّل رافعًا واحدًا لكل (اسم حدث · نسخة مصدر).
export class EventUpcasterRegistry {
  private readonly upcasters = new Map<string, EventUpcaster>();

  // مفتاح الخريطة.
  private key(eventName: string, fromVersion: string): string {
    return `${eventName}@${fromVersion}`;
  }

  // يسجّل رافعًا.
  register<TFrom, TTo>(eventName: string, fromVersion: string, up: EventUpcaster<TFrom, TTo>): void {
    this.upcasters.set(this.key(eventName, fromVersion), up as EventUpcaster);
  }

  /**
   * يرفع الحدث إلى النسخة الهدف إن وُجد مسار.
   * يُرجع الحدث كما هو إن كانت نسخته مطابقة، أو لا رافع معروف.
   */
  upcast<TPayload>(
    event: VersionedDomainEvent,
    toVersion: string,
    up: (payload: unknown) => unknown = (p) => p,
  ): VersionedDomainEvent<TPayload> {
    // نفس النسخة: لا تحويل.
    if (event.eventVersion === toVersion) return event as VersionedDomainEvent<TPayload>;
    // نبحث عن رافع مسجّل للنسخة المصدر.
    const upcaster = this.upcasters.get(this.key(event.eventName, event.eventVersion));
    // لا رافع: نُرجع الحدث كما هو (المستهلك يقرّر).
    if (!upcaster) return event as VersionedDomainEvent<TPayload>;
    // نحوّل الحمولة ونعيد حدثًا بنسخة الهدف.
    const payload = up(upcaster(event.payload));
    return Object.freeze({ ...event, eventVersion: toVersion, payload }) as VersionedDomainEvent<TPayload>;
  }
}

// النسخة المشتركة لسجلّ روافع الأحداث.
export const eventUpcasters = new EventUpcasterRegistry();
