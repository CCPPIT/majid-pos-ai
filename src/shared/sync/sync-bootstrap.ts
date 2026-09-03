/**
 * ربط المزامنة (PHASE 23).
 * يستمع لأحداث المجال (بيع/دفع/منتج/عميل/…) ويسجّل طفرة في الطابور الصادر.
 * التصميم مفكوك: المستودعات تبثّ أحداثًا فقط، ولا تعرف شيئًا عن المزامنة.
 * هنا تُترجَم الأحداث إلى طفرات، ويُجرى دفع أولي للطابور عند بدء التطبيق.
 */
import { appEventBus, DOMAIN_EVENTS, type DomainEvent } from '@/core/events/EventBus';
import { logger } from '@/core/logging/logger';
import { syncRepository } from '@/shared/container';
import type { MutationAction, MutationEntity } from '@/domain/sync/types';

// هل تم الربط بالفعل؟ (لتفادي الاشتراك مرتين في تطوير HMR).
let wired = false;

// يسجّل طفرة من حدث مجال (لا يكسر التدفق إن فشل التسجيل).
async function record(entity: MutationEntity, action: MutationAction, data: Record<string, unknown>): Promise<void> {
  try {
    await syncRepository.enqueue({
      entity,
      action,
      localId: String(data.orderId ?? data.paymentId ?? data.id ?? data.productId ?? data.customerId ?? 'unknown'),
      ref: data.orderNumber as string | undefined,
      payload: data,
    });
  } catch (error) {
    logger.warn('Outbox enqueue failed', { entity, error: String(error) });
  }
}

// يربط الاستماع لأحداث المجال (يُستدعى مرة واحدة من مزوّد المزامنة).
export function wireSyncEvents(): () => void {
  if (wired) return () => undefined;
  wired = true;

  const unsubs: (() => void)[] = [];

  // بيع جديد → طفرة إنشاء طلب.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.SALE_CREATED, (e: DomainEvent) => {
    void record('order', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // دفعة مكتملة → طفرة إنشاء دفعة.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.PAYMENT_COMPLETED, (e: DomainEvent) => {
    void record('payment', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // منتج جديد.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.PRODUCT_CREATED, (e: DomainEvent) => {
    void record('product', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // عميل جديد.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.CUSTOMER_CREATED, (e: DomainEvent) => {
    void record('customer', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // أمر شراء جديد.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.PURCHASE_ORDER_CREATED, (e: DomainEvent) => {
    void record('purchase_order', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // مصروف جديد.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.EXPENSE_CREATED, (e: DomainEvent) => {
    void record('expense', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // موظف جديد.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.EMPLOYEE_CREATED, (e: DomainEvent) => {
    void record('employee', 'create', (e.payload as Record<string, unknown>) ?? {});
  }));

  // مخزون محدّث → طفرة تحديث مخزون.
  unsubs.push(appEventBus.on(DOMAIN_EVENTS.STOCK_UPDATED, (e: DomainEvent) => {
    void record('inventory', 'update', (e.payload as Record<string, unknown>) ?? {});
  }));

  // محاولة دفع أولي للطابور المخزّن عند بدء التشغيل.
  void syncRepository.flush().catch((error: unknown) => {
    logger.warn('Initial sync flush failed', { error: String(error) });
  });

  // دالة إلغاء الاشتراك (عند تفكيك الجذر).
  return () => {
    for (const off of unsubs) off();
    wired = false;
  };
}
