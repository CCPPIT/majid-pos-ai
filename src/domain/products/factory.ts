/**
 * مُصنِّع كيان المنتج من نموذج الإدخال (PHASE 16).
 * يبني Product كاملًا بالمعرّفات والهرمية وحالة المخزون المشتقة من الكمية.
 */
import { asId, type ID } from '@/core/types/domain';
import { draftValues, type ProductDraft } from './validation';
import type { Product, ProductStockStatus } from './types';

// سياق الإنشاء (الهرمية النشطة).
export interface ProductFactoryContext {
  tenantId: ID;
  organizationId?: ID;
  branchId?: ID;
  storeId?: ID;
  sequence?: number; // رقم تسلسلي لتوليد المعرف (المستودع يمرره دائمًا).
}

// يشتق حالة المخزون من الكمية (مُصدَّرة ليستخدمها مجال المخزون أيضًا — PHASE 17).
export function stockStatusForQuantity(quantity: number): ProductStockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= 5) return 'low_stock';
  return 'in_stock';
}

// يبني منتجًا جديدًا من النموذج.
export function createProductFromDraft(
  draft: ProductDraft,
  ctx: ProductFactoryContext,
  now: string = new Date().toISOString(),
): Product {
  const values = draftValues(draft);
  const id: ID = asId(`product-${Date.now()}-${ctx.sequence ?? 0}`);
  return {
    id,
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    storeId: ctx.storeId,
    sku: values.sku,
    barcode: draft.barcode.trim(),
    nameAr: draft.nameAr.trim(),
    nameEn: draft.nameEn.trim() || draft.nameAr.trim(), // رجوع للعربي إن تُرك الإنجليزي.
    categoryId: draft.categoryId,
    price: { amount: values.priceAmount, currency: draft.currency },
    taxIncluded: draft.taxIncluded,
    stockStatus: stockStatusForQuantity(values.stockQuantity),
    stockQuantity: values.stockQuantity,
    imageIcon: draft.imageIcon ?? 'cube-outline',
    createdAt: now,
    updatedAt: now,
  };
}

// يحدّث منتجًا قائمًا بقيم النموذج (يحافظ على المعرف والهرمية والتواريخ).
export function applyDraftToProduct(
  existing: Product,
  draft: ProductDraft,
  now: string = new Date().toISOString(),
): Product {
  const values = draftValues(draft);
  return {
    ...existing,
    sku: values.sku,
    barcode: draft.barcode.trim(),
    nameAr: draft.nameAr.trim(),
    nameEn: draft.nameEn.trim() || draft.nameAr.trim(),
    categoryId: draft.categoryId,
    price: { amount: values.priceAmount, currency: draft.currency },
    taxIncluded: draft.taxIncluded,
    stockStatus: stockStatusForQuantity(values.stockQuantity),
    stockQuantity: values.stockQuantity,
    imageIcon: draft.imageIcon ?? existing.imageIcon,
    updatedAt: now,
  };
}

// يحدّث مستوى مخزون منتج قائم فقط (PHASE 17 — يُستخدم من حركات المخزون).
export function withStockLevel(product: Product, quantity: number, now: string = new Date().toISOString()): Product {
  return {
    ...product,
    stockQuantity: Math.max(0, Math.trunc(quantity)),
    stockStatus: stockStatusForQuantity(quantity),
    updatedAt: now,
  };
}

// يحوّل منتجًا قائمًا إلى نموذج إدخال (لفتح التعديل).
export function productToDraft(product: Product): ProductDraft {
  return {
    nameAr: product.nameAr,
    nameEn: product.nameEn === product.nameAr ? '' : product.nameEn,
    barcode: product.barcode,
    sku: product.sku,
    categoryId: product.categoryId,
    priceAmount: String(product.price.amount),
    currency: product.price.currency,
    taxIncluded: product.taxIncluded,
    stockQuantity: String(product.stockQuantity),
    imageIcon: product.imageIcon,
  };
}
