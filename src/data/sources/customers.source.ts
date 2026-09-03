/**
 * مصدر العملاء المحلي الدائم (PHASE 19).
 * يخزّن عملاء CRM على الجهاز (Offline-First) عبر التفضيلات النصية.
 * اليوم محلي بالكامل، وغدًا تُستبدل الطبقة بمزامنة API من الحاوية فقط.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { Customer } from '@/domain/customers/types';

// واجهة تخزين نصية.
export interface CustomerStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// البيانات المحفوظة.
interface PersistedCustomers {
  customers: Customer[]; // العملاء.
}

// واجهة المصدر.
export interface CustomersSource {
  list(): Promise<Customer[]>; // كل العملاء (الأحدث نشاطًا أولًا).
  save(customer: Customer): Promise<void>; // إضافة/تعديل (upsert بالمعرف).
}

// قراءة JSON آمنة (تتسامح مع الفساد).
async function read(store: CustomerStore): Promise<PersistedCustomers> {
  try {
    const raw = await store.getString(STORAGE_KEYS.customers);
    if (!raw) return { customers: [] };
    const parsed = JSON.parse(raw) as PersistedCustomers;
    return { customers: parsed.customers ?? [] };
  } catch (error) {
    logger.warn('Failed to parse customers', { error: String(error) });
    return { customers: [] };
  }
}

export class LocalCustomersSource implements CustomersSource {
  constructor(private readonly store: CustomerStore) {} // نستقبل المخزن.

  // قائمة العملاء: النشطون أولًا ثم الأحدث زيارة/إنشاء.
  async list(): Promise<Customer[]> {
    const data = await read(this.store);
    return [...data.customers].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const ta = a.lastVisitAt ?? a.createdAt;
      const tb = b.lastVisitAt ?? b.createdAt;
      return tb.localeCompare(ta);
    });
  }

  // حفظ/تحديث عميل (يستبدل بنفس المعرف).
  async save(customer: Customer): Promise<void> {
    const data = await read(this.store);
    const rest = data.customers.filter((c) => String(c.id) !== String(customer.id));
    await this.store.setString(STORAGE_KEYS.customers, JSON.stringify({ customers: [customer, ...rest] }));
  }
}
