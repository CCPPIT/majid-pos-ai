/**
 * مخططات التحقق لمجال المنتجات — PHASE 31 · قسم 42.
 * كل أمر واستعلام يملك مخطط Zod: التحقق يقع في الـSDK لا في الشاشة،
 * فلا يمكن لأي مستهلك تجاوزه. الأخطاء تُحوَّل إلى ValidationError مع
 * خريطة حقول جاهزة للعرض في النموذج.
 */
import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/sdk/core';

// الحد الأقصى المعقول لسعر/تكلفة (حماية من إدخال خاطئ بأصفار زائدة).
const MAX_PRICE = 1_000_000_000;
// الحد الأقصى لكمية الرصيد الافتتاحي.
const MAX_QUANTITY = 1_000_000;

// مخطط نص غير فارغ بحد أدنى وأقصى (يُعاد استخدامه في كل الحقول النصية).
const requiredText = (min: number, max: number) =>
  z.string().trim().min(min, 'sdk.validation.required').max(max, 'sdk.validation.tooLong');

// مخطط كود العملة المغلق (لا يقبل إلا العملات المدعومة).
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

// مخطط الباركود: أرقام/حروف بطول معقول.
export const barcodeSchema = z
  .string()
  .trim()
  .min(4, 'sdk.validation.barcodeTooShort')
  .max(32, 'sdk.validation.barcodeTooLong')
  .regex(/^[A-Za-z0-9-]+$/, 'sdk.validation.barcodeFormat');

// مخطط رمز الصنف (SKU).
export const skuSchema = requiredText(2, 32);

// مخطط مبلغ نقدي موجب.
export const priceAmountSchema = z
  .number()
  .finite('sdk.validation.number')
  .nonnegative('sdk.validation.negativeAmount')
  .max(MAX_PRICE, 'sdk.validation.amountTooLarge');

// مخطط كمية صحيحة غير سالبة.
export const quantitySchema = z
  .number()
  .int('sdk.validation.integer')
  .nonnegative('sdk.validation.negativeQuantity')
  .max(MAX_QUANTITY, 'sdk.validation.quantityTooLarge');

// مخطط أمر إنشاء منتج.
export const createProductSchema = z.object({
  sku: skuSchema, // رمز الصنف.
  barcode: barcodeSchema, // الباركود.
  nameAr: requiredText(2, 120), // الاسم العربي.
  nameEn: requiredText(2, 120), // الاسم الإنجليزي.
  categoryId: requiredText(1, 64), // التصنيف.
  priceAmount: priceAmountSchema.positive('sdk.validation.pricePositive'), // السعر (موجب فعليًا).
  currency: currencySchema, // العملة.
  taxIncluded: z.boolean(), // شمول الضريبة.
  initialQuantity: quantitySchema, // الرصيد الافتتاحي.
  lowStockThreshold: quantitySchema.optional(), // حدّ التنبيه.
  costAmount: priceAmountSchema.optional(), // التكلفة.
  icon: z.string().trim().max(64).optional(), // الأيقونة.
});

// مخطط أمر تعديل منتج (كل الحقول اختيارية عدا المعرّف).
export const updateProductSchema = z.object({
  productId: requiredText(1, 64), // المنتج المستهدف.
  sku: skuSchema.optional(), // رمز الصنف.
  barcode: barcodeSchema.optional(), // الباركود.
  nameAr: requiredText(2, 120).optional(), // الاسم العربي.
  nameEn: requiredText(2, 120).optional(), // الاسم الإنجليزي.
  categoryId: requiredText(1, 64).optional(), // التصنيف.
  priceAmount: priceAmountSchema.positive('sdk.validation.pricePositive').optional(), // السعر.
  taxIncluded: z.boolean().optional(), // شمول الضريبة.
  lowStockThreshold: quantitySchema.optional(), // حدّ التنبيه.
  costAmount: priceAmountSchema.optional(), // التكلفة.
  icon: z.string().trim().max(64).optional(), // الأيقونة.
  active: z.boolean().optional(), // التفعيل.
});

// مخطط أمر حذف منتج.
export const deleteProductSchema = z.object({
  productId: requiredText(1, 64), // المنتج المستهدف.
});

// مخطط استعلام البحث.
export const productSearchSchema = z.object({
  term: z.string().trim().max(120, 'sdk.validation.tooLong'), // نص البحث.
  categoryId: z.string().trim().max(64).optional(), // التصنيف.
  activeOnly: z.boolean().optional(), // النشط فقط.
});

// مخطط استعلام الباركود.
export const productBarcodeSchema = z.object({
  barcode: barcodeSchema, // الباركود الممسوح.
});

/**
 * ملاحظة معمارية: `validateWith` و`toValidationError` كانتا معرَّفتين هنا،
 * وكانت بقية المجالات تستوردهما من `@/sdk/products` — اقتران أفقي بلا
 * مبرر. صار موطنهما النواة (`core/validation`)، ونعيد تصديرهما هنا
 * حفاظًا على المستوردين القائمين دون كسرهم.
 */
export { toValidationError, validateWith } from '@/sdk/core';
