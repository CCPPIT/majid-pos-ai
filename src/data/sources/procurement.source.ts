/**
 * مصادر المشتريات المحلية الدائمة (PHASE 18).
 * تخزّن المورّدين وأوامر الشراء على الجهاز (Offline-First) عبر التفضيلات
 * النصية. اليوم محلية بالكامل، وغدًا تُستبدل الطبقة بمزامنة API من الحاوية فقط.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { PurchaseOrder, Supplier } from '@/domain/procurement/types';

// واجهة تخزين نصية.
export interface ProcurementStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// مصدر المورّدين.
export interface SuppliersSource {
  list(): Promise<Supplier[]>; // كل المورّدين.
  save(supplier: Supplier): Promise<void>; // إضافة/تعديل (upsert بالمعرف).
  nextSequence(): Promise<number>; // الرقم التسلسلي التالي.
}

// مصدر أوامر الشراء.
export interface PurchaseOrdersSource {
  list(): Promise<PurchaseOrder[]>; // كل الأوامر (الأحدث أولًا).
  save(po: PurchaseOrder): Promise<void>; // حفظ/تحديث أمر.
  nextSequence(): Promise<number>; // الرقم التسلسلي التالي.
}

// قراءة JSON آمنة من مفتاح (تتسامح مع الفساد).
async function readJson<T>(store: ProcurementStore, key: string, fallback: T): Promise<T> {
  try {
    const raw = await store.getString(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn('Failed to parse procurement data', { key, error: String(error) });
    return fallback;
  }
}

// مصدر المورّدين المحلي.
export class LocalSuppliersSource implements SuppliersSource {
  constructor(private readonly store: ProcurementStore) {} // نستقبل المخزن.

  async list(): Promise<Supplier[]> {
    const data = await readJson<{ suppliers: Supplier[] }>(this.store, STORAGE_KEYS.suppliers, { suppliers: [] });
    // النشطون أولًا ثم الأحدث.
    return [...data.suppliers].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async save(supplier: Supplier): Promise<void> {
    // نقرأ الشكل الكامل (مورّدون + تسلسل) لئلا نكتب فوق أحدهما.
    const data = await readJson<{ suppliers: Supplier[]; sequence: number }>(this.store, STORAGE_KEYS.suppliers, {
      suppliers: [],
      sequence: 0,
    });
    const rest = data.suppliers.filter((s) => String(s.id) !== String(supplier.id)); // استبدال بنفس المعرف.
    await this.store.setString(
      STORAGE_KEYS.suppliers,
      JSON.stringify({ suppliers: [...rest, supplier], sequence: data.sequence }),
    );
  }

  async nextSequence(): Promise<number> {
    // نحافظ على قائمة المورّدين عند تحديث التسلسل.
    const data = await readJson<{ suppliers: Supplier[]; sequence: number }>(this.store, STORAGE_KEYS.suppliers, {
      suppliers: [],
      sequence: 0,
    });
    const next = data.sequence + 1;
    await this.store.setString(STORAGE_KEYS.suppliers, JSON.stringify({ suppliers: data.suppliers, sequence: next }));
    return next;
  }
}

// مصدر أوامر الشراء المحلي.
export class LocalPurchaseOrdersSource implements PurchaseOrdersSource {
  constructor(private readonly store: ProcurementStore) {} // نستقبل المخزن.

  async list(): Promise<PurchaseOrder[]> {
    const data = await readJson<{ orders: PurchaseOrder[] }>(this.store, STORAGE_KEYS.purchaseOrders, { orders: [] });
    // الأحدث أولًا بزمن الإنشاء.
    return [...data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(po: PurchaseOrder): Promise<void> {
    // نقرأ الشكل الكامل (أوامر + تسلسل) لئلا نكتب فوق أحدهما.
    const data = await readJson<{ orders: PurchaseOrder[]; sequence: number }>(this.store, STORAGE_KEYS.purchaseOrders, {
      orders: [],
      sequence: 0,
    });
    const rest = data.orders.filter((o) => String(o.id) !== String(po.id)); // استبدال بنفس المعرف.
    await this.store.setString(
      STORAGE_KEYS.purchaseOrders,
      JSON.stringify({ orders: [po, ...rest], sequence: data.sequence }),
    );
  }

  async nextSequence(): Promise<number> {
    // نحافظ على قائمة الأوامر عند تحديث التسلسل.
    const data = await readJson<{ orders: PurchaseOrder[]; sequence: number }>(this.store, STORAGE_KEYS.purchaseOrders, {
      orders: [],
      sequence: 0,
    });
    const next = data.sequence + 1;
    await this.store.setString(STORAGE_KEYS.purchaseOrders, JSON.stringify({ orders: data.orders, sequence: next }));
    return next;
  }
}
