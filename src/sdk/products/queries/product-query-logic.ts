/**
 * منطق استعلام المنتجات النقي — PHASE 31 · أقسام 33 و47.
 * دوال بلا آثار جانبية تُستخدمها كل تنفيذات المستودع (محلي/مُخزَّن/بعيد-مُحاكى)
 * فلا يتكرر منطق البحث والفلترة في أكثر من مكان (قسم 70).
 */
import {
  applyFilters,
  applySort,
  paginate,
  type PaginatedResult,
} from '@/sdk/core';
import { matchesScope } from '@/sdk/tenancy';
import type { Product } from '../contracts/product-contracts';
import type { ProductListQuery, ProductSearchQuery } from '../contracts/product-queries';

// يطبّع النص للمطابقة (حروف صغيرة + إزالة كل الفراغات).
export const normalizeSearchText = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, '');

// هل المنتج يطابق نص البحث في أي من حقوله القابلة للبحث؟
export const matchesSearchTerm = (product: Product, term: string): boolean => {
  // نص فارغ يطابق كل المنتجات.
  const needle = normalizeSearchText(term);
  if (needle.length === 0) return true;
  // نبحث في الاسم العربي والإنجليزي ورمز الصنف.
  const haystacks = [product.nameAr, product.nameEn, product.sku];
  // ونضيف كل باركودات المنتج.
  for (const barcode of product.barcodes) haystacks.push(barcode.value);
  // يكفي تطابق جزئي في أي حقل.
  return haystacks.some((value) => normalizeSearchText(value).includes(needle));
};

// هل للمنتج باركود يطابق القيمة الممسوحة تمامًا؟
export const matchesBarcode = (product: Product, barcode: string): boolean => {
  // نطبّع الباركود المطلوب.
  const needle = normalizeSearchText(barcode);
  // المطابقة تامة (لا جزئية) لأن المسح يعطي القيمة كاملة.
  return product.barcodes.some((item) => normalizeSearchText(item.value) === needle);
};

/**
 * يطبّق كل معايير استعلام السرد على قائمة منتجات محمّلة.
 * الترتيب: النطاق ← الحالة ← التصنيف ← البحث ← الفلاتر العامة ← الترتيب ← الترقيم.
 */
export const applyProductQuery = (
  products: readonly Product[],
  query?: ProductListQuery,
): PaginatedResult<Product> => {
  // بلا استعلام: نُرجع الكل في صفحة واحدة.
  if (!query) return paginate(products);
  // نبدأ من القائمة الكاملة.
  let result = [...products];
  // (1) تضييق النطاق متعدد المستأجرين (عزل صارم — قسم 58).
  if (query.scope) {
    result = result.filter((product) => matchesScope(product, query.scope as NonNullable<typeof query.scope>));
  }
  // (2) المنتجات النشطة فقط عند الطلب.
  if (query.activeOnly === true) {
    result = result.filter((product) => product.active);
  }
  // (3) تضييق بحالة المخزون.
  if (query.stockStatus !== undefined) {
    result = result.filter((product) => product.stock.status === query.stockStatus);
  }
  // (4) تضييق بالتصنيف.
  if (query.categoryId !== undefined) {
    result = result.filter((product) => String(product.categoryId) === String(query.categoryId));
  }
  // (5) بحث نصي حر.
  if (query.search !== undefined && query.search.trim().length > 0) {
    result = result.filter((product) => matchesSearchTerm(product, query.search as string));
  }
  // (6) الفلاتر العامة القابلة للتركيب.
  if (query.filters) {
    result = applyFilters(result, query.filters);
  }
  // (7) الترتيب المطلوب (أو ترتيب افتراضي بالاسم العربي).
  result = applySort(result, query.sort ?? { field: 'nameAr', direction: 'asc' });
  // (8) الترقيم النهائي.
  return paginate(result, query.pagination);
};

// يطبّق استعلام البحث (نفس منطق السرد مع فرض نص البحث).
export const applyProductSearch = (
  products: readonly Product[],
  query: ProductSearchQuery,
): PaginatedResult<Product> =>
  // نحوّل مصطلح البحث إلى الحقل العام search ثم نعيد استخدام منطق السرد.
  applyProductQuery(products, { ...query, search: query.term });

// يجمع التصنيفات المستخدمة فعليًا في قائمة منتجات (لبناء الفلاتر).
export const usedCategoryIds = (products: readonly Product[]): readonly string[] =>
  // مجموعة تمنع التكرار ثم تُحوَّل لمصفوفة.
  [...new Set(products.map((product) => String(product.categoryId)))];
