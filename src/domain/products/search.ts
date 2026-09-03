/**
 * منطق بحث/فلترة المنتجات النقي (PHASE 11).
 * دوال بلا آثار جانبية تُستخدم من المستودع وتُختبر مباشرة.
 * البحث يشمل: الاسم (عربي/إنجليزي)، الباركود، و SKU.
 */
import type { Product, ProductCategory, ProductQuery } from './types';

// تطبيع النص للمطابقة (حروف صغيرة + إزالة فراغات).
export function normalizeText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '');
}

// هل المنتج يطابق نص البحث؟
export function matchesSearch(product: Product, term: string): boolean {
  const q = normalizeText(term);
  if (!q) return true; // لا نص → يطابق الكل.
  return (
    normalizeText(product.nameAr).includes(q) || // الاسم العربي.
    normalizeText(product.nameEn).includes(q) || // الاسم الإنجليزي.
    normalizeText(product.barcode).includes(q) || // الباركود.
    normalizeText(product.sku).includes(q) // SKU.
  );
}

// هل المنتج يطابق باركود المسح بالضبط (مع تطبيع).
export function matchesBarcode(product: Product, barcode: string): boolean {
  return normalizeText(product.barcode) === normalizeText(barcode);
}

// يطبّق كل معايير الاستعلام على قائمة منتجات.
export function filterProducts(products: readonly Product[], query: ProductQuery): Product[] {
  let result = [...products]; // نعمل على نسخة.

  // تضييق المتجر (متعدد المتاجر).
  if (query.storeId) {
    result = result.filter((p) => !p.storeId || String(p.storeId) === String(query.storeId));
  }
  // تضييق الفرع.
  if (query.branchId) {
    result = result.filter((p) => !p.branchId || String(p.branchId) === String(query.branchId));
  }
  // فلترة التصنيف.
  if (query.categoryId) {
    result = result.filter((p) => p.categoryId === query.categoryId);
  }
  // بحث بالباركود (المسح) — أولوية على النص.
  if (query.barcode) {
    result = result.filter((p) => matchesBarcode(p, query.barcode as string));
  } else if (query.search) {
    result = result.filter((p) => matchesSearch(p, query.search as string));
  }
  // استبعاد النافد إن طُلب.
  if (query.includeOutOfStock === false) {
    result = result.filter((p) => p.stockStatus !== 'out_of_stock');
  }
  // تطبيق الحد.
  if (query.limit && query.limit > 0) {
    result = result.slice(0, query.limit);
  }
  return result;
}

// يجلب منتجًا بالباركود (أول نتيجة) — للفحص السريع بعد المسح.
export function findByBarcode(products: readonly Product[], barcode: string): Product | undefined {
  return products.find((p) => matchesBarcode(p, barcode));
}

// يبني قائمة تصنيفات مميزة مرتبطة بمنتجات مرئية (مرتبة بالاسم العربي).
export function visibleCategories(products: readonly Product[], all: readonly ProductCategory[]): ProductCategory[] {
  const used = new Set(products.map((p) => p.categoryId)); // التصنيفات المستخدمة.
  return all
    .filter((c) => used.has(String(c.id))) // الموجود لها منتجات.
    .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')); // ترتيب عربي.
}

// اسم المنتج حسب اللغة النشطة.
export function localizedName(product: Product, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? product.nameAr : product.nameEn;
}
