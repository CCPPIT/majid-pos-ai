/**
 * اختبارات PHASE 11 — POS Core (كتالوج المنتجات).
 * تغطي: البحث/الفلترة النقية، الباركود، التصنيفات، المصدر التجريبي، والمستودع.
 */
import { MockProductsSource } from '@/data/sources/products.source';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { AppProductsRepository } from '@/data/repositories/products.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';

// مستودع محلي للاختبارات (دمج التجريبي + تعديلات).
function makeRepo() {
  const prefs = new InMemoryPreferencesSource();
  return new AppProductsRepository(
    new LocalCatalogSource({
      getString: (k) => prefs.getString(k),
      setString: (k, v) => prefs.setString(k, v),
    }),
  );
}
import { asId } from '@/core/types/domain';
import type { Product, ProductCategory } from '@/domain/products/types';
import {
  filterProducts,
  findByBarcode,
  matchesBarcode,
  matchesSearch,
  normalizeText,
  visibleCategories,
} from '@/domain/products/search';

// منتج اختبار.
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: asId('p1'),
    tenantId: asId('t1'),
    sku: 'SKU-1',
    barcode: '6291000000011',
    nameAr: 'مياه معدنية',
    nameEn: 'Mineral water',
    categoryId: 'cat-a',
    price: { amount: 300, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('PHASE 11 — pure search/filter', () => {
  it('normalizeText يوحّد الحالة والفراغات', () => {
    expect(normalizeText('  ABC 12 ')).toBe('abc12');
  });

  it('مطابقة البحث بالاسم العربي/الإنجليزي/الباركود/SKU', () => {
    const product = makeProduct();
    expect(matchesSearch(product, 'مياه')).toBe(true); // عربي.
    expect(matchesSearch(product, 'mineral')).toBe(true); // إنجليزي.
    expect(matchesSearch(product, '629100')).toBe(true); // باركود جزئي.
    expect(matchesSearch(product, 'SKU')).toBe(true); // SKU.
    expect(matchesSearch(product, 'xyz')).toBe(false); // غير موجود.
  });

  it('مطابقة الباركود بالضبط بعد التطبيع', () => {
    const product = makeProduct();
    expect(matchesBarcode(product, '6291000000011')).toBe(true);
    expect(matchesBarcode(product, ' 6291000000011 ')).toBe(true); // فراغات.
    expect(matchesBarcode(product, '9999')).toBe(false);
  });

  it('findByBarcode يعيد المنتج المطابق أو undefined', () => {
    const products = [makeProduct({ id: asId('a') }), makeProduct({ id: asId('b'), barcode: '111' })];
    expect(findByBarcode(products, '111')?.id).toBe(asId('b'));
    expect(findByBarcode(products, 'zzz')).toBeUndefined();
  });

  it('الفلترة بالتصنيف والبحث واستبعاد النافد', () => {
    const products = [
      makeProduct({ id: asId('1'), categoryId: 'cat-a', stockStatus: 'in_stock' }),
      makeProduct({ id: asId('2'), categoryId: 'cat-b', nameAr: 'قهوة', nameEn: 'coffee', barcode: '222', stockStatus: 'out_of_stock' }),
    ];
    expect(filterProducts(products, { categoryId: 'cat-a' })).toHaveLength(1);
    expect(filterProducts(products, { includeOutOfStock: false })).toHaveLength(1);
    expect(filterProducts(products, { search: 'قهوة' })).toHaveLength(1);
    expect(filterProducts(products, { limit: 1 })).toHaveLength(1);
  });

  it('visibleCategories يعيد التصنيفات المستخدمة فقط', () => {
    const products = [makeProduct({ categoryId: 'cat-a' })];
    const cats: ProductCategory[] = [
      { id: asId('cat-a'), nameAr: 'مشروبات', nameEn: 'Beverages' },
      { id: asId('cat-z'), nameAr: 'غير مستخدم', nameEn: 'Unused' },
    ];
    const visible = visibleCategories(products, cats);
    expect(visible).toHaveLength(1);
    expect(String(visible[0]?.id)).toBe('cat-a');
  });
});

describe('PHASE 11 — mock source & repository', () => {
  it('المصدر التجريبي يُرجع تصنيفات ومنتجات بأسعار نقدية', async () => {
    const source = new MockProductsSource();
    const catalog = await source.getCatalog();
    expect(catalog.products.length).toBeGreaterThanOrEqual(10);
    expect(catalog.categories.length).toBeGreaterThanOrEqual(4);
    // كل المنتجات لها سعر بالريال اليمني وكمية مخزون.
    for (const product of catalog.products) {
      expect(product.price.currency).toBe('YER');
      expect(product.price.amount).toBeGreaterThan(0);
      expect(typeof product.stockQuantity).toBe('number');
    }
  });

  it('المستودع يبحث بالاسم ويعيد نتيجة محدودة ومتسقة', async () => {
    const repo = makeRepo();
    const result = await repo.searchProducts({ search: 'مياه' });
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.fetchedAt).toBeDefined();
  });

  it('المستودع يجد منتجًا بالباركود ويعيد null للغير موجود', async () => {
    const repo = makeRepo();
    const found = await repo.findProductByBarcode('6291000000011');
    expect(found).not.toBeNull();
    expect(found?.nameAr).toContain('مياه');
    const missing = await repo.findProductByBarcode('0000000000000');
    expect(missing).toBeNull();
  });

  it('حالة المخزون تشتق من الكمية (نافد/منخفض/متوفر)', async () => {
    const source = new MockProductsSource();
    const catalog = await source.getCatalog();
    const outOfStock = catalog.products.filter((p) => p.stockStatus === 'out_of_stock');
    const lowStock = catalog.products.filter((p) => p.stockStatus === 'low_stock');
    // المنتج النافد كميته صفر.
    expect(outOfStock.every((p) => p.stockQuantity === 0)).toBe(true);
    // المنخفض كميته بين 1 و5.
    expect(lowStock.every((p) => p.stockQuantity >= 1 && p.stockQuantity <= 5)).toBe(true);
  });
});
