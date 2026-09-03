/**
 * عقود مجال السلة — PHASE 31 · أقسام 14 و15.
 * السلة كيان ثابت (Immutable): كل عملية تُنتج سلة جديدة، فتكون الحسابات
 * حتمية (Deterministic) وقابلة للاختبار بلا حالة خفية.
 */
import type {
  CartId,
  CartItemId,
  CurrencyCode,
  ISODateTime,
  Money,
  ProductId,
  StoreId,
  TenantId,
} from '@/sdk/core';

// نوع الخصم: نسبة مئوية أو مبلغ ثابت.
export type DiscountType = 'percentage' | 'fixed';

// خصم مطبَّق على بند أو على السلة كاملة.
export interface Discount {
  readonly type: DiscountType; // نوع الخصم.
  readonly value: number; // القيمة (نسبة 0..100 أو مبلغ).
  readonly reasonKey?: string; // مفتاح سبب الخصم (للتدقيق والإيصال).
}

// ضريبة مطبَّقة (نسبة + شمولها في السعر).
export interface Tax {
  readonly ratePercent: number; // نسبة الضريبة (0..100).
  readonly inclusive: boolean; // هل السعر شامل الضريبة أصلًا؟
  readonly nameKey?: string; // مفتاح اسم الضريبة (ضريبة القيمة المضافة…).
}

// لقطة تسعير محفوظة لحظة الإضافة (لا يتغيّر سعر البند إن تغيّر الكتالوج).
export interface PricingSnapshot {
  readonly unitPrice: Money; // سعر الوحدة وقت الإضافة.
  readonly capturedAt: ISODateTime; // لحظة اللقطة.
  readonly taxIncluded: boolean; // هل السعر كان شاملًا؟
}

// بند في السلة.
export interface CartItem {
  readonly id: CartItemId; // معرّف البند داخل السلة.
  readonly productId: ProductId; // المنتج.
  readonly sku: string; // رمز الصنف (مرجع للإيصال).
  readonly nameAr: string; // الاسم العربي (لقطة عرض).
  readonly nameEn: string; // الاسم الإنجليزي.
  readonly quantity: number; // الكمية.
  readonly unitPrice: Money; // سعر الوحدة.
  readonly pricing: PricingSnapshot; // لقطة التسعير.
  readonly discount?: Discount; // خصم البند (اختياري).
  readonly tax?: Tax; // ضريبة البند (اختيارية — تُشتق من المتجر عادة).
  readonly maxQuantity: number; // أقصى كمية متاحة (رصيد المخزون).
}

// السلة كاملة.
export interface Cart {
  readonly id: CartId; // المعرّف.
  readonly tenantId?: TenantId; // المستأجر.
  readonly storeId?: StoreId; // المتجر (تُصفَّر السلة عند تبديله).
  readonly currency: CurrencyCode; // عملة كل البنود.
  readonly items: readonly CartItem[]; // البنود.
  readonly discount?: Discount; // خصم على مستوى السلة.
  readonly taxRatePercent: number; // نسبة ضريبة المتجر المطبَّقة.
  readonly createdAt: ISODateTime; // لحظة الإنشاء.
  readonly updatedAt: ISODateTime; // آخر تعديل.
}

// إجماليات السلة (كلها Money بنفس العملة).
export interface CartTotals {
  readonly itemCount: number; // عدد البنود المختلفة.
  readonly totalQuantity: number; // مجموع الكميات.
  readonly subtotal: Money; // مجموع قيم البنود قبل الخصم.
  readonly itemDiscounts: Money; // مجموع خصومات البنود.
  readonly cartDiscount: Money; // خصم السلة العام.
  readonly totalDiscount: Money; // إجمالي الخصم (بنود + سلة).
  readonly netTotal: Money; // الصافي بعد الخصم قبل إضافة الضريبة غير الشاملة.
  readonly taxAmount: Money; // مبلغ الضريبة.
  readonly total: Money; // الإجمالي النهائي المستحق.
  readonly isEmpty: boolean; // هل السلة فارغة؟
}

// أسباب فشل عمليات السلة (تُترجَم في الواجهة).
export type CartErrorReason =
  | 'EMPTY_CART' // عملية على سلة فارغة.
  | 'ITEM_NOT_FOUND' // البند غير موجود.
  | 'EXCEEDS_STOCK' // الكمية تتجاوز الرصيد.
  | 'INVALID_QUANTITY' // كمية غير صالحة.
  | 'INVALID_DISCOUNT' // خصم غير صالح.
  | 'DISCOUNT_EXCEEDS_TOTAL' // الخصم الثابت يتجاوز الإجمالي.
  | 'CURRENCY_MISMATCH' // عملة البند تخالف عملة السلة.
  | 'PRODUCT_INACTIVE'; // المنتج غير نشط للبيع.

// حدود قواعد السلة (مشتركة بين المحرّك والتحقق).
export const CART_LIMITS = Object.freeze({
  MIN_QUANTITY: 1, // أقل كمية للبند.
  MAX_QUANTITY: 999, // أقصى كمية للبند.
  MAX_DISCOUNT_PERCENT: 100, // أقصى نسبة خصم.
  MAX_ITEMS: 200, // أقصى عدد بنود في سلة واحدة.
});
