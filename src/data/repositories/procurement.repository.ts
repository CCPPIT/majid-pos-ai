/**
 * مستودع المشتريات (PHASE 18).
 * يدير المورّدين ودورة حياة أوامر الشراء: إنشاء/تقديم/اعتماد/إلغاء/استلام.
 * عند الاستلام يُحدَّث أمر الشراء وتُسجَّل حركة استلام في المخزون لكل صنف —
 * المال والحسابات كلها في المجال، والمستودع ينسّق فقط.
 */
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import { logger } from '@/core/logging/logger';
import {
  createPurchaseOrder as buildPurchaseOrder,
  createSupplierFromDraft,
  recordReceipt,
  transitionPurchaseOrder,
  validateSupplierDraft,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type Supplier,
  type SupplierDraft,
  type DraftOrderLine,
} from '@/domain/procurement';
import type { SuppliersSource, PurchaseOrdersSource } from '../sources/procurement.source';
import type { InventoryRepository } from './inventory.repository';

// سياق المنشئ/المنفّذ (الهرمية + المستخدم).
export interface ProcurementActorContext {
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  userId?: ID; // المنفّذ.
}

// وسائط إنشاء أمر شراء (يُعبّي المستودع التسلسل والهرمية).
export interface CreateOrderRequest {
  supplierId: ID; // المورّد.
  lines: DraftOrderLine[]; // الأسطر (منتج/كمية/تكلفة).
  currency: string; // العملة.
  taxRate: number; // نسبة الضريبة.
  notes?: string; // ملاحظات.
  expectedDate?: string; // تاريخ التوريد المتوقع.
}

// واجهة مستودع المشتريات.
export interface ProcurementRepository {
  listSuppliers(): Promise<Supplier[]>;
  createSupplier(draft: SupplierDraft, ctx: ProcurementActorContext): Promise<Supplier>;
  listPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: ID): Promise<PurchaseOrder | null>;
  createPurchaseOrder(request: CreateOrderRequest, ctx: ProcurementActorContext): Promise<PurchaseOrder>;
  changeStatus(id: ID, to: PurchaseOrderStatus, ctx: ProcurementActorContext): Promise<PurchaseOrder>;
  receiveOrderLine(id: ID, productId: ID, quantity: number, ctx: ProcurementActorContext): Promise<PurchaseOrder>;
}

export class AppProcurementRepository implements ProcurementRepository {
  constructor(
    private readonly suppliersSource: SuppliersSource, // مصدر المورّدين.
    private readonly ordersSource: PurchaseOrdersSource, // مصدر أوامر الشراء.
    private readonly inventory: InventoryRepository, // مستودع المخزون (للاستلام).
  ) {}

  // قائمة المورّدين.
  async listSuppliers(): Promise<Supplier[]> {
    return this.suppliersSource.list();
  }

  // إنشاء مورّد جديد (تحقق في طبقة البيانات أيضًا).
  async createSupplier(draft: SupplierDraft, ctx: ProcurementActorContext): Promise<Supplier> {
    const validation = validateSupplierDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid supplier');
    }
    const sequence = await this.suppliersSource.nextSequence();
    const supplier = createSupplierFromDraft(draft, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      sequence,
    });
    await this.suppliersSource.save(supplier);
    logger.info('Supplier created', { id: String(supplier.id) });
    return supplier;
  }

  // قائمة أوامر الشراء.
  async listPurchaseOrders(): Promise<PurchaseOrder[]> {
    return this.ordersSource.list();
  }

  // جلب أمر بالمعرف.
  async getPurchaseOrder(id: ID): Promise<PurchaseOrder | null> {
    const orders = await this.ordersSource.list();
    return orders.find((o) => String(o.id) === String(id)) ?? null;
  }

  // إنشاء أمر شراء (يلتقط لقطة اسم المورّد).
  async createPurchaseOrder(request: CreateOrderRequest, ctx: ProcurementActorContext): Promise<PurchaseOrder> {
    const suppliers = await this.suppliersSource.list();
    const supplier = suppliers.find((s) => String(s.id) === String(request.supplierId));
    if (!supplier) {
      throw new ValidationError('procurement.error.supplierNotFound');
    }
    const sequence = await this.ordersSource.nextSequence();
    const po = buildPurchaseOrder({
      supplierId: request.supplierId,
      supplierNameAr: supplier.nameAr,
      supplierNameEn: supplier.nameEn,
      lines: request.lines,
      currency: request.currency,
      taxRate: request.taxRate,
      notes: request.notes,
      expectedDate: request.expectedDate,
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      storeId: ctx.storeId,
      createdBy: ctx.userId,
      sequence,
    });
    await this.ordersSource.save(po);
    logger.info('Purchase order created', { po: po.poNumber });
    return po;
  }

  // تغيير حالة أمر (تقديم/اعتماد/إلغاء) مع التحقق من الانتقال في المجال.
  async changeStatus(id: ID, to: PurchaseOrderStatus, ctx: ProcurementActorContext): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if (!po) throw new ValidationError('procurement.error.orderNotFound');
    const updated = transitionPurchaseOrder(po, to, { userId: ctx.userId });
    await this.ordersSource.save(updated);
    logger.info('Purchase order status changed', { po: po.poNumber, to });
    return updated;
  }

  // تسجيل استلام كمية لصنف في أمر معتمد، وتحديث المخزون بالفرق.
  async receiveOrderLine(id: ID, productId: ID, quantity: number, ctx: ProcurementActorContext): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if (!po) throw new ValidationError('procurement.error.orderNotFound');

    // الكمية المُستلَمة قبل التحديث لهذا الصنف (لحساب الفرق).
    const line = po.lines.find((l) => String(l.productId) === String(productId));
    if (!line) throw new ValidationError('procurement.error.lineNotFound');
    const beforeReceived = line.receivedQuantity;

    // يسجّل الاستلام في المجال (يحدّث receivedQuantity والحالة).
    const updated = recordReceipt(po, productId, quantity);
    const updatedLine = updated.lines.find((l) => String(l.productId) === String(productId));
    const delta = (updatedLine?.receivedQuantity ?? beforeReceived) - beforeReceived;

    // يضيف الفعل المُستلَم فعلًا للمخزون كحركة استلام.
    if (delta > 0) {
      await this.inventory.receiveStock(
        {
          productId,
          quantity: delta,
          reason: `PO ${po.poNumber}`,
          reference: po.poNumber,
          storeId: ctx.storeId ?? po.storeId,
          branchId: ctx.branchId ?? po.branchId,
        },
        { tenantId: ctx.tenantId, storeId: ctx.storeId ?? po.storeId, branchId: ctx.branchId ?? po.branchId, userId: ctx.userId },
      );
    }

    await this.ordersSource.save(updated);
    logger.info('Purchase order receipt recorded', { po: po.poNumber, delta });
    return updated;
  }
}
