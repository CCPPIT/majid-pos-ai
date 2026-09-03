/**
 * استعلامات وأوامر مجال المنتجات — PHASE 31 · أقسام 33 و45.
 * فصل صارم: الاستعلامات (Queries) تقرأ ولا تغيّر، والأوامر (Commands) تغيّر
 * الحالة. كل نوع منها يملك مخطط Zod للتحقق (قسم 42).
 */
import type {
  CategoryId,
  CurrencyCode,
  ProductId,
  QueryOptions,
} from '@/sdk/core';
import type { StockStatus } from './product-contracts';

// استعلام سرد المنتجات (يرث خيارات الاستعلام الموحّدة).
export interface ProductListQuery extends QueryOptions {
  readonly categoryId?: CategoryId; // تضييق بتصنيف.
  readonly stockStatus?: StockStatus; // تضييق بحالة المخزون.
  readonly activeOnly?: boolean; // المنتجات النشطة فقط.
}

// استعلام البحث النصي (يتطلب نص بحث صريحًا).
export interface ProductSearchQuery extends ProductListQuery {
  readonly term: string; // نص البحث (اسم/باركود/SKU).
}

// استعلام الجلب بالباركود (مسح الماسح الضوئي).
export interface ProductBarcodeQuery {
  readonly barcode: string; // الباركود الممسوح.
}

// أمر إنشاء منتج جديد.
export interface CreateProductCommand {
  readonly sku: string; // رمز الصنف.
  readonly barcode: string; // الباركود الأساسي.
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly categoryId: CategoryId; // التصنيف.
  readonly priceAmount: number; // قيمة السعر.
  readonly currency: CurrencyCode; // عملة السعر.
  readonly taxIncluded: boolean; // شمول الضريبة.
  readonly initialQuantity: number; // الرصيد الافتتاحي.
  readonly lowStockThreshold?: number; // حدّ التنبيه المنخفض.
  readonly costAmount?: number; // التكلفة (اختيارية).
  readonly icon?: string; // أيقونة العرض.
}

// أمر تعديل منتج قائم (كل الحقول اختيارية عدا المعرّف).
export interface UpdateProductCommand {
  readonly productId: ProductId; // المنتج المستهدف.
  readonly sku?: string; // رمز الصنف الجديد.
  readonly barcode?: string; // الباركود الجديد.
  readonly nameAr?: string; // الاسم العربي الجديد.
  readonly nameEn?: string; // الاسم الإنجليزي الجديد.
  readonly categoryId?: CategoryId; // التصنيف الجديد.
  readonly priceAmount?: number; // السعر الجديد.
  readonly taxIncluded?: boolean; // شمول الضريبة.
  readonly lowStockThreshold?: number; // حدّ التنبيه.
  readonly costAmount?: number; // التكلفة.
  readonly icon?: string; // الأيقونة.
  readonly active?: boolean; // تفعيل/تعطيل المنتج.
}

// أمر حذف منتج.
export interface DeleteProductCommand {
  readonly productId: ProductId; // المنتج المستهدف.
}
