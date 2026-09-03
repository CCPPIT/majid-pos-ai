/**
 * أساس أحداث المجال — PHASE 31 · قسم 40.
 * نبني هنا العقود والمصانع فقط. ناقل الأحداث العالمي الكامل يأتي في
 * PHASE 34 — DOMAIN EVENT PLATFORM. اليوم تُجمَّع الأحداث داخل نتيجة العملية
 * أو تُنشر عبر ناقل التطبيق القائم (core/events) من طبقة التركيب.
 */
import type { ISODateTime } from '../types/datetime';
import type { EventId, StoreId, TenantId, UserId } from '../identifiers/ids';

// أسماء أحداث المجال القانونية في الـSDK.
export const SDK_DOMAIN_EVENTS = {
  PRODUCT_CREATED: 'sdk.product.created', // أُنشئ منتج.
  PRODUCT_UPDATED: 'sdk.product.updated', // عُدّل منتج.
  PRODUCT_DELETED: 'sdk.product.deleted', // حُذف منتج.
  SALE_CREATED: 'sdk.sale.created', // أُنشئت فاتورة بيع.
  SALE_COMPLETED: 'sdk.sale.completed', // اكتملت الفاتورة (مدفوعة).
  SALE_CANCELLED: 'sdk.sale.cancelled', // أُلغيت فاتورة.
  SALE_REFUNDED: 'sdk.sale.refunded', // استُرجعت فاتورة.
  PAYMENT_CREATED: 'sdk.payment.created', // أُنشئت دفعة.
  PAYMENT_COMPLETED: 'sdk.payment.completed', // نجحت دفعة.
  PAYMENT_FAILED: 'sdk.payment.failed', // فشلت دفعة.
  INVENTORY_ADJUSTED: 'sdk.inventory.adjusted', // سُوّي مخزون.
  INVENTORY_TRANSFERRED: 'sdk.inventory.transferred', // حُوّل مخزون.
  INVENTORY_RECEIVED: 'sdk.inventory.received', // استُلم مخزون.
  CUSTOMER_CREATED: 'sdk.customer.created', // أُنشئ عميل.
  CUSTOMER_UPDATED: 'sdk.customer.updated', // عُدّل عميل.
  PURCHASE_ORDER_CREATED: 'sdk.procurement.orderCreated', // أُنشئ أمر شراء.
  PURCHASE_ORDER_RECEIVED: 'sdk.procurement.orderReceived', // استُلم أمر شراء.
} as const;

// نوع اسم الحدث المشتق من الفهرس أعلاه.
export type SDKDomainEventName = (typeof SDK_DOMAIN_EVENTS)[keyof typeof SDK_DOMAIN_EVENTS];

// حدث مجال موصوف بالكامل (بيانات + بيانات وصفية للسياق).
export interface SDKDomainEvent<TName extends string = SDKDomainEventName, TPayload = unknown> {
  readonly eventId: EventId; // معرّف الحدث الفريد.
  readonly name: TName; // اسم الحدث.
  readonly payload: TPayload; // حمولة الحدث (مُطبَّعة، بلا بيانات حساسة).
  readonly occurredAt: ISODateTime; // لحظة الحدوث.
  readonly tenantId?: TenantId; // المستأجر صاحب الحدث.
  readonly storeId?: StoreId; // المتجر المعني.
  readonly actorId?: UserId; // منفّذ العملية.
  readonly operationId?: string; // ربط الحدث بالعملية التي ولّدته.
}

// بيانات السياق المرفقة عند بناء أي حدث.
export interface EventMetadata {
  readonly tenantId?: TenantId; // المستأجر.
  readonly storeId?: StoreId; // المتجر.
  readonly actorId?: UserId; // المنفّذ.
  readonly operationId?: string; // معرّف العملية.
  readonly occurredAt?: ISODateTime; // لحظة مخصّصة (للاختبارات).
}

// عدّاد داخلي يضمن تفرّد معرّفات الأحداث المولّدة في نفس المللي ثانية.
let eventCounter = 0;

// يولّد معرّف حدث فريد محليًا (يُستبدل بمعرّف الخادم عند التكامل).
const nextEventId = (): EventId => {
  // نزيد العدّاد ونلفّه لتفادي النمو اللانهائي.
  eventCounter = (eventCounter + 1) % 1_000_000;
  // نركّب المعرّف من الطابع الزمني والعدّاد.
  return `evt-${Date.now().toString(36)}-${eventCounter.toString(36)}` as EventId;
};

// يبني حدث مجال مكتمل البيانات الوصفية.
export const createDomainEvent = <TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  metadata: EventMetadata = {},
): SDKDomainEvent<TName, TPayload> => ({
  // معرّف فريد للحدث.
  eventId: nextEventId(),
  // اسم الحدث كما مُرّر.
  name,
  // الحمولة كما هي (المسؤولية على المُنتِج بألا يضع بيانات حساسة).
  payload,
  // لحظة الحدوث: المُمرَّرة أو الآن.
  occurredAt: metadata.occurredAt ?? new Date().toISOString(),
  // بيانات النطاق والتتبّع.
  tenantId: metadata.tenantId,
  storeId: metadata.storeId,
  actorId: metadata.actorId,
  operationId: metadata.operationId,
});

// ناشر أحداث: عقد بسيط تنفّذه طبقة التركيب لربط الـSDK بناقل التطبيق.
export interface EventPublisher {
  // ينشر حدثًا واحدًا (التنفيذ قد يكون متزامنًا أو غير متزامن).
  publish(event: SDKDomainEvent<string, unknown>): void;
}

// ناشر صامت (No-Op): الافتراضي حين لا يربط المضيف ناقلًا — لا يفعل شيئًا.
export const noopEventPublisher: EventPublisher = {
  // نتجاهل الحدث عمدًا: الـSDK يعمل كاملًا بدون ناقل أحداث.
  publish: () => undefined,
};

/**
 * مجمّع أحداث داخل عملية واحدة (Event Collector).
 * الخدمة تجمع الأحداث أثناء تنفيذ حالة الاستخدام ثم تنشرها دفعة واحدة بعد
 * نجاح العملية، فلا تُنشر أحداث عن عملية فشلت في منتصفها.
 */
export interface EventCollector {
  // يضيف حدثًا للمجموعة المؤقتة.
  add(event: SDKDomainEvent<string, unknown>): void;
  // يُرجع الأحداث المجمّعة (نسخة للقراءة).
  drain(): readonly SDKDomainEvent<string, unknown>[];
}

// ينشئ مجمّع أحداث ينشرها دفعة واحدة عند الاستنزاف.
export const createEventCollector = (publisher: EventPublisher = noopEventPublisher): EventCollector => {
  // مخزن مؤقت للأحداث داخل العملية الجارية.
  const buffer: SDKDomainEvent<string, unknown>[] = [];
  return {
    // الإضافة مجرد دفع للمخزن (بلا نشر بعد).
    add: (event) => {
      buffer.push(event);
    },
    // الاستنزاف ينشر كل حدث ثم يفرّغ المخزن ويُعيد نسخة.
    drain: () => {
      // نسخة ثابتة تُعاد للمتصل.
      const events = [...buffer];
      // نُفرّغ المخزن قبل النشر لتفادي التكرار عند إعادة الاستدعاء.
      buffer.length = 0;
      // ننشر كل حدث عبر الناشر المحقون.
      for (const event of events) publisher.publish(event);
      // نُعيد ما نُشر.
      return events;
    },
  };
};
