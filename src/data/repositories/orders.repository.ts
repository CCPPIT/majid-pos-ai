/**
 * مستودع طلبات البيع (PHASESE 13).
 * يبني طلبًا من السلة، يخزّنه محليًا (Offline-First)، ويعيد قائمة الطلبات
 * مفلترة بنطاق المتجر/الفرع. واجهته ثابتة عند استبدال المصدر المحلي بخادم.
 */
import type { ID } from '@/core/types/domain';
import type { Cart, CartTotals } from '@/domain/cart';
import { createSaleOrder } from '@/domain/sales/order';
import type { CreateOrderInput, SaleOrder } from '@/domain/sales/types';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import type { OrdersSource } from '../sources/orders.source';

// فلترة نطاق محلية متسامحة (تطابق الحقول الموجودة فقط، كمقارنة نصية).
function withinScope(
  order: SaleOrder,
  scope?: { storeId?: ID; branchId?: ID; organizationId?: ID },
): boolean {
  if (!scope) return true;
  // إن حُدد متجر نطابقه.
  if (scope.storeId && String(order.storeId ?? '') !== String(scope.storeId)) return false;
  // إن حُدد فرع نطابقه.
  if (scope.branchId && String(order.branchId ?? '') !== String(scope.branchId)) return false;
  // إن حُددت مؤسسة نطابقها.
  if (scope.organizationId && String(order.organizationId ?? '') !== String(scope.organizationId)) return false;
  return true;
}

// واجهة المستودع.
export interface OrdersRepository {
  // ينشئ طلب بيع من السلة ويخزّنه (رقم متسلسل تلقائي).
  createOrder(cart: Cart, totals: CartTotals, input: Omit<CreateOrderInput, 'sequence'>): Promise<SaleOrder>;
  // يجلب الطلبات (الأحدث أولًا) مع تضييق بالنطاق.
  listOrders(scope?: { storeId?: ID; branchId?: ID; organizationId?: ID }): Promise<SaleOrder[]>;
  // يجلب طلبًا بالمعرف.
  getOrder(id: ID): Promise<SaleOrder | null>;
}

// التنفيذ المحلي.
export class AppOrdersRepository implements OrdersRepository {
  constructor(private readonly source: OrdersSource) {} // نستقبل المصدر.

  async createOrder(cart: Cart, totals: CartTotals, input: Omit<CreateOrderInput, 'sequence'>): Promise<SaleOrder> {
    // رقم متسلسل جديد.
    const sequence = (await this.source.getSequence()) + 1;
    const order = createSaleOrder(cart, totals, { ...input, sequence });
    await this.source.appendOrder(order); // نخزّنه.
    // نبث حدث إنشاء البيع ليلتقطه طابور المزامنة (PHASE 23).
    appEventBus.emit(DOMAIN_EVENTS.SALE_CREATED, { orderId: String(order.id), orderNumber: order.orderNumber });
    return order;
  }

  async listOrders(scope?: { storeId?: ID; branchId?: ID; organizationId?: ID }): Promise<SaleOrder[]> {
    const all = await this.source.listOrders();
    // تضييق حسب نطاق المتجر/الفرع/المؤسسة (تطابق الحقول الموجودة فقط).
    return all.filter((order) => withinScope(order, scope));
  }

  async getOrder(id: ID): Promise<SaleOrder | null> {
    const all = await this.source.listOrders();
    return all.find((o) => String(o.id) === String(id)) ?? null;
  }
}
