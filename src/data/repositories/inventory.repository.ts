/**
 * مستودع المخزون (PHASE 17).
 * يبني مستويات المخزون من كتالوج المنتجات + سجل الحركات، وينفّذ
 * التسوية/الاستلام/التحويل كحركات موثّقة تُحدِّث رصيد المنتج بالمقابل.
 * القاعدة: سجل الحركات هو المرجع، وكمية المنتج تُحدَّث من الحركة.
 */
import { roundMoney } from '@/core/money/money';
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import { logger } from '@/core/logging/logger';
import {
  buildMovement,
  applyMovement,
  canDeduct,
  summarizeLevels,
  totalStockValue,
} from '@/domain/inventory/movements';
import type {
  AdjustStockInput,
  InventoryLevel,
  InventoryMovement,
  InventoryQuery,
  ReceiveStockInput,
  TransferStockInput,
} from '@/domain/inventory/types';
import type { ProductsRepository } from './products.repository';
import type { InventoryMovementsSource } from '../sources/inventory.source';

// واجهة مستودع المخزون.
export interface InventoryRepository {
  listLevels(query?: InventoryQuery): Promise<InventoryLevel[]>;
  summary(query?: InventoryQuery): Promise<ReturnType<typeof summarizeLevels> & { stockValue: number }>;
  listMovements(limit?: number): Promise<InventoryMovement[]>;
  adjustStock(input: AdjustStockInput, ctx: ActorContext): Promise<InventoryMovement>;
  receiveStock(input: ReceiveStockInput, ctx: ActorContext): Promise<InventoryMovement>;
  transferStock(input: TransferStockInput, ctx: ActorContext): Promise<InventoryMovement>;
}

// سياق المنفّذ (الهرمية النشطة + المستخدم).
export interface ActorContext {
  tenantId: ID; // المستأجر.
  storeId?: ID; // المتجر النشط.
  branchId?: ID; // الفرع النشط.
  userId?: ID; // معرف المنفّذ.
}

export class AppInventoryRepository implements InventoryRepository {
  constructor(
    private readonly movements: InventoryMovementsSource, // مصدر الحركات.
    private readonly products: ProductsRepository, // مستودع المنتجات (للأسماء/الرصيد/التحديث).
  ) {}

  // يبني مستوى مخزون لكل منتج، يُثريه بآخر حركة.
  async listLevels(query: InventoryQuery = {}): Promise<InventoryLevel[]> {
    const [catalog, movements] = await Promise.all([
      this.products.searchProducts({ search: query.search, storeId: query.storeId, branchId: query.branchId }),
      this.movements.list(),
    ]);

    // آخر حركة لكل منتج.
    const lastByProduct = new Map<string, InventoryMovement>();
    for (const mov of movements) {
      const key = String(mov.productId);
      if (!lastByProduct.has(key)) lastByProduct.set(key, mov);
    }

    const levels: InventoryLevel[] = catalog.products.map((product) => {
      const last = lastByProduct.get(String(product.id));
      const quantity = product.stockQuantity;
      const unitValue = roundMoney(product.price.amount);
      return {
        productId: product.id,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        barcode: product.barcode,
        sku: product.sku,
        quantity,
        status: product.stockStatus, // الحالة محفوظة مع المنتج ومُشتقة من الكمية.
        unitValue,
        currency: product.price.currency,
        stockValue: roundMoney(unitValue * quantity),
        lastMovementAt: last?.occurredAt,
        categoryId: product.categoryId,
      };
    });

    // فلترة بالحالة إن طُلبت.
    const filtered = query.status ? levels.filter((level) => level.status === query.status) : levels;
    const limited = query.limit ? filtered.slice(0, query.limit) : filtered;
    return limited;
  }

  // ملخص أعلى الشاشة (أعداد + قيمة تقديرية).
  async summary(query: InventoryQuery = {}) {
    const levels = await this.listLevels(query);
    return { ...summarizeLevels(levels), stockValue: totalStockValue(levels) };
  }

  // قائمة الحركات (الأحدث أولًا).
  async listMovements(limit = 50): Promise<InventoryMovement[]> {
    const movements = await this.movements.list();
    return limit ? movements.slice(0, limit) : movements;
  }

  // يجلب المنتج الحالي من الكتالوج بالمعرف (مشترك بين العمليات).
  private async requireProduct(productId: ID) {
    const catalog = await this.products.searchProducts({});
    const product = catalog.products.find((p) => String(p.id) === String(productId));
    if (!product) {
      throw new ValidationError('inventory.error.productNotFound');
    }
    return product;
  }

  // تسوية رصيد (تعيين الكمية الفعلية بعد الجرد).
  async adjustStock(input: AdjustStockInput, ctx: ActorContext): Promise<InventoryMovement> {
    const current = await this.requireProduct(input.productId);

    const sequence = await this.movements.nextSequence();
    const movement = buildMovement({
      tenantId: ctx.tenantId,
      productId: input.productId,
      type: 'adjust',
      quantity: Math.max(0, Math.trunc(input.newQuantity)),
      currentQuantity: current.stockQuantity,
      reason: input.reason,
      reference: input.reference,
      storeId: input.storeId ?? ctx.storeId,
      branchId: input.branchId ?? ctx.branchId,
      createdBy: ctx.userId,
      sequence,
    });

    await this.movements.append(movement);
    await this.products.setProductStock(input.productId, movement.resultingQuantity);
    logger.info('Inventory adjusted', { product: String(input.productId), quantity: movement.resultingQuantity });
    return movement;
  }

  // استلام بضاعة (زيادة الرصيد).
  async receiveStock(input: ReceiveStockInput, ctx: ActorContext): Promise<InventoryMovement> {
    const current = await this.requireProduct(input.productId);

    const sequence = await this.movements.nextSequence();
    const movement = buildMovement({
      tenantId: ctx.tenantId,
      productId: input.productId,
      type: 'receive',
      quantity: input.quantity,
      currentQuantity: current.stockQuantity,
      reason: input.reason,
      reference: input.reference,
      storeId: input.storeId ?? ctx.storeId,
      branchId: input.branchId ?? ctx.branchId,
      createdBy: ctx.userId,
      sequence,
    });

    await this.movements.append(movement);
    await this.products.setProductStock(input.productId, movement.resultingQuantity);
    logger.info('Inventory received', { product: String(input.productId), quantity: movement.quantity });
    return movement;
  }

  // تحويل بين متجرين: خصم من المصدر الآن (الوارد يُطبَّق عند المزامنة لاحقًا).
  async transferStock(input: TransferStockInput, ctx: ActorContext): Promise<InventoryMovement> {
    if (String(input.fromStoreId) === String(input.toStoreId)) {
      throw new ValidationError('inventory.error.sameStore');
    }
    const current = await this.requireProduct(input.productId);
    if (!canDeduct(current.stockQuantity, input.quantity)) {
      throw new ValidationError('inventory.error.insufficientStock');
    }

    const sequence = await this.movements.nextSequence();
    // حركة صادرة من المصدر (تكتمل فورًا وتنقص رصيده).
    const outgoing = buildMovement({
      tenantId: ctx.tenantId,
      productId: input.productId,
      type: 'transfer_out',
      quantity: input.quantity,
      currentQuantity: current.stockQuantity,
      reason: input.reason,
      storeId: input.storeId ?? input.fromStoreId,
      branchId: input.branchId ?? ctx.branchId,
      fromStoreId: input.fromStoreId,
      toStoreId: input.toStoreId,
      status: 'completed',
      createdBy: ctx.userId,
      sequence,
    });

    await this.movements.append(outgoing);
    await this.products.setProductStock(input.productId, outgoing.resultingQuantity);
    logger.info('Inventory transferred out', {
      product: String(input.productId),
      to: String(input.toStoreId),
      quantity: input.quantity,
    });
    // ملاحظة: الوارد (transfer_in) لوجهة التحويل يُطبَّق لاحقًا مع المزامنة (PHASE 23).
    return outgoing;
  }
}

// يُستخدم applyMovement لإعادة حساب الرصيد عند إعادة عرض السجل لاحقًا (مُصدَّر للاختبارات).
export { applyMovement };
