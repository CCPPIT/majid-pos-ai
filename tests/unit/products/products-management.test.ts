/**
 * اختبارات إدارة المنتجات (PHASE 16).
 * تغطي: تحقق النموذج (الاسم/الباركود/السعر/الكمية)، المُصنِّع،
 * ومستودع المنتجات: الإنشاء/التعديل/الحذف والدمج مع الكتالوج التجريبي
 * ومنع تكرار الباركود (دائم محلي في الذاكرة).
 */
import {
  validateNameAr,
  validateBarcode,
  validatePrice,
  validateStock,
  validateDraft,
  type ProductDraft,
} from '@/domain/products/validation';
import { createProductFromDraft, applyDraftToProduct, productToDraft } from '@/domain/products/factory';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { AppProductsRepository } from '@/data/repositories/products.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';

// نموذج صالح أساسي.
const validDraft: ProductDraft = {
  nameAr: 'قهوة خاصة',
  nameEn: 'Special Coffee',
  barcode: '6291000000998',
  sku: '',
  categoryId: 'cat-beverages',
  priceAmount: '1500',
  currency: 'YER',
  taxIncluded: true,
  stockQuantity: '20',
};

// يبني مستودعًا فوق تخزين ذاكرة.
function makeRepo() {
  const prefs = new InMemoryPreferencesSource();
  const source = new LocalCatalogSource({
    getString: (k) => prefs.getString(k),
    setString: (k, v) => prefs.setString(k, v),
  });
  return { repo: new AppProductsRepository(source), prefs };
}

describe('products validation (PHASE 16)', () => {
  test('rejects empty Arabic name', () => {
    expect(validateNameAr('').valid).toBe(false);
  });

  test('accepts valid name', () => {
    expect(validateNameAr('منتج جديد').valid).toBe(true);
  });

  test('rejects empty or spaced barcode', () => {
    expect(validateBarcode('').valid).toBe(false);
    expect(validateBarcode('123 456').valid).toBe(false);
  });

  test('rejects non-positive or non-numeric price', () => {
    expect(validatePrice('').valid).toBe(false);
    expect(validatePrice('abc').valid).toBe(false);
    expect(validatePrice('-5').valid).toBe(false);
  });

  test('accepts zero price (sample/free) and rejects bad stock', () => {
    expect(validatePrice('0').valid).toBe(true);
    expect(validateStock('-1').valid).toBe(false);
    expect(validateStock('2.5').valid).toBe(false);
    expect(validateStock('100').valid).toBe(true);
  });

  test('validateDraft passes for complete draft', () => {
    expect(validateDraft(validDraft).valid).toBe(true);
  });

  test('validateDraft fails on any invalid field', () => {
    expect(validateDraft({ ...validDraft, barcode: '' }).valid).toBe(false);
    expect(validateDraft({ ...validDraft, stockQuantity: '-3' }).valid).toBe(false);
  });
});

describe('product factory (PHASE 16)', () => {
  const ctx = { tenantId: asId('tenant-t'), storeId: asId('store-s'), branchId: asId('branch-b'), sequence: 1 };

  test('creates a product with derived stock status and generated SKU', () => {
    const product = createProductFromDraft(validDraft, ctx);
    expect(product.nameAr).toBe('قهوة خاصة');
    expect(product.price.amount).toBe(1500);
    expect(product.stockQuantity).toBe(20);
    expect(product.stockStatus).toBe('in_stock');
    expect(product.sku).toContain('SKU-');
  });

  test('out-of-stock and low-stock statuses derive from quantity', () => {
    expect(createProductFromDraft({ ...validDraft, stockQuantity: '0' }, ctx).stockStatus).toBe('out_of_stock');
    expect(createProductFromDraft({ ...validDraft, stockQuantity: '3' }, ctx).stockStatus).toBe('low_stock');
  });

  test('applyDraftToProduct preserves id and updates values', () => {
    const product = createProductFromDraft(validDraft, ctx);
    const updated = applyDraftToProduct(product, { ...validDraft, priceAmount: '2000', stockQuantity: '0' });
    expect(updated.id).toBe(product.id);
    expect(updated.price.amount).toBe(2000);
    expect(updated.stockStatus).toBe('out_of_stock');
  });

  test('productToDraft round-trips editable fields', () => {
    const product = createProductFromDraft(validDraft, ctx);
    const draft = productToDraft(product);
    expect(draft.priceAmount).toBe('1500');
    expect(draft.barcode).toBe(validDraft.barcode);
    expect(draft.taxIncluded).toBe(true);
  });
});

describe('products repository CRUD (PHASE 16)', () => {
  const ctx = { tenantId: asId('tenant-t'), storeId: asId('store-s'), branchId: asId('branch-b'), sequence: 0 };

  test('create adds a new product visible in search', async () => {
    const { repo } = makeRepo();
    const before = await repo.searchProducts({});
    const created = await repo.createProduct(validDraft, ctx);
    const after = await repo.searchProducts({});
    expect(after.total).toBe(before.total + 1);
    expect(after.products.some((p) => p.id === created.id)).toBe(true);
    // والبحث بالعربي يعثر عليه أيضًا.
    const found = await repo.searchProducts({ search: 'قهوة' });
    expect(found.products.some((p) => p.id === created.id)).toBe(true);
  });

  test('new product is found by barcode (POS scan path)', async () => {
    const { repo } = makeRepo();
    await repo.createProduct(validDraft, ctx);
    const found = await repo.findProductByBarcode('6291000000998');
    expect(found).not.toBeNull();
    expect(found?.nameAr).toBe('قهوة خاصة');
  });

  test('duplicate barcode rejected with ValidationError', async () => {
    const { repo } = makeRepo();
    await repo.createProduct(validDraft, ctx);
    const dup: ProductDraft = { ...validDraft, nameAr: 'منتج آخر' };
    await expect(repo.createProduct(dup, ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('update changes existing product and keeps count', async () => {
    const { repo } = makeRepo();
    const created = await repo.createProduct(validDraft, ctx);
    const before = await repo.searchProducts({});
    await repo.updateProduct(created, { ...validDraft, priceAmount: '3000' });
    const after = await repo.searchProducts({});
    expect(after.total).toBe(before.total);
    const fetched = await repo.findProductByBarcode('6291000000998');
    expect(fetched?.price.amount).toBe(3000);
  });

  test('delete removes the product and it cannot be found', async () => {
    const { repo } = makeRepo();
    const created = await repo.createProduct(validDraft, ctx);
    const before = await repo.searchProducts({});
    await repo.deleteProduct(created.id);
    const after = await repo.searchProducts({});
    expect(after.total).toBe(before.total - 1);
    expect(await repo.findProductByBarcode('6291000000998')).toBeNull();
  });

  test('invalid draft rejected at repository layer', async () => {
    const { repo } = makeRepo();
    await expect(repo.createProduct({ ...validDraft, priceAmount: '' }, ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
