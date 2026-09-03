/**
 * أنواع كتالوج المنتجات (PHASE 11 — POS Core).
 * المنتج يحمل سعرًا نقديًا حقيقيًا (كائن Money)، باركود للبحث/المسح،
 * تصنيفًا، وحالة مخزون. كل الحسابات النقدية لاحقًا تمر عبر core/money.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { CurrencyCode } from '@/core/money/money';

// تصنيف المنتج (يُستخدم في فلاتر شاشة نقطة البيع).
export interface ProductCategory {
  id: ID; // معرف التصنيف.
  nameAr: string; // الاسم بالعربية.
  nameEn: string; // الاسم بالإنجليزية (مفتاح ترجمة أو نص مباشر للعرض).
  icon?: string; // أيقونة Ionicons للتصنيف.
}

// حالة توفر المنتج في المتجر.
export type ProductStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// كيان المنتج.
export interface Product extends Auditable {
  id: ID; // معرف المنتج.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر (للتضييق متعدد المتاجر).
  sku: string; // رمز الصنف الداخلي (SKU).
  barcode: string; // الباركود (EAN/UPC) للمسح.
  nameAr: string; // اسم المنتج بالعربية.
  nameEn: string; // اسم المنتج بالإنجليزية.
  categoryId: string; // معرف التصنيف.
  /** سعر البيع بالعملة المحددة (قيمة نقدية حقيقية — لا floating خام). */
  price: { amount: number; currency: CurrencyCode };
  taxIncluded: boolean; // هل السعر شامل الضريبة؟
  stockStatus: ProductStockStatus; // حالة المخزون.
  stockQuantity: number; // الكمية المتوفرة (للحالة والحد).
  imageIcon?: string; // أيقونة Ionicons بدل الصورة (أصول الصور لاحقًا).
}

// معايير استعلام الكتالوج (بحث/تصنيف/باركود + نطاق).
export interface ProductQuery {
  search?: string; // نص البحث (الاسم/الباركود/SKU).
  categoryId?: string; // فلترة بتصنيف.
  barcode?: string; // بحث بباركود محدد (المسح).
  storeId?: ID; // تضييق المتجر.
  branchId?: ID; // تضييق الفرع.
  includeOutOfStock?: boolean; // تضمين النافد؟ (افتراضي نعم للعرض).
  limit?: number; // حد عدد النتائج.
}

// نتيجة بحث/جلب الكتالوج.
export interface ProductCatalogResult {
  products: Product[]; // المنتجات المطابقة.
  categories: ProductCategory[]; // التصنيفات المتاحة (للفلاتر).
  total: number; // عدد المنتجات المطابقة قبل الحد.
  fetchedAt: ISODateString; // لحظة الجلب.
}
