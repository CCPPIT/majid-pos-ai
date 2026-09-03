/**
 * مصدر تخزين طلبات البيع (PHASE 13).
 * اليوم يخزّن الطلبات محليًا (JSON على الجهاز) — Offline-First؛
 * لاحقًا تُزامن/تُجلب من API دون تغيير المستودع أو الشاشات.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { SaleOrder } from '@/domain/sales/types';

// واجهة تخزين نصية (مثل مصدر الإعداد).
export interface OrdersStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// واجهة المصدر.
export interface OrdersSource {
  // يجلب كل الطلبات المخزنة (الأحدث أولًا).
  listOrders(): Promise<SaleOrder[]>;
  // يجلب آخر رقم تسلسلي مستخدم (لترقيم الطلبات).
  getSequence(): Promise<number>;
  // يضيف طلبًا ويحدّث الرقم التسلسلي.
  appendOrder(order: SaleOrder): Promise<void>;
  // يحدّث طلبًا قائمًا (مثل تغيير حالة الدفع) ويحفظه.
  updateOrder(updated: SaleOrder): Promise<void>;
}

// مصدر محلي فوق مخزن نصي.
export class LocalOrdersSource implements OrdersSource {
  constructor(private readonly store: OrdersStore) {} // نستقبل المخزن.

  async listOrders(): Promise<SaleOrder[]> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.orders);
      if (!raw) return []; // لا طلبات بعد.
      const parsed = JSON.parse(raw) as SaleOrder[];
      // الأحدث أولًا: حسب رقم الطلب المتسلسل (ORD-0002 قبل ORD-0001) ثم التاريخ.
      return [...parsed].sort((a, b) => {
        const seqA = Number(a.orderNumber.replace(/\D/g, ''));
        const seqB = Number(b.orderNumber.replace(/\D/g, ''));
        if (seqA !== seqB) return seqB - seqA;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
    } catch (error) {
      logger.warn('Failed to parse orders', { error: String(error) });
      return [];
    }
  }

  async getSequence(): Promise<number> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.ordersSequence);
      const value = raw ? Number(raw) : 0;
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  async appendOrder(order: SaleOrder): Promise<void> {
    // نقرأ الموجود ونضيف الجديد (أبسط نمط متسق محليًا).
    const existing = await this.listOrders();
    const next = [order, ...existing];
    await this.store.setString(STORAGE_KEYS.orders, JSON.stringify(next));
    // الرقم التسلسلي يُستخرج من رقم الطلب (ORD-XXXX).
    const seq = Number(order.orderNumber.replace(/\D/g, ''));
    await this.store.setString(STORAGE_KEYS.ordersSequence, String(seq));
  }

  async updateOrder(updated: SaleOrder): Promise<void> {
    // نقرأ الموجود ونستبدل الطلب ذي نفس المعرف (مع الحفاظ على الترتيب).
    const existing = await this.listOrders();
    const next = existing.map((o) => (String(o.id) === String(updated.id) ? updated : o));
    await this.store.setString(STORAGE_KEYS.orders, JSON.stringify(next));
  }
}
