/**
 * المعرّفات المُوسَمة (Branded IDs) — PHASE 32 · قسم 42.
 *
 * المعرّف في العقود ليس مجرد نص: وسم النوع يمنع تمرير ProductId مكان
 * SaleId وقت الترجمة، ويلغي صنفًا كاملًا من الأخطاء المنطقية.
 * الطبقة إطار-محايدة: لا تستورد من الـSDK ولا من أي مجال أعلى (قسم 75).
 */

// علامة الوسم الفريدة لكل نوع معرّف (توجد وقت الترجمة فقط).
declare const brand: unique symbol;

// يحمل النوع المُوسَم وسمًا مميزًا لهويته دون تغيير شكله وقت التشغيل.
export type Branded<TType, TBrand extends string> = TType & {
  readonly [brand]: TBrand;
};

// يبني معرّفًا مُوسَمًا من نص خام (قيمته تبقى النص الأصلي وقت التشغيل).
export const brandId = <TBrand extends string>(value: string) =>
  value as Branded<string, TBrand>;

// المعرّفات المدعومة عبر مجالات المنصّة (كل منها وسم مستقل).
export type TenantId = Branded<string, 'TenantId'>; // المستأجر.
export type OrganizationId = Branded<string, 'OrganizationId'>; // المؤسسة.
export type BranchId = Branded<string, 'BranchId'>; // الفرع.
export type StoreId = Branded<string, 'StoreId'>; // المتجر.
export type UserId = Branded<string, 'UserId'>; // المستخدم.
export type ProductId = Branded<string, 'ProductId'>; // المنتج.
export type ProductVariantId = Branded<string, 'ProductVariantId'>; // متغيّر المنتج.
export type CategoryId = Branded<string, 'CategoryId'>; // التصنيف.
export type SaleId = Branded<string, 'SaleId'>; // فاتورة البيع.
export type PaymentId = Branded<string, 'PaymentId'>; // الدفعة.
export type CartId = Branded<string, 'CartId'>; // السلة.
export type CustomerId = Branded<string, 'CustomerId'>; // العميل.
export type InventoryItemId = Branded<string, 'InventoryItemId'>; // صنف المخزون.
export type EmployeeId = Branded<string, 'EmployeeId'>; // الموظف.
export type AIRequestId = Branded<string, 'AIRequestId'>; // طلب الذكاء الاصطناعي.
export type CommandId = Branded<string, 'CommandId'>; // معرّف الأمر غير المتصل.
export type EventId = Branded<string, 'EventId'>; // معرّف الحدث.

// يحوّل أي معرّف مُوسَم إلى نصّه الخام (للعرض/التخزين).
export const idToString = (id: Branded<string, string>): string => id as unknown as string;

// مقارنة معرّفين مُوسَمين من نفس النوع (قيمة نصية).
export const idEquals = (left: Branded<string, string>, right: Branded<string, string>): boolean =>
  idToString(left) === idToString(right);

// فحص وقت التشغيل: هل القيمة نصّ غير فارغ يصلح معرّفًا؟
export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
