/**
 * عقد المنتج — PHASE 32 · قسم 06 (Contract · Schema · DTO · Command · Query · Version).
 *
 * هذا هو العقد الموحّد للمنتج عبر الطبقات. النسخة الحالية 1.0.0، وقد
 * جهّزنا محوّل ProductV1→V2 يوضّح قاعدة التطوّر الآمن (قسم 17):
 * بدل تغيير price: number فجأة إلى Money، تُرحَّل البيانات القديمة.
 */
import { z } from 'zod';
import {
  contractName,
  domainContractVersion,
  type ProductId,
  type TenantId,
} from '../core';

// اسم العقد الموحّد ونسخته (قسم 44).
export const PRODUCT_CONTRACT_NAME = contractName('products', 'Product');
// نسخة العقد الحالية (مصدرها سجلّ نسخ المجالات — قسم 10).
export const PRODUCT_CONTRACT_VERSION = domainContractVersion('products');

/**
 * مخطط Zod لكيان المنتج — قسم 22.
 * النوع يُشتقّ من المخطط (z.infer) فلا ازدواج تعريف (قسم 22).
 */
export const productSchema = z.object({
  id: z.string().min(1), // المعرّف.
  tenantId: z.string().min(1), // المستأجر (عزل الحدود — قسم 42).
  sku: z.string().trim().min(2).max(32), // رمز الصنف.
  nameAr: z.string().trim().min(2).max(120), // الاسم العربي.
  nameEn: z.string().trim().min(2).max(120), // الاسم الإنجليزي.
  barcode: z.string().trim().min(4).max(32).optional(), // الباركود الأساسي.
  // السعر: رقم خام مع العملة (شكل V1 المتوافق).
  priceAmount: z.number().finite().nonnegative(), // قيمة السعر.
  currency: z.string().trim().length(3), // رمز العملة ISO.
  taxIncluded: z.boolean(), // هل السعر شامل الضريبة؟
  active: z.boolean(), // هل المنتج متاح للبيع؟
});

// نوع كيان المنتج المشتقّ من المخطط (مصدر الحقيقة الوحيد للشكل).
export type Product = z.infer<typeof productSchema> & {
  // معرّف موسوم وقت الترجمة (يُفرض عبر المصانع لا عبر Zod).
  readonly productId?: ProductId;
};

// مخطط أمر إنشاء منتج (قسم 31 — الأوامر مُنسَّخة).
export const createProductCommandSchema = productSchema
  .omit({ id: true, tenantId: true })
  .extend({
    // الرصيد الافتتاحي خاص بأمر الإنشاء لا بالكيان.
    initialQuantity: z.number().int().nonnegative().optional(),
  });

// نوع أمر الإنشاء.
export type CreateProductCommand = z.infer<typeof createProductCommandSchema>;

// مخطط استعلام البحث عن المنتجات (قسم 32 — الاستعلامات مُنسَّخة).
export const searchProductsQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional(), // كلمة البحث.
  categoryId: z.string().optional(), // تصنيف.
  activeOnly: z.boolean().optional(), // النشط فقط.
  page: z.number().int().positive().optional(), // رقم الصفحة.
  pageSize: z.number().int().positive().max(100).optional(), // حجم الصفحة.
});

// نوع استعلام البحث.
export type SearchProductsQuery = z.infer<typeof searchProductsQuerySchema>;

// واجهة مستودع المنتجات المُنسَّخة (قسم 35).
export interface ProductRepositoryContract {
  // يجلب منتجًا بمعرّفه.
  getById(id: ProductId): Promise<import('../core').ContractResult<Product>>;
  // يبحث منتجات وفق استعلام.
  search(query: SearchProductsQuery): Promise<import('../core').ContractResult<readonly Product[]>>;
}

// بطاقة العقد للوثائق والسجلّ (قسم 08 و71).
export const PRODUCT_CONTRACT_META = Object.freeze({
  name: PRODUCT_CONTRACT_NAME,
  version: PRODUCT_CONTRACT_VERSION,
  domain: 'products' as const,
  tenantScoped: true,
});

// مرجع نوعي للمستأجر (يستخدمه المصنع عند الحاجة).
export type { TenantId };
