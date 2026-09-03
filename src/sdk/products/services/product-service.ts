/**
 * خدمة المنتجات — PHASE 31 · أقسام 17 و35 و57.
 * الخدمة تنفّذ حالات الاستخدام فوق المستودع: تحقّق ← تفويض ← نطاق ← تنفيذ
 * ← حدث مجال ← تدقيق. الشاشة تستدعي sdk.products.* ولا تعرف شيئًا عن المصدر.
 */
import {
  ConflictError,
  NotFoundError,
  createAuditEvent,
  createDomainEvent,
  failure,
  success,
  SDK_DOMAIN_EVENTS,
  type AsyncResult,
  type AuditLogger,
  type CategoryId,
  type EventPublisher,
  type PaginatedResult,
  type ProductId,
  type Result,
  type SDKContextStore,
} from '@/sdk/core';
import type { RbacService } from '@/sdk/rbac';
import type { TenancyService } from '@/sdk/tenancy';
import type { Product, ProductCategory } from '../contracts/product-contracts';
import type { ProductRepository } from '../contracts/product-repository';
import type {
  CreateProductCommand,
  DeleteProductCommand,
  ProductBarcodeQuery,
  ProductListQuery,
  ProductSearchQuery,
  UpdateProductCommand,
} from '../contracts/product-queries';
import {
  createProductSchema,
  deleteProductSchema,
  productBarcodeSchema,
  productSearchSchema,
  updateProductSchema,
  validateWith,
} from '../contracts/product-schemas';

// الواجهة العلنية لخدمة المنتجات (sdk.products).
export interface ProductService {
  // يسرد المنتجات ضمن نطاق المستخدم الحالي.
  list(query?: ProductListQuery): AsyncResult<PaginatedResult<Product>>;
  // يجلب منتجًا بالمعرّف.
  get(id: ProductId): AsyncResult<Product>;
  // يبحث نصيًّا.
  search(query: ProductSearchQuery): AsyncResult<PaginatedResult<Product>>;
  // ينشئ منتجًا (يتطلب إذن products.create).
  create(command: CreateProductCommand): AsyncResult<Product>;
  // يعدّل منتجًا (يتطلب إذن products.update).
  update(command: UpdateProductCommand): AsyncResult<Product>;
  // يحذف منتجًا (يتطلب إذن products.delete).
  delete(command: DeleteProductCommand): AsyncResult<void>;
  // يجلب منتجًا بالباركود (مسح).
  getByBarcode(query: ProductBarcodeQuery): AsyncResult<Product | null>;
  // يسرد التصنيفات.
  getCategories(): AsyncResult<readonly ProductCategory[]>;
  // يسرد منتجات تصنيف محدد.
  listByCategory(categoryId: CategoryId, query?: ProductListQuery): AsyncResult<PaginatedResult<Product>>;
}

// تبعيات الخدمة (كلها واجهات — قسم 38).
export interface ProductServiceDependencies {
  readonly repository: ProductRepository; // مستودع المنتجات.
  readonly rbac: RbacService; // خدمة الصلاحيات.
  readonly tenancy: TenancyService; // خدمة النطاق.
  readonly contextStore: SDKContextStore; // السياق الحالي.
  readonly events: EventPublisher; // ناشر أحداث المجال.
  readonly audit: AuditLogger; // مُسجّل التدقيق.
}

// ينشئ خدمة المنتجات بالحقن الكامل.
export const createProductService = (deps: ProductServiceDependencies): ProductService => {
  // يبني بيانات التدقيق المشتركة من السياق الحالي.
  const auditBase = () => {
    // نقرأ السياق مرة واحدة لكل عملية.
    const context = deps.contextStore.get();
    // نُعيد الحقول المشتركة لكل حدث تدقيق.
    return {
      actor: context.userId ?? ('system' as const),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      branchId: context.branchId,
      storeId: context.storeId,
    };
  };

  // يحرس عملية بإذن محدد ونطاق مطلوب قبل تنفيذها.
  const guard = async (
    resource: string, // المورد.
    action: string, // الفعل.
    requiresStore: boolean, // هل تتطلب العملية متجرًا نشطًا؟
  ): Promise<Result<true>> => {
    // (1) حراسة السياق: مستأجر دائمًا، ومتجر عند الحاجة.
    const contextResult = requiresStore ? deps.tenancy.requireStore() : deps.tenancy.requireTenant();
    // نقص السياق يمنع العملية فورًا.
    if (!contextResult.success) return contextResult;
    // (2) حراسة الصلاحية والنطاق والسياسات.
    const decision = await deps.rbac.can({ resource, action });
    // منع التفويض يمنع العملية ويُسجَّل كمحاولة مرفوضة.
    if (!decision.success) {
      // نسجّل محاولة الوصول المرفوضة في التدقيق (قسم 41).
      deps.audit.record(
        createAuditEvent({ ...auditBase(), action: `${resource}.${action}`, resource, result: 'denied' }),
      );
      return decision;
    }
    // كل الحراسات نجحت.
    return success(true);
  };

  return {
    // ── سرد المنتجات (قراءة) ──
    list: async (query) => {
      // الحراسة: إذن قراءة المنتجات دون اشتراط متجر (قد يقرأ مدير المؤسسة الكل).
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // نطاق المستخدم يحدّد تضييق البيانات.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      // نمرّر النطاق مدموجًا مع استعلام المتصل.
      return deps.repository.list({ ...query, scope: query?.scope ?? scope });
    },

    // ── جلب منتج واحد ──
    get: async (id) => {
      // الحراسة نفسها للقراءة.
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // نطلب المنتج من المستودع.
      const result = await deps.repository.get(id);
      // إن نجح نتحقق أنه ضمن مستأجر السياق (عزل صارم — قسم 58).
      if (result.success) {
        // نقرأ المستأجر الحالي.
        const tenantId = deps.contextStore.get().tenantId;
        // منتج من مستأجر آخر يُعامل كغير موجود (لا نكشف وجوده).
        if (tenantId !== undefined && String(result.data.tenantId) !== String(tenantId)) {
          return failure(new NotFoundError('product', String(id)));
        }
      }
      // نُعيد النتيجة كما هي.
      return result;
    },

    // ── البحث النصي ──
    search: async (query) => {
      // الحراسة أولًا.
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // نتحقق من صحة مدخلات البحث (نص بطول معقول).
      const validated = validateWith(productSearchSchema, {
        term: query.term,
        categoryId: query.categoryId ? String(query.categoryId) : undefined,
        activeOnly: query.activeOnly,
      });
      // مدخلات غير صالحة تُوقف العملية.
      if (!validated.success) return validated;
      // نضيّق بالنطاق ثم نبحث.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      return deps.repository.search({ ...query, scope: query.scope ?? scope });
    },

    // ── إنشاء منتج (طفرة حسّاسة) ──
    create: async (command) => {
      // (1) تحقّق المدخلات قبل أي شيء آخر.
      const validated = validateWith(createProductSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة: إذن الإنشاء + وجود مستأجر.
      const allowed = await guard('products', 'create', false);
      if (!allowed.success) return allowed;
      // (3) قاعدة عمل: لا باركود مكرر.
      const taken = await deps.repository.isBarcodeTaken(validated.data.barcode);
      // فشل الفحص نفسه يُمرَّر كما هو.
      if (!taken.success) return taken;
      // باركود مستخدم = تعارض صريح.
      if (taken.data) {
        return failure(
          new ConflictError('sdk.error.barcodeTaken', { details: { barcode: validated.data.barcode } }),
        );
      }
      // (4) التنفيذ ضمن نطاق السياق الحالي.
      const context = deps.contextStore.get();
      const created = await deps.repository.create(command, {
        tenantId: context.tenantId,
        organizationId: context.organizationId,
        branchId: context.branchId,
        storeId: context.storeId,
      });
      // فشل التنفيذ يُمرَّر.
      if (!created.success) return created;
      // (5) حدث المجال بعد النجاح فقط.
      deps.events.publish(
        createDomainEvent(SDK_DOMAIN_EVENTS.PRODUCT_CREATED, { productId: String(created.data.id) }, {
          tenantId: context.tenantId,
          storeId: context.storeId,
          actorId: context.userId,
        }),
      );
      // (6) أثر التدقيق.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'products.create',
          resource: 'product',
          resourceId: String(created.data.id),
          metadata: { sku: created.data.sku },
        }),
      );
      // نُعيد المنتج المُنشأ.
      return created;
    },

    // ── تعديل منتج ──
    update: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(updateProductSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن التعديل.
      const allowed = await guard('products', 'update', false);
      if (!allowed.success) return allowed;
      // (3) منع تكرار الباركود عند تغييره.
      if (command.barcode !== undefined) {
        // نفحص الباركود مستثنين المنتج نفسه.
        const taken = await deps.repository.isBarcodeTaken(command.barcode, command.productId);
        if (!taken.success) return taken;
        // مستخدم من منتج آخر = تعارض.
        if (taken.data) {
          return failure(
            new ConflictError('sdk.error.barcodeTaken', { details: { barcode: command.barcode } }),
          );
        }
      }
      // (4) التنفيذ.
      const updated = await deps.repository.update(command);
      if (!updated.success) return updated;
      // (5) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(SDK_DOMAIN_EVENTS.PRODUCT_UPDATED, { productId: String(updated.data.id) }, {
          tenantId: context.tenantId,
          storeId: context.storeId,
          actorId: context.userId,
        }),
      );
      // (6) التدقيق.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'products.update',
          resource: 'product',
          resourceId: String(updated.data.id),
        }),
      );
      // نُعيد المنتج المعدّل.
      return updated;
    },

    // ── حذف منتج ──
    delete: async (command) => {
      // (1) تحقّق المدخلات.
      const validated = validateWith(deleteProductSchema, command);
      if (!validated.success) return validated;
      // (2) الحراسة بإذن الحذف (نطاقه أوسع في الفهرس القانوني).
      const allowed = await guard('products', 'delete', false);
      if (!allowed.success) return allowed;
      // (3) التنفيذ.
      const deleted = await deps.repository.delete(command.productId);
      if (!deleted.success) return deleted;
      // (4) الحدث.
      const context = deps.contextStore.get();
      deps.events.publish(
        createDomainEvent(SDK_DOMAIN_EVENTS.PRODUCT_DELETED, { productId: String(command.productId) }, {
          tenantId: context.tenantId,
          storeId: context.storeId,
          actorId: context.userId,
        }),
      );
      // (5) التدقيق.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'products.delete',
          resource: 'product',
          resourceId: String(command.productId),
        }),
      );
      // نجاح بلا قيمة.
      return success(undefined);
    },

    // ── الجلب بالباركود (المسح في نقطة البيع) ──
    getByBarcode: async (query) => {
      // الحراسة بإذن القراءة.
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // تحقّق صيغة الباركود.
      const validated = validateWith(productBarcodeSchema, query);
      if (!validated.success) return validated;
      // التنفيذ.
      return deps.repository.getByBarcode(query);
    },

    // ── التصنيفات ──
    getCategories: async () => {
      // الحراسة بإذن القراءة.
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // التنفيذ المباشر.
      return deps.repository.getCategories();
    },

    // ── منتجات تصنيف محدد ──
    listByCategory: async (categoryId, query) => {
      // الحراسة بإذن القراءة.
      const allowed = await guard('products', 'read', false);
      if (!allowed.success) return allowed;
      // نضيّق بالنطاق ثم نسرد.
      const scope = deps.tenancy.scopeFilter(await deps.rbac.getScope());
      return deps.repository.listByCategory(categoryId, { ...query, scope: query?.scope ?? scope });
    },
  };
};
