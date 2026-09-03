/**
 * عقود مجال المنتجات — PHASE 31 · قسم 17.
 * كيانات المجال (Domain Entities) خالصة: لا تعرف من أين جاءت ولا كيف تُخزَّن.
 * كل مبلغ Money حقيقي، وكل معرّف مُوسَم، وكل كيان مربوط بمستأجره.
 */
import type {
  AuditableFields,
  CategoryId,
  ISODateTime,
  Money,
  ProductId,
  ProductVariantId,
  TenantScopedFields,
} from '@/sdk/core';

// حالة توفّر المنتج المشتقة من الرصيد.
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// باركود منتج مع نوعه (يدعم عدة باركودات لاحقًا).
export interface Barcode {
  readonly value: string; // قيمة الباركود.
  readonly format: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'QR' | 'OTHER'; // صيغته.
  readonly isPrimary: boolean; // هل هو الباركود الأساسي للمنتج؟
}

// سعر بيع المنتج مع شمول الضريبة.
export interface ProductPrice {
  readonly amount: Money; // قيمة السعر.
  readonly taxIncluded: boolean; // هل السعر شامل الضريبة؟
  readonly effectiveFrom?: ISODateTime; // بداية سريان السعر (لتسعير مجدول لاحقًا).
}

// تكلفة المنتج (أساس هامش الربح في المالية).
export interface ProductCost {
  readonly amount: Money; // قيمة التكلفة.
  readonly method: 'last' | 'average' | 'standard'; // طريقة احتساب التكلفة.
}

// تصنيف المنتجات.
export interface ProductCategory {
  readonly id: CategoryId; // المعرّف.
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly icon?: string; // أيقونة العرض.
  readonly parentId?: CategoryId; // التصنيف الأب (شجرة تصنيفات).
}

// متغيّر منتج (حجم/لون/وحدة) — العقد جاهز والتنفيذ يتوسّع لاحقًا.
export interface ProductVariant {
  readonly id: ProductVariantId; // المعرّف.
  readonly productId: ProductId; // المنتج الأصل.
  readonly sku: string; // رمز الصنف الخاص بالمتغيّر.
  readonly nameAr: string; // اسم المتغيّر بالعربية.
  readonly nameEn: string; // اسمه بالإنجليزية.
  readonly price: ProductPrice; // سعره (قد يختلف عن الأصل).
  readonly attributes: Readonly<Record<string, string>>; // خصائصه (لون: أحمر…).
}

// ملخص مخزون المنتج (يُقرأ من مجال المخزون ويُعرض مع المنتج).
export interface ProductStockSummary {
  readonly quantity: number; // الرصيد الحالي.
  readonly status: StockStatus; // الحالة المشتقة.
  readonly lowStockThreshold: number; // حدّ التنبيه المنخفض.
  readonly lastMovementAt?: ISODateTime; // لحظة آخر حركة.
}

// كيان المنتج الكامل.
export interface Product extends TenantScopedFields, AuditableFields {
  readonly id: ProductId; // المعرّف.
  readonly sku: string; // رمز الصنف الداخلي.
  readonly barcodes: readonly Barcode[]; // باركوداته.
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly categoryId: CategoryId; // التصنيف.
  readonly price: ProductPrice; // سعر البيع.
  readonly cost?: ProductCost; // التكلفة (اختيارية).
  readonly stock: ProductStockSummary; // ملخص المخزون.
  readonly variants: readonly ProductVariant[]; // المتغيّرات (فارغة اليوم).
  readonly icon?: string; // أيقونة العرض.
  readonly active: boolean; // هل المنتج نشط للبيع؟
}

// اسم المنتج حسب اللغة (دالة عرض نقية في طبقة المجال).
export const productName = (product: Product, locale: 'ar' | 'en'): string =>
  // العربية أولًا؛ الإنجليزية عند طلبها صراحة.
  locale === 'ar' ? product.nameAr : product.nameEn;

// الباركود الأساسي للمنتج (أول باركود مُعلَّم أساسيًا أو أول المتاح).
export const primaryBarcode = (product: Product): string =>
  // نبحث عن الأساسي، وإن غاب نأخذ الأول، وإن لم يوجد شيء نُعيد نصًّا فارغًا.
  product.barcodes.find((barcode) => barcode.isPrimary)?.value ?? product.barcodes[0]?.value ?? '';
