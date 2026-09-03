/**
 * تنفيذ محلي لمستودع المنتجات — PHASE 31 · أقسام 31 و62 و73.
 * تنفيذ حقيقي لا وهمي: يغلّف مستودع المنتجات القائم في التطبيق (PHASE 11/16)
 * الذي يخزّن الكتالوج فعليًا على الجهاز، ويحوّل بياناته إلى كيانات الـSDK.
 * حين يتوفّر MAJID API يُكتب RemoteProductRepository بنفس العقد ويُستبدل
 * من نقطة التركيب فقط — دون لمس أي شاشة أو خدمة (قسم 38).
 */
import { asId } from '@/core/types/domain';
import type { ProductsRepository as LegacyProductsRepository } from '@/data/repositories/products.repository';
import type { ProductDraft } from '@/domain/products/validation';
import {
  NotFoundError,
  attemptAsync,
  asCategoryId,
  failure,
  paginate,
  success,
  toSDKError,
  type AsyncResult,
  type CategoryId,
  type PaginatedResult,
  type ProductId,
  type ScopeFilter,
  type TenantId,
} from '@/sdk/core';
import type { Product, ProductCategory } from '../contracts/product-contracts';
import type { ProductRepository } from '../contracts/product-repository';
import type {
  CreateProductCommand,
  ProductBarcodeQuery,
  ProductListQuery,
  ProductSearchQuery,
  UpdateProductCommand,
} from '../contracts/product-queries';
import { productFromLegacy } from '../mappers/product-mapper';
import { applyProductQuery, applyProductSearch, matchesBarcode } from '../queries/product-query-logic';

// تبعيات التنفيذ المحلي.
export interface LocalProductRepositoryDependencies {
  // مستودع المنتجات القائم (المصدر الحقيقي للكتالوج على الجهاز).
  readonly legacy: LegacyProductsRepository;
  // المستأجر الافتراضي حين لا يحمل المنتج القديم مستأجرًا صريحًا.
  readonly defaultTenantId: () => TenantId | undefined;
}

// ينشئ تنفيذًا محليًا لمستودع المنتجات.
export const createLocalProductRepository = (
  deps: LocalProductRepositoryDependencies,
): ProductRepository => {
  // يقرأ الكتالوج كاملًا ويحوّله لكيانات الـSDK.
  const readAll = async (): Promise<readonly Product[]> => {
    // نطلب كل المنتجات من المستودع القديم (بلا فلترة).
    const catalog = await deps.legacy.searchProducts({});
    // نحوّل كل منتج عبر المحوّل الرسمي.
    return catalog.products.map(productFromLegacy);
  };

  // يبني مسودّة المنتج القديمة من أمر الإنشاء/التعديل (شكل النماذج القائم).
  const toDraft = (command: {
    sku?: string;
    barcode?: string;
    nameAr?: string;
    nameEn?: string;
    categoryId?: string;
    priceAmount?: number;
    currency?: string;
    taxIncluded?: boolean;
    initialQuantity?: number;
    icon?: string;
  }, fallback?: Product): ProductDraft => ({
    // كل حقل يأخذ القيمة الجديدة أو القيمة الحالية من المنتج القائم.
    nameAr: command.nameAr ?? fallback?.nameAr ?? '',
    nameEn: command.nameEn ?? fallback?.nameEn ?? '',
    sku: command.sku ?? fallback?.sku ?? '',
    barcode: command.barcode ?? fallback?.barcodes[0]?.value ?? '',
    categoryId: command.categoryId ?? String(fallback?.categoryId ?? ''),
    // المسودّة القديمة تستخدم نصوصًا للأرقام (نماذج الإدخال).
    priceAmount: String(command.priceAmount ?? fallback?.price.amount.amount ?? 0),
    // العملة من الأمر أو من سعر المنتج القائم (لا افتراض صامت لعملة أخرى).
    currency: command.currency ?? fallback?.price.amount.currency ?? 'YER',
    taxIncluded: command.taxIncluded ?? fallback?.price.taxIncluded ?? true,
    stockQuantity: String(command.initialQuantity ?? fallback?.stock.quantity ?? 0),
    imageIcon: command.icon ?? fallback?.icon ?? 'cube-outline',
  });

  return {
    // ── سرد مُرقَّم ──
    list: async (query?: ProductListQuery): AsyncResult<PaginatedResult<Product>> =>
      // نغلّف القراءة كاملة في attemptAsync فأي استثناء يصبح خطأ SDK مصنّفًا.
      attemptAsync(async () => applyProductQuery(await readAll(), query)),

    // ── جلب بالمعرّف ──
    get: async (id: ProductId) => {
      // نقرأ الكتالوج ونبحث عن المعرّف.
      const result = await attemptAsync(async () => {
        // كل المنتجات.
        const products = await readAll();
        // نبحث عن المطابق نصيًّا (المعرّفات نصوص موسومة).
        return products.find((product) => String(product.id) === String(id));
      });
      // فشل القراءة يُمرَّر.
      if (!result.success) return result;
      // الغياب خطأ NotFound صريح (العقد يقول: get يفشل عند الغياب).
      if (!result.data) return failure(new NotFoundError('product', String(id)));
      // النجاح.
      return success(result.data);
    },

    // ── بحث نصي ──
    search: async (query: ProductSearchQuery) =>
      attemptAsync(async () => applyProductSearch(await readAll(), query)),

    // ── جلب بالباركود ──
    getByBarcode: async (query: ProductBarcodeQuery) =>
      attemptAsync(async () => {
        // كل المنتجات.
        const products = await readAll();
        // أول منتج يطابق الباركود تمامًا، أو null (الغياب ليس خطأً).
        return products.find((product) => matchesBarcode(product, query.barcode)) ?? null;
      }),

    // ── إنشاء ──
    create: async (command: CreateProductCommand, scope: ScopeFilter) => {
      try {
        // نبني المسودّة بشكل النماذج القائم.
        const draft = toDraft(command);
        // ننفّذ الإنشاء عبر المستودع القديم (يتحقق ويولّد المعرّف والتسلسل).
        const created = await deps.legacy.createProduct(draft, {
          // المستأجر من النطاق المُمرَّر أو الافتراضي.
          tenantId: asId(String(scope.tenantId ?? deps.defaultTenantId() ?? 'tenant-local')),
          organizationId: scope.organizationId ? asId(String(scope.organizationId)) : undefined,
          branchId: scope.branchId ? asId(String(scope.branchId)) : undefined,
          storeId: scope.storeId ? asId(String(scope.storeId)) : undefined,
        });
        // نحوّل الناتج لكيان الـSDK.
        return success(productFromLegacy(created));
      } catch (error) {
        // أي استثناء من الطبقة القديمة يُصنَّف كخطأ SDK.
        return failure(toSDKError(error));
      }
    },

    // ── تعديل ──
    update: async (command: UpdateProductCommand) => {
      try {
        // نحتاج المنتج الحالي لبناء مسودّة كاملة (تعديل جزئي فوق قيم قائمة).
        const catalog = await deps.legacy.searchProducts({});
        // نبحث عن المنتج المستهدف في شكله القديم.
        const legacyProduct = catalog.products.find((item) => String(item.id) === String(command.productId));
        // الغياب خطأ NotFound.
        if (!legacyProduct) return failure(new NotFoundError('product', String(command.productId)));
        // نبني المسودّة من الأمر فوق القيم الحالية.
        const draft = toDraft(
          {
            sku: command.sku,
            barcode: command.barcode,
            nameAr: command.nameAr,
            nameEn: command.nameEn,
            categoryId: command.categoryId ? String(command.categoryId) : undefined,
            priceAmount: command.priceAmount,
            currency: legacyProduct.price.currency,
            taxIncluded: command.taxIncluded,
            icon: command.icon,
          },
          productFromLegacy(legacyProduct),
        );
        // ننفّذ التعديل.
        const updated = await deps.legacy.updateProduct(legacyProduct, draft);
        // نحوّل الناتج.
        return success(productFromLegacy(updated));
      } catch (error) {
        // تصنيف الاستثناء.
        return failure(toSDKError(error));
      }
    },

    // ── حذف ──
    delete: async (id: ProductId): AsyncResult<void> => {
      // المستودع القديم يحذف بصمت إن غاب المنتج؛ والعقد يوجب NotFound.
      // نتحقق من وجوده أولًا حتى يتطابق سلوك كل التنفيذات (قسم 61)،
      // عبر قراءة الكتالوج القائمة دون توسيع عقد المستودع القديم.
      const existing = await attemptAsync(async () => {
        // كل المنتجات المتاحة.
        const products = await readAll();
        // نبحث عن المطابق نصيًّا.
        return products.find((product) => String(product.id) === String(id));
      });
      // فشل القراءة يُمرَّر كما هو.
      if (!existing.success) return existing;
      // الغياب خطأ صريح لا نجاح صامت.
      if (!existing.data) return failure(new NotFoundError('product', String(id)));
      // الوجود يعني حذفًا حقيقيًا.
      return attemptAsync(async () => {
        await deps.legacy.deleteProduct(asId(String(id)));
      });
    },

    // ── التصنيفات ──
    getCategories: async (): AsyncResult<readonly ProductCategory[]> =>
      attemptAsync(async () => {
        // نقرأ التصنيفات من المستودع القديم.
        const categories = await deps.legacy.listCategories();
        // نحوّلها لكيانات الـSDK بمعرّفات موسومة.
        return categories.map((category) => ({
          id: asCategoryId(String(category.id)),
          nameAr: category.nameAr,
          nameEn: category.nameEn,
          icon: category.icon,
        }));
      }),

    // ── فحص تكرار الباركود ──
    isBarcodeTaken: async (barcode: string, exceptProductId?: ProductId) =>
      attemptAsync(async () =>
        // نمرّر الاستثناء للمستودع القديم الذي يملك المنطق نفسه.
        deps.legacy.isBarcodeTaken(barcode, exceptProductId ? asId(String(exceptProductId)) : undefined),
      ),

    // ── تحديث الرصيد (يستدعيه مجال المخزون) ──
    setStockQuantity: async (id: ProductId, quantity: number) => {
      try {
        // نحدّث الرصيد عبر المستودع القديم.
        await deps.legacy.setProductStock(asId(String(id)), quantity);
        // نعيد قراءة المنتج بعد التحديث.
        const catalog = await deps.legacy.searchProducts({});
        // نبحث عنه في الكتالوج المحدّث.
        const updated = catalog.products.find((item) => String(item.id) === String(id));
        // الغياب بعد التحديث خطأ منطقي صريح.
        if (!updated) return failure(new NotFoundError('product', String(id)));
        // نُعيد الكيان المحدّث.
        return success(productFromLegacy(updated));
      } catch (error) {
        // تصنيف الاستثناء.
        return failure(toSDKError(error));
      }
    },

    // ── جلب مجموعة معرّفات دفعة واحدة ──
    getMany: async (ids: readonly ProductId[]) =>
      attemptAsync(async () => {
        // مجموعة المعرّفات المطلوبة للمطابقة السريعة.
        const wanted = new Set(ids.map((id) => String(id)));
        // كل المنتجات.
        const products = await readAll();
        // نُبقي المطلوب فقط.
        return products.filter((product) => wanted.has(String(product.id)));
      }),

    // ── سرد منتجات تصنيف ──
    listByCategory: async (categoryId: CategoryId, query?: ProductListQuery) =>
      attemptAsync(async () => applyProductQuery(await readAll(), { ...query, categoryId })),
  };
};

// يعيد صفحة فارغة (يُستخدم في حالات الحدود داخل التنفيذات).
export const emptyProductPage = (): PaginatedResult<Product> => paginate<Product>([]);
