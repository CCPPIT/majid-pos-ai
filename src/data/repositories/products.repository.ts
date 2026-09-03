/**
 * مستودع المنتجات (PHASE 11 قراءة · PHASE 16 إدارة).
 * يخفي المصدر عن الشاشة، يخزّن الكتالوج في ذاكرة الكائن، يطبّق البحث/الفلترة
 * النقية، ويدير عمليات الإنشاء/التعديل/الحذف عبر مصدر دائم (Offline-First).
 */
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import type { Product, ProductCatalogResult, ProductCategory, ProductQuery } from '@/domain/products/types';
import { filterProducts, visibleCategories, findByBarcode } from '@/domain/products/search';
import {
  createProductFromDraft,
  applyDraftToProduct,
  withStockLevel,
  type ProductFactoryContext,
} from '@/domain/products/factory';
import { validateDraft, type ProductDraft } from '@/domain/products/validation';
import { logger } from '@/core/logging/logger';
import type { CatalogData } from '../sources/products.source';
import type { PersistentProductsSource } from '../sources/local-catalog.source';

// واجهة المستودع.
export interface ProductsRepository {
  searchProducts(query: ProductQuery): Promise<ProductCatalogResult>;
  findProductByBarcode(barcode: string, scope?: { storeId?: ID; branchId?: ID }): Promise<Product | null>;
  listCategories(): Promise<ProductCategory[]>;
  // إدارة الكتالوج (PHASE 16).
  createProduct(draft: ProductDraft, ctx: ProductFactoryContext): Promise<Product>;
  updateProduct(product: Product, draft: ProductDraft): Promise<Product>;
  deleteProduct(id: ID): Promise<void>;
  // هل الباركود مستخدم؟ (لمنع التكرار).
  isBarcodeTaken(barcode: string, exceptProductId?: ID): Promise<boolean>;
  // يحدّث مستوى مخزون منتج بالمعرف (PHASE 17 — من مستودع المخزون).
  setProductStock(productId: ID, quantity: number): Promise<void>;
}

// التنفيذ المحلي.
export class AppProductsRepository implements ProductsRepository {
  private cached: CatalogData | null = null; // كتالوج مخزّن مؤقتًا.

  constructor(private readonly source: PersistentProductsSource) {} // نستقبل المصدر الدائم.

  // تحميل الكتالوج (مرة واحدة ثم من الذاكرة).
  private async ensureCatalog(): Promise<CatalogData> {
    if (this.cached) return this.cached;
    try {
      this.cached = await this.source.getCatalog();
    } catch (error) {
      logger.error('Products catalog load failed', { error: String(error) });
      throw error;
    }
    return this.cached;
  }

  // إبطال الذاكرة بعد أي تعديل.
  private invalidate(): void {
    this.cached = null;
  }

  async searchProducts(query: ProductQuery): Promise<ProductCatalogResult> {
    const catalog = await this.ensureCatalog();
    const filtered = filterProducts(catalog.products, query);
    const categories = visibleCategories(catalog.products, catalog.categories);
    return {
      products: filtered,
      categories,
      total: filtered.length,
      fetchedAt: new Date().toISOString(),
    };
  }

  async findProductByBarcode(barcode: string, scope?: { storeId?: ID; branchId?: ID }): Promise<Product | null> {
    const catalog = await this.ensureCatalog();
    const scoped = filterProducts(catalog.products, {
      storeId: scope?.storeId,
      branchId: scope?.branchId,
    });
    return findByBarcode(scoped, barcode) ?? null;
  }

  async listCategories(): Promise<ProductCategory[]> {
    const catalog = await this.ensureCatalog();
    return visibleCategories(catalog.products, catalog.categories);
  }

  async isBarcodeTaken(barcode: string, exceptProductId?: ID): Promise<boolean> {
    const catalog = await this.ensureCatalog();
    const normalized = barcode.trim();
    return catalog.products.some(
      (p) => p.barcode.trim() === normalized && (!exceptProductId || String(p.id) !== String(exceptProductId)),
    );
  }

  async createProduct(draft: ProductDraft, ctx: ProductFactoryContext): Promise<Product> {
    // تحقق طبقة البيانات أيضًا (لا الواجهة فقط).
    const validation = validateDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid product');
    }
    if (await this.isBarcodeTaken(draft.barcode)) {
      throw new ValidationError('products.error.barcodeDuplicate');
    }
    const sequence = await this.source.nextSequence();
    const product = createProductFromDraft(draft, { ...ctx, sequence });
    await this.source.upsertProduct(product);
    this.invalidate();
    return product;
  }

  async updateProduct(product: Product, draft: ProductDraft): Promise<Product> {
    const validation = validateDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid product');
    }
    if (await this.isBarcodeTaken(draft.barcode, product.id)) {
      throw new ValidationError('products.error.barcodeDuplicate');
    }
    const updated = applyDraftToProduct(product, draft);
    await this.source.upsertProduct(updated);
    this.invalidate();
    return updated;
  }

  async deleteProduct(id: ID): Promise<void> {
    await this.source.deleteProduct(String(id));
    this.invalidate();
  }

  async setProductStock(productId: ID, quantity: number): Promise<void> {
    // يجلب المنتج الحالي ثم يحدّث كميته/حالته ويحفظه عبر المصدر.
    const product = await this.source.getProductById(String(productId));
    if (!product) {
      throw new ValidationError('inventory.error.productNotFound');
    }
    await this.source.upsertProduct(withStockLevel(product, quantity));
    this.invalidate();
  }
}
