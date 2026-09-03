/**
 * خدمة المخزون — PHASE 31 · أقسام 20 و68.
 * كل تغيّر رصيد يمرّ بمسارين متتاليين: تسجيل حركة في السجل ثم ضبط الرصيد.
 * الحركة تُسجَّل أولًا حتى لا يوجد رصيد متغيّر بلا أثر مراجعة.
 */
import {
  BusinessRuleError,
  ContextError,
  createAuditEvent,
  createDomainEvent,
  failure,
  success,
  systemClock,
  SDK_DOMAIN_EVENTS,
  type AsyncResult,
  type AuditLogger,
  type Clock,
  type EventPublisher,
  type PaginatedResult,
  type ProductId,
  type Result,
  type SDKContext,
  type SDKContextStore,
  type StockMovementId,
  type TenantId,
  validateWith,
} from '@/sdk/core';
import type { RbacService } from '@/sdk/rbac';
import type { TenancyService } from '@/sdk/tenancy';
import {
  applyMovement,
  type InventorySummary,
  type LowStockAlert,
  type StockLevel,
  type StockMovement,
  type StockMovementType,
} from '../contracts/inventory-contracts';
import type { InventoryRepository } from '../contracts/inventory-repository';
import {
  adjustStockSchema,
  receiveStockSchema,
  transferStockSchema,
  type AdjustStockCommand,
  type DeductStockCommand,
  type MovementListQuery,
  type ReceiveStockCommand,
  type TransferStockCommand,
} from '../contracts/inventory-commands';

// الواجهة العلنية لخدمة المخزون (sdk.inventory).
export interface InventoryService {
  // يسرد مستويات المخزون.
  listLevels(query?: MovementListQuery): AsyncResult<PaginatedResult<StockLevel>>;
  // يقرأ مستوى منتج.
  getLevel(productId: ProductId): AsyncResult<StockLevel>;
  // يسوّي رصيدًا بعد الجرد.
  adjust(command: AdjustStockCommand): AsyncResult<StockMovement>;
  // يستلم بضاعة.
  receive(command: ReceiveStockCommand): AsyncResult<StockMovement>;
  // يحوّل بين متجرين.
  transfer(command: TransferStockCommand): AsyncResult<readonly StockMovement[]>;
  // يخصم مخزون بيع (يُستدعى من تدفّق البيع لا من الواجهة).
  deductForSale(command: DeductStockCommand): AsyncResult<StockMovement>;
  // يسرد الحركات.
  listMovements(query?: MovementListQuery): AsyncResult<PaginatedResult<StockMovement>>;
  // ملخص المخزون.
  getSummary(): AsyncResult<InventorySummary>;
  // تنبيهات النقص.
  getLowStockAlerts(): AsyncResult<readonly LowStockAlert[]>;
}

// تبعيات الخدمة.
export interface InventoryServiceDependencies {
  readonly repository: InventoryRepository; // مستودع المخزون.
  readonly rbac: RbacService; // الصلاحيات.
  readonly tenancy: TenancyService; // النطاق.
  readonly contextStore: SDKContextStore; // السياق.
  readonly events: EventPublisher; // الأحداث.
  readonly audit: AuditLogger; // التدقيق.
  readonly clock?: Clock; // الساعة.
}

// عدّاد داخلي لمعرّفات الحركات.
let movementSequence = 0;

// ينشئ خدمة المخزون بالحقن.
export const createInventoryService = (deps: InventoryServiceDependencies): InventoryService => {
  // الساعة المستخدمة.
  const clock = deps.clock ?? systemClock;

  // بيانات التدقيق المشتركة.
  const auditBase = () => {
    // السياق الحالي.
    const context = deps.contextStore.get();
    // الحقول المشتركة.
    return {
      actor: context.userId ?? ('system' as const),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      branchId: context.branchId,
      storeId: context.storeId,
    };
  };

  // حراسة موحّدة تُعيد السياق المتحقَّق منه (لا مجرد نعم/لا).
  const guard = async (resource: string, action: string): Promise<Result<SDKContext>> => {
    // عمليات المخزون مرتبطة بمتجر.
    const contextResult = deps.tenancy.requireStore();
    if (!contextResult.success) return contextResult;
    // فحص الصلاحية.
    const decision = await deps.rbac.can({ resource, action });
    // الرفض يُسجَّل.
    if (!decision.success) {
      deps.audit.record(
        createAuditEvent({ ...auditBase(), action: `${resource}.${action}`, resource, result: 'denied' }),
      );
      return decision;
    }
    // مسموح — نُعيد السياق ليُستخدم في بناء الحركة.
    return success(contextResult.data);
  };

  // يضيّق المستأجر من السياق إلى قيمة مؤكّدة (لا تحويل قسري بـ as).
  const tenantOf = (context: SDKContext): Result<TenantId> =>
    // غياب المستأجر خطأ سياق صريح رغم أن الحراسة تسبقه.
    context.tenantId === undefined ? failure(new ContextError(['tenantId'])) : success(context.tenantId);

  // يبني حركة مخزون كاملة البيانات (دالة مساعدة موحّدة).
  const buildMovement = (input: {
    readonly tenantId: TenantId;
    readonly productId: ProductId;
    readonly type: StockMovementType;
    readonly quantity: number;
    readonly previousQuantity: number;
    readonly resultingQuantity: number;
    readonly reasonKey: string;
    readonly reference?: string;
    readonly fromStoreId?: StockMovement['fromStoreId'];
    readonly toStoreId?: StockMovement['toStoreId'];
    readonly status?: StockMovement['status'];
  }): StockMovement => {
    // السياق للنطاق والمنفّذ.
    const context = deps.contextStore.get();
    // لحظة الحركة.
    const now = clock.now();
    // الحركة المبنية.
    return {
      // معرّف فريد متسلسل.
      id: `mov-${(movementSequence += 1)}-${clock.timestamp().toString(36)}` as StockMovementId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      previousQuantity: input.previousQuantity,
      resultingQuantity: input.resultingQuantity,
      reasonKey: input.reasonKey,
      reference: input.reference,
      fromStoreId: input.fromStoreId,
      toStoreId: input.toStoreId,
      status: input.status ?? 'completed',
      performedBy: context.userId,
      occurredAt: now,
      tenantId: input.tenantId,
      storeId: context.storeId,
      createdAt: now,
      updatedAt: now,
    };
  };

  // ينفّذ حركة كاملة: تسجيلها ثم ضبط الرصيد ثم الحدث والتدقيق.
  const commitMovement = async (
    movement: StockMovement,
    eventName: string,
    auditAction: string,
  ): AsyncResult<StockMovement> => {
    // (1) نسجّل الحركة أولًا (أثر المراجعة قبل تغيّر الرصيد).
    const recorded = await deps.repository.recordMovement(movement);
    if (!recorded.success) return recorded;
    // (2) نضبط الرصيد على النتيجة المحسوبة.
    const applied = await deps.repository.setQuantity(movement.productId, movement.resultingQuantity);
    if (!applied.success) return applied;
    // (3) حدث المجال.
    const context = deps.contextStore.get();
    deps.events.publish(
      createDomainEvent(
        eventName,
        {
          movementId: String(recorded.data.id),
          productId: String(movement.productId),
          type: movement.type,
          quantity: movement.quantity,
          resultingQuantity: movement.resultingQuantity,
        },
        { tenantId: context.tenantId, storeId: context.storeId, actorId: context.userId },
      ),
    );
    // (4) أثر التدقيق (تغيّر المخزون عملية حسّاسة).
    deps.audit.record(
      createAuditEvent({
        ...auditBase(),
        action: auditAction,
        resource: 'inventory',
        resourceId: String(movement.productId),
        metadata: {
          type: movement.type,
          quantity: movement.quantity,
          previous: movement.previousQuantity,
          resulting: movement.resultingQuantity,
          reason: movement.reasonKey,
        },
      }),
    );
    // الحركة المسجّلة.
    return recorded;
  };

  return {
    // ── سرد المستويات ──
    listLevels: async (query) => {
      // حراسة القراءة.
      const allowed = await guard('inventory', 'read');
      if (!allowed.success) return allowed;
      // تضييق النطاق.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // التنفيذ.
      return deps.repository.listLevels({ ...query, scope: query?.scope ?? scope });
    },

    // ── مستوى منتج ──
    getLevel: async (productId) => {
      // حراسة القراءة.
      const allowed = await guard('inventory', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.getLevel(productId);
    },

    // ── تسوية جرد ──
    adjust: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(adjustStockSchema, command);
      if (!validated.success) return validated;
      // (2) حراسة التسوية (إذن منفصل أكثر حساسية من القراءة).
      const allowed = await guard('inventory', 'adjust');
      if (!allowed.success) return allowed;
      // (3) المستأجر المؤكّد من السياق المحروس.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (4) نقرأ الرصيد الحالي (أساس الحركة).
      const level = await deps.repository.getLevel(command.productId);
      if (!level.success) return level;
      // (5) نبني حركة التسوية (النتيجة قيمة مطلقة).
      const movement = buildMovement({
        tenantId: tenant.data,
        productId: command.productId,
        type: 'adjust',
        quantity: command.newQuantity,
        previousQuantity: level.data.quantity,
        resultingQuantity: applyMovement(level.data.quantity, 'adjust', command.newQuantity),
        reasonKey: command.reasonKey,
        reference: command.reference,
      });
      // (5) التنفيذ الكامل.
      return commitMovement(movement, SDK_DOMAIN_EVENTS.INVENTORY_ADJUSTED, 'inventory.adjust');
    },

    // ── استلام بضاعة ──
    receive: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(receiveStockSchema, command);
      if (!validated.success) return validated;
      // (2) حراسة الاستلام.
      const allowed = await guard('inventory', 'receive');
      if (!allowed.success) return allowed;
      // (3) المستأجر المؤكّد.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (4) الرصيد الحالي.
      const level = await deps.repository.getLevel(command.productId);
      if (!level.success) return level;
      // (5) حركة الاستلام (زيادة).
      const movement = buildMovement({
        tenantId: tenant.data,
        productId: command.productId,
        type: 'receive',
        quantity: command.quantity,
        previousQuantity: level.data.quantity,
        resultingQuantity: applyMovement(level.data.quantity, 'receive', command.quantity),
        reasonKey: command.reasonKey,
        reference: command.reference,
      });
      // (5) التنفيذ.
      return commitMovement(movement, SDK_DOMAIN_EVENTS.INVENTORY_RECEIVED, 'inventory.receive');
    },

    // ── تحويل بين متجرين ──
    transfer: async (command) => {
      // (1) تحقّق المدخلات (يشمل منع التحويل لنفس المتجر).
      const validated = validateWith(transferStockSchema, command);
      if (!validated.success) return validated;
      // (2) حراسة التحويل.
      const allowed = await guard('inventory', 'transfer');
      if (!allowed.success) return allowed;
      // (2ب) المستأجر المؤكّد.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (3) الرصيد الحالي في المصدر.
      const level = await deps.repository.getLevel(command.productId);
      if (!level.success) return level;
      // (4) قاعدة عمل: لا تحويل بما يتجاوز المتاح.
      if (command.quantity > level.data.quantity) {
        return failure(
          new BusinessRuleError('sdk.inventory.error.insufficientStock', {
            details: { requested: command.quantity, available: level.data.quantity },
          }),
        );
      }
      // (5) حركة الصادر من المصدر.
      const outMovement = buildMovement({
        tenantId: tenant.data,
        productId: command.productId,
        type: 'transfer_out',
        quantity: command.quantity,
        previousQuantity: level.data.quantity,
        resultingQuantity: applyMovement(level.data.quantity, 'transfer_out', command.quantity),
        reasonKey: command.reasonKey,
        reference: command.reference,
        fromStoreId: command.fromStoreId,
        toStoreId: command.toStoreId,
      });
      // (6) ننفّذ الصادر.
      const outResult = await commitMovement(
        outMovement,
        SDK_DOMAIN_EVENTS.INVENTORY_TRANSFERRED,
        'inventory.transfer',
      );
      if (!outResult.success) return outResult;
      // (7) حركة الوارد للوجهة تُسجَّل "قيد الطريق" حتى يؤكّدها المتجر المستقبِل.
      // (الرصيد لا يزيد في الوجهة إلا بعد التأكيد — يمنع ازدواج المخزون.)
      const inMovement = buildMovement({
        tenantId: tenant.data,
        productId: command.productId,
        type: 'transfer_in',
        quantity: command.quantity,
        previousQuantity: 0,
        resultingQuantity: 0,
        reasonKey: command.reasonKey,
        reference: command.reference,
        fromStoreId: command.fromStoreId,
        toStoreId: command.toStoreId,
        status: 'in_transit',
      });
      // نسجّل الوارد بلا ضبط رصيد (حالته قيد الطريق).
      const inResult = await deps.repository.recordMovement(inMovement);
      if (!inResult.success) return inResult;
      // (8) الحركتان معًا.
      return success([outResult.data, inResult.data]);
    },

    // ── خصم بيع ──
    deductForSale: async (command) => {
      // (1) حراسة: الخصم جزء من عملية البيع لا من إدارة المخزون.
      const allowed = await guard('pos', 'sale.create');
      if (!allowed.success) return allowed;
      // (1ب) المستأجر المؤكّد.
      const tenant = tenantOf(allowed.data);
      if (!tenant.success) return tenant;
      // (2) الرصيد الحالي.
      const level = await deps.repository.getLevel(command.productId);
      if (!level.success) return level;
      // (3) قاعدة عمل: لا بيع بما يتجاوز الرصيد.
      if (command.quantity > level.data.quantity) {
        return failure(
          new BusinessRuleError('sdk.inventory.error.insufficientStock', {
            details: { requested: command.quantity, available: level.data.quantity },
          }),
        );
      }
      // (4) حركة البيع (نقص).
      const movement = buildMovement({
        tenantId: tenant.data,
        productId: command.productId,
        type: 'sale',
        quantity: command.quantity,
        previousQuantity: level.data.quantity,
        resultingQuantity: applyMovement(level.data.quantity, 'sale', command.quantity),
        reasonKey: 'sdk.inventory.reason.sale',
        reference: command.reference,
      });
      // (5) التنفيذ.
      return commitMovement(movement, SDK_DOMAIN_EVENTS.INVENTORY_ADJUSTED, 'inventory.sale');
    },

    // ── سرد الحركات ──
    listMovements: async (query) => {
      // حراسة القراءة.
      const allowed = await guard('inventory', 'read');
      if (!allowed.success) return allowed;
      // تضييق النطاق.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // التنفيذ.
      return deps.repository.listMovements({ ...query, scope: query?.scope ?? scope });
    },

    // ── الملخص ──
    getSummary: async () => {
      // حراسة القراءة.
      const allowed = await guard('inventory', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.getSummary();
    },

    // ── تنبيهات النقص ──
    getLowStockAlerts: async () => {
      // حراسة القراءة.
      const allowed = await guard('inventory', 'read');
      if (!allowed.success) return allowed;
      // التنفيذ.
      return deps.repository.getLowStockAlerts();
    },
  };
};
