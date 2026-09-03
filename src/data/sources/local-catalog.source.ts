/**
 * مصدر الكتالوج المحلي الدائم (PHASE 16).
 * يدمج الكتالوج التجريبي (DEMO) مع المنتجات التي يضيفها/يعدّلها المستخدم
 * والمحفوظة على الجهاز (Offline-First). المنتجات المحفوظة تحل محل التجريبية
 * بنفس المعرف (للتعديل)، وتُضاف الجديدة، والمحذوفة تُخفى بقائمة معرّفات.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { Product } from '@/domain/products/types';
import { CatalogData, DEMO_CATEGORIES, DEMO_PRODUCTS } from './products.source';

// واجهة تخزين نصية.
export interface CatalogStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// البيانات المحفوظة للمستخدم.
interface PersistedCatalog {
  products: Product[]; // منتجات المستخدم (جديدة أو معدلة).
  deletedIds: string[]; // معرّفات محذوفة.
  sequence: number; // آخر رقم تسلسلي.
}

// واجهة المصدر الدائم.
export interface PersistentProductsSource {
  getCatalog(): Promise<CatalogData>;
  upsertProduct(product: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  getSequence(): Promise<number>;
  nextSequence(): Promise<number>;
  // يجلب منتجًا بالمعرف من الكتالوج المدمج (PHASE 17 — تحديث المخزون).
  getProductById(id: string): Promise<Product | null>;
}

export class LocalCatalogSource implements PersistentProductsSource {
  constructor(private readonly store: CatalogStore) {} // نستقبل المخزن.

  // قراءة البيانات المحفوظة (مع تسامح مع الفساد).
  private async readPersisted(): Promise<PersistedCatalog> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.customProducts);
      if (!raw) return { products: [], deletedIds: [], sequence: 0 };
      const parsed = JSON.parse(raw) as PersistedCatalog;
      return {
        products: parsed.products ?? [],
        deletedIds: parsed.deletedIds ?? [],
        sequence: parsed.sequence ?? 0,
      };
    } catch (error) {
      logger.warn('Failed to parse custom products', { error: String(error) });
      return { products: [], deletedIds: [], sequence: 0 };
    }
  }

  private async writePersisted(data: PersistedCatalog): Promise<void> {
    await this.store.setString(STORAGE_KEYS.customProducts, JSON.stringify(data));
  }

  // الكتالوج المدمج: تجريبي + تعديلات المستخدم (دون المحذوف).
  async getCatalog(): Promise<CatalogData> {
    const persisted = await this.readPersisted();
    const deleted = new Set(persisted.deletedIds);
    // خريطة تعديلات المستخدم بالمعرف.
    const customById = new Map(persisted.products.map((p) => [String(p.id), p]));

    // نبدأ بالمنتجات التجريبية غير المحذوفة، ونستبدل أيًا منها بمعدّل المستخدم.
    const merged: Product[] = [];
    for (const demo of DEMO_PRODUCTS) {
      if (deleted.has(String(demo.id))) continue; // محذوف.
      merged.push(customById.get(String(demo.id)) ?? demo);
    }
    // نضيف منتجات المستخدم الجديدة (معرفاتها ليست ضمن التجريبي).
    const demoIds = new Set(DEMO_PRODUCTS.map((p) => String(p.id)));
    for (const custom of persisted.products) {
      if (!demoIds.has(String(custom.id)) && !deleted.has(String(custom.id))) {
        merged.push(custom);
      }
    }

    // نسخة مستقلة.
    return {
      categories: JSON.parse(JSON.stringify(DEMO_CATEGORIES)),
      products: JSON.parse(JSON.stringify(merged)),
    };
  }

  async upsertProduct(product: Product): Promise<void> {
    const persisted = await this.readPersisted();
    const rest = persisted.products.filter((p) => String(p.id) !== String(product.id));
    const next: PersistedCatalog = {
      ...persisted,
      products: [...rest, product],
      // إن أُزيل من المحذوفة سابقًا نعيده (تعديل منتج محذوف لا يحدث من الواجهة).
      deletedIds: persisted.deletedIds.filter((id) => id !== String(product.id)),
    };
    await this.writePersisted(next);
  }

  async deleteProduct(id: string): Promise<void> {
    const persisted = await this.readPersisted();
    const next: PersistedCatalog = {
      ...persisted,
      products: persisted.products.filter((p) => String(p.id) !== id),
      deletedIds: Array.from(new Set([...persisted.deletedIds, id])),
    };
    await this.writePersisted(next);
  }

  async getSequence(): Promise<number> {
    const persisted = await this.readPersisted();
    return persisted.sequence;
  }

  async nextSequence(): Promise<number> {
    const persisted = await this.readPersisted();
    const next = persisted.sequence + 1;
    await this.writePersisted({ ...persisted, sequence: next });
    return next;
  }

  // يجلب منتجًا بالمعرف من الكتالوج المدمج (لإدارة المخزون).
  async getProductById(id: string): Promise<Product | null> {
    const catalog = await this.getCatalog();
    return catalog.products.find((p) => String(p.id) === id) ?? null;
  }
}
