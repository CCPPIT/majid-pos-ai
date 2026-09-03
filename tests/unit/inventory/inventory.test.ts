/**
 * اختبارات مجال ومستودع المخزون (PHASE 17).
 * تغطي: حساب أثر الحركة، بناء حركة موثّقة + التحقق، الملخص،
 * ومستودع المخزون: استلام/تسوية/تحويل مع تحديث رصيد المنتج ورفض المخالفات.
 */
import {
  applyMovement,
  effectOf,
  canDeduct,
  buildMovement,
  summarizeLevels,
  totalStockValue,
} from '@/domain/inventory/movements';
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';
import { LocalInventoryMovementsSource } from '@/data/sources/inventory.source';
import { AppInventoryRepository } from '@/data/repositories/inventory.repository';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { AppProductsRepository } from '@/data/repositories/products.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import type { InventoryLevel } from '@/domain/inventory/types';

// يبني مستودع مخزون فوق تخزين ذاكرة (كتالوج + حركات).
function makeInventory() {
  const prefs = new InMemoryPreferencesSource();
  const productsRepo = new AppProductsRepository(
    new LocalCatalogSource({
      getString: (k) => prefs.getString(k),
      setString: (k, v) => prefs.setString(k, v),
    }),
  );
  const movementsSource = new LocalInventoryMovementsSource({
    getString: (k) => prefs.getString(k),
    setString: (k, v) => prefs.setString(k, v),
  });
  const inventoryRepo = new AppInventoryRepository(movementsSource, productsRepo);
  return { inventoryRepo, productsRepo };
}

// سياق منفّذ للاختبارات.
const actor = { tenantId: asId('tenant-t'), storeId: asId('store-1'), branchId: asId('branch-b') };

describe('inventory movement math (PHASE 17)', () => {
  test('effects map to increase/decrease/set', () => {
    expect(effectOf('receive')).toBe('increase');
    expect(effectOf('sale')).toBe('decrease');
    expect(effectOf('adjust')).toBe('set');
  });

  test('applyMovement increases, decreases and clamps at zero', () => {
    expect(applyMovement(10, 'receive', 5)).toBe(15);
    expect(applyMovement(10, 'sale', 4)).toBe(6);
    expect(applyMovement(3, 'transfer_out', 9)).toBe(0); // لا يُسمح بالسالب.
    expect(applyMovement(10, 'adjust', 7)).toBe(7);
  });

  test('canDeduct only when sufficient stock', () => {
    expect(canDeduct(5, 5)).toBe(true);
    expect(canDeduct(5, 6)).toBe(false);
    expect(canDeduct(5, 0)).toBe(false);
  });

  test('buildMovement records resulting quantity', () => {
    const mov = buildMovement({
      tenantId: actor.tenantId,
      productId: asId('p1'),
      type: 'receive',
      quantity: 4,
      currentQuantity: 10,
      reason: 'شراء',
      sequence: 1,
    });
    expect(mov.resultingQuantity).toBe(14);
    expect(mov.quantity).toBe(4);
    expect(mov.status).toBe('completed');
  });

  test('buildMovement rejects zero/negative quantity and missing reason', () => {
    const base = { tenantId: actor.tenantId, productId: asId('p1'), currentQuantity: 10 };
    expect(() => buildMovement({ ...base, type: 'receive', quantity: 0, reason: 'x' })).toThrow(ValidationError);
    expect(() => buildMovement({ ...base, type: 'receive', quantity: 2, reason: '  ' })).toThrow(ValidationError);
  });

  test('buildMovement rejects deduction beyond stock', () => {
    expect(() =>
      buildMovement({
        tenantId: actor.tenantId,
        productId: asId('p1'),
        type: 'transfer_out',
        quantity: 9,
        currentQuantity: 5,
        reason: 'تحويل',
      }),
    ).toThrow(ValidationError);
  });

  test('summarizeLevels counts statuses and total value', () => {
    const levels: InventoryLevel[] = [
      { status: 'in_stock', stockValue: 100 },
      { status: 'low_stock', stockValue: 50 },
      { status: 'out_of_stock', stockValue: 0 },
    ] as InventoryLevel[];
    const summary = summarizeLevels(levels);
    expect(summary).toEqual({ total: 3, inStock: 1, lowStock: 1, outOfStock: 1 });
    expect(totalStockValue(levels)).toBe(150);
  });
});

describe('inventory repository (PHASE 17)', () => {
  test('receiveStock increases product quantity and logs a movement', async () => {
    const { inventoryRepo, productsRepo } = makeInventory();
    // ننشئ منتجًا برصيد 10.
    const product = await productsRepo.createProduct(
      {
        nameAr: 'صنف اختبار', nameEn: 'Test', barcode: '6291000007001', sku: '',
        categoryId: 'cat-beverages', priceAmount: '100', currency: 'YER', taxIncluded: true, stockQuantity: '10',
      },
      actor,
    );

    const before = await productsRepo.findProductByBarcode('6291000007001');
    expect(before?.stockQuantity).toBe(10);

    const mov = await inventoryRepo.receiveStock(
      { productId: product.id, quantity: 5, reason: 'استلام دفعة', storeId: actor.storeId },
      actor,
    );
    expect(mov.type).toBe('receive');
    expect(mov.resultingQuantity).toBe(15);

    const after = await productsRepo.findProductByBarcode('6291000007001');
    expect(after?.stockQuantity).toBe(15);

    const movements = await inventoryRepo.listMovements();
    expect(movements.length).toBe(1);
  });

  test('adjustStock sets exact counted quantity', async () => {
    const { inventoryRepo, productsRepo } = makeInventory();
    const product = await productsRepo.createProduct(
      {
        nameAr: 'صنف جرد', nameEn: 'Count', barcode: '6291000007002', sku: '',
        categoryId: 'cat-beverages', priceAmount: '50', currency: 'YER', taxIncluded: true, stockQuantity: '20',
      },
      actor,
    );
    const mov = await inventoryRepo.adjustStock(
      { productId: product.id, newQuantity: 18, reason: 'جرد شهري', storeId: actor.storeId },
      actor,
    );
    expect(mov.resultingQuantity).toBe(18);
    const after = await productsRepo.findProductByBarcode('6291000007002');
    expect(after?.stockQuantity).toBe(18);
  });

  test('transferStock deducts from source and rejects insufficient stock', async () => {
    const { inventoryRepo, productsRepo } = makeInventory();
    const product = await productsRepo.createProduct(
      {
        nameAr: 'صنف تحويل', nameEn: 'Transfer', barcode: '6291000007003', sku: '',
        categoryId: 'cat-beverages', priceAmount: '80', currency: 'YER', taxIncluded: true, stockQuantity: '4',
      },
      actor,
    );

    // تحويل 3 من رصيد 4 ينجح.
    const mov = await inventoryRepo.transferStock(
      { productId: product.id, quantity: 3, fromStoreId: asId('store-1'), toStoreId: asId('store-2'), reason: 'نقل فرع' },
      actor,
    );
    expect(mov.type).toBe('transfer_out');
    expect(mov.resultingQuantity).toBe(1);

    const after = await productsRepo.findProductByBarcode('6291000007003');
    expect(after?.stockQuantity).toBe(1);

    // تحويل 5 من رصيد 1 يُرفض.
    await expect(
      inventoryRepo.transferStock(
        { productId: product.id, quantity: 5, fromStoreId: asId('store-1'), toStoreId: asId('store-2'), reason: 'نقل' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    // التحويل لنفس المتجر يُرفض.
    await expect(
      inventoryRepo.transferStock(
        { productId: product.id, quantity: 1, fromStoreId: asId('store-1'), toStoreId: asId('store-1'), reason: 'x' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('listLevels builds levels with derived status and value', async () => {
    const { inventoryRepo, productsRepo } = makeInventory();
    const product = await productsRepo.createProduct(
      {
        nameAr: 'صنف مستوى', nameEn: 'Level', barcode: '6291000007004', sku: '',
        categoryId: 'cat-beverages', priceAmount: '200', currency: 'YER', taxIncluded: true, stockQuantity: '3',
      },
      actor,
    );
    await inventoryRepo.receiveStock({ productId: product.id, quantity: 10, reason: 'دفعة', storeId: actor.storeId }, actor);

    const levels = await inventoryRepo.listLevels({ search: 'مستوى' });
    const level = levels.find((l) => String(l.productId) === String(product.id));
    expect(level).toBeDefined();
    expect(level?.quantity).toBe(13);
    expect(level?.status).toBe('in_stock');
    expect(level?.stockValue).toBe(2600); // 13 × 200.

    const summary = await inventoryRepo.summary({});
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.stockValue).toBeGreaterThan(0);
  });
});
