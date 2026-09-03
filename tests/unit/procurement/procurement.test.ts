/**
 * اختبارات مجال ومستودع المشتريات (PHASE 18).
 * تغطي: تحقق المورّد، حساب إجماليات أمر الشراء (subtotal/tax/total)،
 * انتقالات الحالة المسموحة والممنوعة، تسجيل الاستلام، والمستودع:
 * إنشاء مورّد/أمر، تغيير الحالة، والاستلام الذي يحدّث المخزون فعلًا.
 */
import {
  formatPurchaseOrderNumber,
  validateSupplierDraft,
  calculateTotals,
  createPurchaseOrder,
  canTransition,
  transitionPurchaseOrder,
  isReceivable,
  isFullyReceived,
  recordReceipt,
  totalOrderedQuantity,
  totalReceivedQuantity,
  type SupplierDraft,
  type CreatePurchaseOrderInput,
  type DraftOrderLine,
} from '@/domain/procurement';
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';
import { money } from '@/core/money/money';
import { LocalSuppliersSource, LocalPurchaseOrdersSource } from '@/data/sources/procurement.source';
import { AppProcurementRepository } from '@/data/repositories/procurement.repository';
import { LocalInventoryMovementsSource } from '@/data/sources/inventory.source';
import { AppInventoryRepository } from '@/data/repositories/inventory.repository';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { AppProductsRepository } from '@/data/repositories/products.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';

// سياق منفّذ للاختبارات.
const actor = { tenantId: asId('tenant-t'), storeId: asId('store-1'), branchId: asId('branch-b') };

// نموذج مورّد صالح.
const validSupplier: SupplierDraft = {
  nameAr: 'مورّد تجريبي',
  nameEn: 'Demo Supplier',
  contactName: 'أحمد',
  phone: '777123456',
  email: 's@example.com',
  address: 'صنعاء',
  taxNumber: '30001',
  currency: 'YER',
};

// أسطر خام لأمر شراء.
function makeLines(): DraftOrderLine[] {
  return [
    { productId: asId('p1'), nameAr: 'صنف أ', nameEn: 'Item A', quantity: 10, unitCostAmount: 100 },
    { productId: asId('p2'), nameAr: 'صنف ب', nameEn: 'Item B', quantity: 5, unitCostAmount: 200 },
  ];
}

describe('procurement supplier validation (PHASE 18)', () => {
  test('accepts a valid supplier', () => {
    expect(validateSupplierDraft(validSupplier).valid).toBe(true);
  });

  test('rejects missing name', () => {
    expect(validateSupplierDraft({ ...validSupplier, nameAr: '   ' }).valid).toBe(false);
  });

  test('rejects bad phone and email formats', () => {
    expect(validateSupplierDraft({ ...validSupplier, phone: 'abc' }).errorKey).toBe('procurement.error.phoneInvalid');
    expect(validateSupplierDraft({ ...validSupplier, email: 'not-an-email' }).errorKey).toBe('procurement.error.emailInvalid');
  });
});

describe('purchase order totals (PHASE 18)', () => {
  test('formats PO number with padding', () => {
    expect(formatPurchaseOrderNumber(7)).toBe('PO-0007');
  });

  test('computes subtotal, tax and total with real money', () => {
    // المجموع = 10*100 + 5*200 = 2000، ضريبة 10% = 200، الإجمالي 2200.
    const totals = calculateTotals(makeLines(), 'YER', 10);
    expect(totals.subtotal).toEqual(money(2000, 'YER'));
    expect(totals.tax).toEqual(money(200, 'YER'));
    expect(totals.total).toEqual(money(2200, 'YER'));
  });

  test('rejects empty lines and invalid tax', () => {
    expect(() => calculateTotals([], 'YER', 0)).toThrow(ValidationError);
    expect(() => calculateTotals(makeLines(), 'YER', 150)).toThrow(ValidationError);
  });

  test('builds a draft PO with zero received quantities', () => {
    const input: CreatePurchaseOrderInput = {
      supplierId: asId('sup-1'),
      supplierNameAr: 'مورّد',
      supplierNameEn: 'Supplier',
      lines: makeLines(),
      currency: 'YER',
      taxRate: 0,
      tenantId: actor.tenantId,
      sequence: 1,
    };
    const po = createPurchaseOrder(input);
    expect(po.status).toBe('draft');
    expect(po.poNumber).toBe('PO-0001');
    expect(po.lines[0]?.receivedQuantity).toBe(0);
    expect(totalOrderedQuantity(po)).toBe(15);
    expect(totalReceivedQuantity(po)).toBe(0);
  });
});

describe('purchase order lifecycle (PHASE 18)', () => {
  function draftPo() {
    return createPurchaseOrder({
      supplierId: asId('sup-1'),
      supplierNameAr: 'مورّد',
      supplierNameEn: 'Supplier',
      lines: makeLines(),
      currency: 'YER',
      taxRate: 0,
      tenantId: actor.tenantId,
      sequence: 1,
    });
  }

  test('allowed and forbidden transitions', () => {
    expect(canTransition('draft', 'submitted').allowed).toBe(true);
    expect(canTransition('draft', 'approved').allowed).toBe(false); // لا تعتمد مسودة مباشرة.
    expect(canTransition('received', 'approved').allowed).toBe(false); // المكتمل لا يتحول.
  });

  test('full lifecycle draft → submitted → approved', () => {
    let po = draftPo();
    po = transitionPurchaseOrder(po, 'submitted');
    expect(po.status).toBe('submitted');
    expect(po.submittedAt).toBeDefined();
    po = transitionPurchaseOrder(po, 'approved', { userId: asId('u1') });
    expect(po.status).toBe('approved');
    expect(po.approvedBy).toEqual(asId('u1'));
    expect(isReceivable(po)).toBe(true);
  });

  test('illegal transition throws', () => {
    const po = draftPo();
    expect(() => transitionPurchaseOrder(po, 'received')).toThrow(ValidationError);
  });

  test('receipt accumulates and completes the order', () => {
    let po = transitionPurchaseOrder(transitionPurchaseOrder(draftPo(), 'submitted'), 'approved');
    // استلام 8 من أصل 10 للصنف الأول → جزئي.
    po = recordReceipt(po, asId('p1'), 8);
    expect(po.status).toBe('partially_received');
    expect(isFullyReceived(po)).toBe(false);
    // استلام المتبقي (2 للأول + 5 للثاني) يُكمل الأمر.
    po = recordReceipt(po, asId('p1'), 2);
    po = recordReceipt(po, asId('p2'), 5);
    expect(po.status).toBe('received');
    expect(isFullyReceived(po)).toBe(true);
    expect(totalReceivedQuantity(po)).toBe(15);
  });

  test('receipt cannot exceed ordered quantity', () => {
    let po = transitionPurchaseOrder(transitionPurchaseOrder(draftPo(), 'submitted'), 'approved');
    po = recordReceipt(po, asId('p1'), 50); // أكثر من المطلوب (10) يُقيَّد.
    expect(po.lines[0]?.receivedQuantity).toBe(10);
  });

  test('receiving a non-approved order throws', () => {
    const po = draftPo();
    expect(() => recordReceipt(po, asId('p1'), 1)).toThrow(ValidationError);
  });
});

// يبني مستودع مشتريات كاملًا فوق تخزين ذاكرة (مع مخزون حقيقي).
function makeProcurement() {
  const prefs = new InMemoryPreferencesSource();
  const store = { getString: (k: string) => prefs.getString(k), setString: (k: string, v: string) => prefs.setString(k, v) };
  const productsRepo = new AppProductsRepository(new LocalCatalogSource(store));
  const inventoryRepo = new AppInventoryRepository(new LocalInventoryMovementsSource(store), productsRepo);
  const procurementRepo = new AppProcurementRepository(
    new LocalSuppliersSource(store),
    new LocalPurchaseOrdersSource(store),
    inventoryRepo,
  );
  return { procurementRepo, productsRepo, inventoryRepo };
}

describe('procurement repository (PHASE 18)', () => {
  test('creates a supplier and a PO, then runs lifecycle with stock update', async () => {
    const { procurementRepo, productsRepo, inventoryRepo } = makeProcurement();

    // منتج برصيد 0 في الكتالوج.
    const product = await productsRepo.createProduct(
      {
        nameAr: 'صنف مشتريات', nameEn: 'Proc item', barcode: '6291000008001', sku: '',
        categoryId: 'cat-beverages', priceAmount: '100', currency: 'YER', taxIncluded: true, stockQuantity: '0',
      },
      actor,
    );

    // مورّد.
    const supplier = await procurementRepo.createSupplier(validSupplier, actor);
    const suppliers = await procurementRepo.listSuppliers();
    expect(suppliers.some((s) => s.id === supplier.id)).toBe(true);

    // أمر شراء بكمية 7 للمنتج.
    const po = await procurementRepo.createPurchaseOrder(
      {
        supplierId: supplier.id,
        lines: [{ productId: product.id, nameAr: product.nameAr, nameEn: product.nameEn, sku: product.sku, barcode: product.barcode, quantity: 7, unitCostAmount: 80 }],
        currency: 'YER',
        taxRate: 0,
      },
      actor,
    );
    expect(po.total).toEqual(money(560, 'YER'));

    // تقديم ثم اعتماد.
    await procurementRepo.changeStatus(po.id, 'submitted', actor);
    const approved = await procurementRepo.changeStatus(po.id, 'approved', actor);
    expect(approved.status).toBe('approved');

    // استلام 7 → يُكمل الأمر ويحدّث المخزون إلى 7.
    const received = await procurementRepo.receiveOrderLine(po.id, product.id, 7, actor);
    expect(received.status).toBe('received');

    const updatedProduct = await productsRepo.findProductByBarcode('6291000008001');
    expect(updatedProduct?.stockQuantity).toBe(7);

    // سجل الحركات يحتوي حركة استلام مرتبطة برقم الأمر.
    const movements = await inventoryRepo.listMovements();
    expect(movements.some((m) => m.reference === po.poNumber && m.type === 'receive')).toBe(true);
  });

  test('creating a PO for a missing supplier throws', async () => {
    const { procurementRepo } = makeProcurement();
    await expect(
      procurementRepo.createPurchaseOrder(
        {
          supplierId: asId('does-not-exist'),
          lines: [{ productId: asId('p1'), nameAr: 'x', nameEn: 'x', quantity: 1, unitCostAmount: 10 }],
          currency: 'YER',
          taxRate: 0,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('invalid supplier draft rejected at repository', async () => {
    const { procurementRepo } = makeProcurement();
    await expect(
      procurementRepo.createSupplier({ ...validSupplier, nameAr: '' }, actor),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
