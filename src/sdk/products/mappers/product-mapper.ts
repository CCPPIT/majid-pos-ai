/**
 * محوّلات المنتجات (DTO ⇄ Domain) — PHASE 31 · قسم 34.
 * قاعدة صارمة: لا يُستخدم DTO داخل المجال، ولا يُسرَّب كيان المجال للتخزين
 * كما هو. المسار دائمًا: DTO → Mapper → Domain Entity (والعكس عند الكتابة).
 * هنا نربط كيان المنتج في الـSDK بكيان المنتج القائم في التطبيق (PHASE 11/16)
 * دون كسر أي شاشة تعمل اليوم (قسم 75).
 */
import { asId, type ID } from '@/core/types/domain';
import type { Product as LegacyProduct } from '@/domain/products/types';
import {
  asCategoryId,
  asProductId,
  asTenantId,
  money,
  toCurrencyCode,
  type CurrencyCode,
  type ISODateTime,
} from '@/sdk/core';
import type { Product, ProductCategory, StockStatus } from '../contracts/product-contracts';

/**
 * شكل النقل (DTO) للمنتج كما يصل من مصدر بعيد أو تخزين محلي.
 * حقوله بدائية بحتة (نصوص وأرقام) — لا أنواع مجال ولا معرّفات موسومة.
 */
export interface ProductDTO {
  readonly id: string; // المعرّف الخام.
  readonly tenantId: string; // المستأجر.
  readonly organizationId?: string; // المؤسسة.
  readonly branchId?: string; // الفرع.
  readonly storeId?: string; // المتجر.
  readonly sku: string; // رمز الصنف.
  readonly barcode: string; // الباركود الأساسي.
  readonly nameAr: string; // الاسم العربي.
  readonly nameEn: string; // الاسم الإنجليزي.
  readonly categoryId: string; // التصنيف.
  readonly priceAmount: number; // قيمة السعر.
  readonly currency: string; // كود العملة.
  readonly taxIncluded: boolean; // شمول الضريبة.
  readonly costAmount?: number; // التكلفة.
  readonly quantity: number; // الرصيد.
  readonly lowStockThreshold?: number; // حدّ التنبيه.
  readonly icon?: string; // الأيقونة.
  readonly active?: boolean; // نشط؟
  readonly createdAt: string; // لحظة الإنشاء.
  readonly updatedAt: string; // آخر تعديل.
}

// حدّ التنبيه الافتراضي للمخزون المنخفض حين لا يحدده المنتج.
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// يشتق حالة المخزون من الكمية والحد (منطق مجال نقي).
export const deriveStockStatus = (
  quantity: number,
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): StockStatus => {
  // رصيد صفر أو أقل = نافد.
  if (quantity <= 0) return 'out_of_stock';
  // رصيد عند الحد أو أقل = منخفض.
  if (quantity <= threshold) return 'low_stock';
  // غير ذلك = متوفر.
  return 'in_stock';
};

// يحوّل DTO خامًا إلى كيان مجال مكتمل الأنواع.
export const productFromDTO = (dto: ProductDTO): Product => {
  // نحسم عملة السعر (مع رجوع آمن للعملة الافتراضية).
  const currency: CurrencyCode = toCurrencyCode(dto.currency);
  // حدّ التنبيه المطبَّق.
  const threshold = dto.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  // نبني الكيان بالمعرّفات الموسومة والمبالغ النقدية الحقيقية.
  return {
    id: asProductId(dto.id),
    tenantId: asTenantId(dto.tenantId),
    // الحقول الاختيارية تُحوَّل فقط عند وجودها.
    organizationId: dto.organizationId ? (dto.organizationId as Product['organizationId']) : undefined,
    branchId: dto.branchId ? (dto.branchId as Product['branchId']) : undefined,
    storeId: dto.storeId ? (dto.storeId as Product['storeId']) : undefined,
    sku: dto.sku,
    // الباركود يُغلَّف في مصفوفة مع تعليمه أساسيًا.
    barcodes: [{ value: dto.barcode, format: 'EAN13', isPrimary: true }],
    nameAr: dto.nameAr,
    nameEn: dto.nameEn,
    categoryId: asCategoryId(dto.categoryId),
    // السعر كائن Money حقيقي.
    price: { amount: money(dto.priceAmount, currency), taxIncluded: dto.taxIncluded },
    // التكلفة تُبنى فقط عند وجودها.
    cost: dto.costAmount !== undefined
      ? { amount: money(dto.costAmount, currency), method: 'last' }
      : undefined,
    // ملخص المخزون مع الحالة المشتقة.
    stock: {
      quantity: dto.quantity,
      status: deriveStockStatus(dto.quantity, threshold),
      lowStockThreshold: threshold,
    },
    // لا متغيّرات في هذه المرحلة (العقد جاهز للتوسّع).
    variants: [],
    icon: dto.icon,
    // المنتج نشط افتراضيًا ما لم يُحدَّد خلاف ذلك.
    active: dto.active ?? true,
    createdAt: dto.createdAt as ISODateTime,
    updatedAt: dto.updatedAt as ISODateTime,
  };
};

// يحوّل كيان المجال إلى DTO للكتابة في التخزين/الشبكة.
export const productToDTO = (product: Product): ProductDTO => ({
  // المعرّفات تُفرَّغ إلى نصوص خام.
  id: String(product.id),
  tenantId: String(product.tenantId),
  organizationId: product.organizationId ? String(product.organizationId) : undefined,
  branchId: product.branchId ? String(product.branchId) : undefined,
  storeId: product.storeId ? String(product.storeId) : undefined,
  sku: product.sku,
  // نكتب الباركود الأساسي فقط في هذا الشكل.
  barcode: product.barcodes.find((barcode) => barcode.isPrimary)?.value ?? product.barcodes[0]?.value ?? '',
  nameAr: product.nameAr,
  nameEn: product.nameEn,
  categoryId: String(product.categoryId),
  // المبالغ تُفكَّك إلى قيمة + عملة.
  priceAmount: product.price.amount.amount,
  currency: product.price.amount.currency,
  taxIncluded: product.price.taxIncluded,
  costAmount: product.cost?.amount.amount,
  quantity: product.stock.quantity,
  lowStockThreshold: product.stock.lowStockThreshold,
  icon: product.icon,
  active: product.active,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

/**
 * يحوّل منتج التطبيق القائم (PHASE 11) إلى كيان الـSDK.
 * جسر التوافق الخلفي: الشاشات الحالية تبقى تعمل بينما يتبنّى المجال الجديد
 * نفس البيانات دون نسخ ولا ازدواج في مصدر الحقيقة (قسم 75).
 */
export const productFromLegacy = (legacy: LegacyProduct): Product =>
  // نمرّ عبر DTO لضمان مسار واحد للتحويل.
  productFromDTO({
    id: String(legacy.id),
    tenantId: String(legacy.tenantId),
    organizationId: legacy.organizationId ? String(legacy.organizationId) : undefined,
    branchId: legacy.branchId ? String(legacy.branchId) : undefined,
    storeId: legacy.storeId ? String(legacy.storeId) : undefined,
    sku: legacy.sku,
    barcode: legacy.barcode,
    nameAr: legacy.nameAr,
    nameEn: legacy.nameEn,
    categoryId: legacy.categoryId,
    priceAmount: legacy.price.amount,
    currency: legacy.price.currency,
    taxIncluded: legacy.taxIncluded,
    quantity: legacy.stockQuantity,
    icon: legacy.imageIcon,
    active: true,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  });

// يحوّل كيان الـSDK إلى منتج التطبيق القائم (عند الكتابة عبر المستودع القديم).
export const productToLegacy = (product: Product): LegacyProduct => ({
  // المعرّفات تعود لنوع ID القديم.
  id: asId(String(product.id)) as ID,
  tenantId: asId(String(product.tenantId)) as ID,
  organizationId: product.organizationId ? (asId(String(product.organizationId)) as ID) : undefined,
  branchId: product.branchId ? (asId(String(product.branchId)) as ID) : undefined,
  storeId: product.storeId ? (asId(String(product.storeId)) as ID) : undefined,
  sku: product.sku,
  barcode: product.barcodes.find((barcode) => barcode.isPrimary)?.value ?? '',
  nameAr: product.nameAr,
  nameEn: product.nameEn,
  categoryId: String(product.categoryId),
  // السعر يعود لشكل { amount, currency } الخام.
  price: { amount: product.price.amount.amount, currency: product.price.amount.currency },
  taxIncluded: product.price.taxIncluded,
  stockStatus: product.stock.status,
  stockQuantity: product.stock.quantity,
  imageIcon: product.icon,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

// شكل النقل للتصنيف.
export interface ProductCategoryDTO {
  readonly id: string; // المعرّف.
  readonly nameAr: string; // الاسم العربي.
  readonly nameEn: string; // الاسم الإنجليزي.
  readonly icon?: string; // الأيقونة.
  readonly parentId?: string; // التصنيف الأب.
}

// يحوّل DTO التصنيف إلى كيان مجال.
export const categoryFromDTO = (dto: ProductCategoryDTO): ProductCategory => ({
  id: asCategoryId(dto.id),
  nameAr: dto.nameAr,
  nameEn: dto.nameEn,
  icon: dto.icon,
  parentId: dto.parentId ? asCategoryId(dto.parentId) : undefined,
});
