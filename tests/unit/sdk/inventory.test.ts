/**
 * اختبارات خدمة المخزون — PHASE 31 · أقسام 40 و59.
 * القاعدة الحاكمة المُختبَرة هنا: سجل الحركات **append-only**، وكل تغيّر
 * في الرصيد لا بد أن يخلّف حركة تفسّره — فلا رصيد يتغيّر بلا أثر.
 */
import {
  alertSeverity,
  applyMovement,
  createInventoryService,
  deriveStockLevelStatus,
  movementDirection,
  replayMovements,
} from '@/sdk/inventory';
import { asProductId, asStoreId } from '@/sdk/core';
import { createRbacService } from '@/sdk/rbac';
import { createTenancyService } from '@/sdk/tenancy';
import {
  createInMemoryInventoryRepository,
  createInMemoryRbacRepository,
  createInMemoryTenancyRepository,
  fixedClock,
  makeMovement,
  makeStockLevel,
  ownerRole,
  recordingAudit,
  recordingEvents,
  testContext,
} from '../../helpers/sdk-mocks';

// يبني بيئة خدمة مخزون كاملة.
const setup = (levels = [makeStockLevel()]) => {
  // السياق بصلاحيات كاملة.
  const contextStore = testContext();
  // الأحداث والتدقيق مُسجَّلة.
  const events = recordingEvents();
  const audit = recordingAudit();
  // المستودع مع البذرة.
  const repository = createInMemoryInventoryRepository(levels);
  // الصلاحيات والنطاق.
  const rbac = createRbacService({ repository: createInMemoryRbacRepository([ownerRole()]), contextStore });
  const tenancy = createTenancyService({ repository: createInMemoryTenancyRepository(), contextStore });
  // الخدمة محل الاختبار.
  const service = createInventoryService({
    repository,
    rbac,
    tenancy,
    contextStore,
    events,
    audit,
    clock: fixedClock(),
  });
  return { service, repository, events, audit };
};

describe('SDK Inventory — منطق الحركة النقي', () => {
  // اتجاه كل نوع حركة محسوم لا مُخمَّن.
  it('يحدد اتجاه كل نوع حركة', () => {
    expect(movementDirection('receive')).toBe(1);
    expect(movementDirection('transfer_in')).toBe(1);
    expect(movementDirection('return')).toBe(1);
    expect(movementDirection('sale')).toBe(-1);
    expect(movementDirection('transfer_out')).toBe(-1);
    // التسوية تضبط ولا تضيف.
    expect(movementDirection('adjust')).toBe(0);
  });

  // الاستلام يزيد الرصيد.
  it('يزيد الرصيد بالاستلام', () => {
    expect(applyMovement(100, 'receive', 50)).toBe(150);
  });

  // البيع ينقص الرصيد.
  it('ينقص الرصيد بالبيع', () => {
    expect(applyMovement(100, 'sale', 30)).toBe(70);
  });

  // التسوية تضبط على القيمة المطلقة.
  it('يضبط الرصيد بالتسوية على قيمة مطلقة', () => {
    expect(applyMovement(100, 'adjust', 42)).toBe(42);
  });

  // الرصيد لا يصير سالبًا أبدًا.
  it('يمنع الرصيد السالب', () => {
    expect(applyMovement(10, 'sale', 999)).toBe(0);
    expect(applyMovement(0, 'adjust', -5)).toBe(0);
  });

  // الحالة تُشتق من الرصيد والحد.
  it('يشتق حالة المستوى من الرصيد والحد', () => {
    expect(deriveStockLevelStatus(0, 10)).toBe('out_of_stock');
    expect(deriveStockLevelStatus(10, 10)).toBe('low_stock');
    expect(deriveStockLevelStatus(11, 10)).toBe('in_stock');
  });

  // شدّة التنبيه: النفاد حرج.
  it('يرفع شدّة التنبيه عند النفاد', () => {
    expect(alertSeverity(0)).toBe('critical');
    expect(alertSeverity(3)).toBe('warning');
  });

  // إعادة بناء الرصيد من السجل تطابق الرصيد المخزَّن (تدقيق الجرد).
  it('يعيد بناء الرصيد من سجل الحركات', () => {
    // سجل: استلام 100 ثم بيع 30 ثم مرتجع 5.
    const movements = [
      makeMovement({ type: 'receive', quantity: 100 }),
      makeMovement({ type: 'sale', quantity: 30 }),
      makeMovement({ type: 'return', quantity: 5 }),
    ];
    expect(replayMovements(movements)).toBe(75);
  });

  // الحركات غير المكتملة لا تُحتسب في إعادة البناء.
  it('يتجاهل الحركات غير المكتملة عند إعادة البناء', () => {
    const movements = [
      makeMovement({ type: 'receive', quantity: 100 }),
      // تحويل قيد الطريق لم يصل بعد.
      makeMovement({ type: 'transfer_in', quantity: 50, status: 'in_transit' }),
      // حركة ملغاة.
      makeMovement({ type: 'receive', quantity: 999, status: 'cancelled' }),
    ];
    expect(replayMovements(movements)).toBe(100);
  });
});

describe('SDK Inventory — التسوية والاستلام', () => {
  // التسوية تضبط الرصيد وتخلّف حركة تفسّره.
  it('يضبط الرصيد بتسوية ويسجّل حركتها', async () => {
    const { service, repository } = setup();
    const result = await service.adjust({
      productId: asProductId('p-1'),
      newQuantity: 42,
      reasonKey: 'sdk.inventory.reason.stocktake',
    });
    expect(result.success).toBe(true);
    // الرصيد تغيّر فعلًا.
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(42);
    // وحركة واحدة تفسّره.
    const movements = await repository.listMovements();
    if (movements.success) {
      expect(movements.data.items).toHaveLength(1);
      expect(movements.data.items[0]?.type).toBe('adjust');
    }
  });

  // الحركة تحفظ الرصيد قبلها وبعدها (أثر تدقيق كامل).
  it('يحفظ الرصيد قبل الحركة وبعدها', async () => {
    const { service, repository } = setup();
    await service.adjust({
      productId: asProductId('p-1'),
      newQuantity: 42,
      reasonKey: 'sdk.inventory.reason.stocktake',
    });
    const movements = await repository.listMovements();
    if (!movements.success) return;
    const movement = movements.data.items[0];
    // الرصيد السابق 100 والناتج 42.
    expect(movement?.previousQuantity).toBe(100);
    expect(movement?.resultingQuantity).toBe(42);
  });

  // التسوية بلا سبب مرفوضة (لا تغيير مجهول السبب).
  it('يرفض التسوية بلا سبب', async () => {
    const { service } = setup();
    const result = await service.adjust({ productId: asProductId('p-1'), newQuantity: 5, reasonKey: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  // الكمية السالبة مرفوضة.
  it('يرفض التسوية بكمية سالبة', async () => {
    const { service } = setup();
    const result = await service.adjust({
      productId: asProductId('p-1'),
      newQuantity: -5,
      reasonKey: 'sdk.inventory.reason.stocktake',
    });
    expect(result.success).toBe(false);
  });

  // الاستلام يزيد الرصيد ويسجّل حركة استلام.
  it('يزيد الرصيد بالاستلام', async () => {
    const { service, repository } = setup();
    const result = await service.receive({
      productId: asProductId('p-1'),
      quantity: 50,
      reasonKey: 'sdk.inventory.reason.purchase',
      reference: 'PO-1',
    });
    expect(result.success).toBe(true);
    // الرصيد صار 150.
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(150);
  });

  // الاستلام بكمية صفرية لا معنى له.
  it('يرفض استلام كمية صفرية', async () => {
    const { service } = setup();
    const result = await service.receive({
      productId: asProductId('p-1'),
      quantity: 0,
      reasonKey: 'sdk.inventory.reason.purchase',
    });
    expect(result.success).toBe(false);
  });

  // منتج غير مُتتبَّع يُعيد NotFound.
  it('يرفض العمل على منتج غير مُتتبَّع', async () => {
    const { service } = setup();
    const result = await service.receive({
      productId: asProductId('غائب'),
      quantity: 5,
      reasonKey: 'sdk.inventory.reason.purchase',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('SDK Inventory — خصم البيع', () => {
  // البيع ينقص الرصيد ويسجّل حركة بيع.
  it('ينقص الرصيد عند البيع', async () => {
    const { service, repository } = setup();
    const result = await service.deductForSale({
      productId: asProductId('p-1'),
      quantity: 30,
      reference: 'ORD-0001',
    });
    expect(result.success).toBe(true);
    // الرصيد صار 70.
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(70);
    // والحركة من نوع بيع مرتبطة بالفاتورة.
    const movements = await repository.listMovements();
    if (movements.success) {
      expect(movements.data.items[0]?.type).toBe('sale');
      expect(movements.data.items[0]?.reference).toBe('ORD-0001');
    }
  });

  // البيع فوق الرصيد ممنوع (لا رصيد سالب).
  it('يرفض البيع بما يتجاوز الرصيد', async () => {
    const { service, repository } = setup([makeStockLevel({ quantity: 5 })]);
    const result = await service.deductForSale({
      productId: asProductId('p-1'),
      quantity: 10,
      reference: 'ORD-0002',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
    // والرصيد لم يتغيّر.
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(5);
  });

  // البيع بكامل الرصيد مسموح (الحد الأعلى شامل).
  it('يسمح بالبيع بكامل الرصيد', async () => {
    const { service, repository } = setup([makeStockLevel({ quantity: 5 })]);
    const result = await service.deductForSale({
      productId: asProductId('p-1'),
      quantity: 5,
      reference: 'ORD-0003',
    });
    expect(result.success).toBe(true);
    // والرصيد صار صفرًا بحالة نافد.
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) {
      expect(level.data.quantity).toBe(0);
      expect(level.data.status).toBe('out_of_stock');
    }
  });
});

describe('SDK Inventory — التحويل بين المتاجر', () => {
  // التحويل الصادر ينقص من المصدر ولا يزيد الوجهة فورًا.
  it('يسجّل التحويل الوارد كقيد الطريق بلا ضبط رصيد', async () => {
    const { service, repository } = setup();
    const result = await service.transfer({
      productId: asProductId('p-1'),
      quantity: 20,
      fromStoreId: asStoreId('s-test'),
      toStoreId: asStoreId('s-other'),
      reasonKey: 'sdk.inventory.reason.transfer',
    });
    expect(result.success).toBe(true);
    // حركتان: صادرة مكتملة وواردة قيد الطريق.
    const movements = await repository.listMovements();
    if (!movements.success) return;
    // الصادرة مكتملة.
    const out = movements.data.items.find((movement) => movement.type === 'transfer_out');
    expect(out?.status).toBe('completed');
    // الواردة قيد الطريق (لا تُحتسب حتى يؤكّد المستقبِل).
    const incoming = movements.data.items.find((movement) => movement.type === 'transfer_in');
    expect(incoming?.status).toBe('in_transit');
  });

  // التحويل ينقص رصيد المصدر فورًا.
  it('ينقص رصيد المتجر المصدر فورًا', async () => {
    const { service, repository } = setup();
    await service.transfer({
      productId: asProductId('p-1'),
      quantity: 20,
      fromStoreId: asStoreId('s-test'),
      toStoreId: asStoreId('s-other'),
      reasonKey: 'sdk.inventory.reason.transfer',
    });
    const level = await repository.getLevel(asProductId('p-1'));
    if (level.success) expect(level.data.quantity).toBe(80);
  });

  // التحويل لنفس المتجر بلا معنى.
  it('يرفض التحويل إلى المتجر نفسه', async () => {
    const { service } = setup();
    const result = await service.transfer({
      productId: asProductId('p-1'),
      quantity: 10,
      fromStoreId: asStoreId('s-test'),
      toStoreId: asStoreId('s-test'),
      reasonKey: 'sdk.inventory.reason.transfer',
    });
    expect(result.success).toBe(false);
  });

  // التحويل فوق الرصيد ممنوع.
  it('يرفض تحويل كمية تتجاوز الرصيد', async () => {
    const { service } = setup([makeStockLevel({ quantity: 5 })]);
    const result = await service.transfer({
      productId: asProductId('p-1'),
      quantity: 50,
      fromStoreId: asStoreId('s-test'),
      toStoreId: asStoreId('s-other'),
      reasonKey: 'sdk.inventory.reason.transfer',
    });
    expect(result.success).toBe(false);
  });
});

describe('SDK Inventory — الملخص والتنبيهات', () => {
  // الملخص يُحسب من المستويات الفعلية.
  it('يحسب ملخص المخزون من المستويات', async () => {
    const { service } = setup([
      makeStockLevel({ productId: asProductId('p-1'), quantity: 100 }),
      makeStockLevel({ productId: asProductId('p-2'), quantity: 3, lowStockThreshold: 10 }),
      makeStockLevel({ productId: asProductId('p-3'), quantity: 0 }),
    ]);
    const result = await service.getSummary();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalProducts).toBe(3);
    expect(result.data.totalQuantity).toBe(103);
    // صنف منخفض وصنف نافد.
    expect(result.data.lowStockCount).toBe(1);
    expect(result.data.outOfStockCount).toBe(1);
  });

  // التنبيهات تشمل المنخفض والنافد فقط.
  it('ينبّه على الأصناف المنخفضة والنافدة فقط', async () => {
    const { service } = setup([
      makeStockLevel({ productId: asProductId('p-1'), quantity: 100 }),
      makeStockLevel({ productId: asProductId('p-2'), quantity: 3 }),
      makeStockLevel({ productId: asProductId('p-3'), quantity: 0 }),
    ]);
    const result = await service.getLowStockAlerts();
    expect(result.success).toBe(true);
    if (!result.success) return;
    // تنبيهان فقط.
    expect(result.data).toHaveLength(2);
    // النافد حرج.
    expect(result.data.find((alert) => alert.quantity === 0)?.severity).toBe('critical');
  });
});

describe('SDK Inventory — أثر السجل', () => {
  // كل حركة تنشر حدثًا وتُسجَّل في التدقيق.
  it('ينشر حدثًا ويسجّل تدقيقًا لكل حركة', async () => {
    const { service, events, audit } = setup();
    await service.receive({
      productId: asProductId('p-1'),
      quantity: 10,
      reasonKey: 'sdk.inventory.reason.purchase',
    });
    expect(events.events.length).toBeGreaterThan(0);
    expect(audit.entries.length).toBeGreaterThan(0);
  });

  // السجل تراكمي: كل عملية تضيف ولا تستبدل.
  it('يراكم الحركات ولا يستبدلها', async () => {
    const { service, repository } = setup();
    // ثلاث عمليات متتابعة.
    await service.receive({
      productId: asProductId('p-1'),
      quantity: 10,
      reasonKey: 'sdk.inventory.reason.purchase',
    });
    await service.deductForSale({ productId: asProductId('p-1'), quantity: 5, reference: 'ORD-1' });
    await service.adjust({
      productId: asProductId('p-1'),
      newQuantity: 200,
      reasonKey: 'sdk.inventory.reason.stocktake',
    });
    // ثلاث حركات محفوظة كلها.
    const movements = await repository.listMovements();
    if (movements.success) expect(movements.data.items).toHaveLength(3);
  });
});
