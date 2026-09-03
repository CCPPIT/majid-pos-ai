/**
 * معرّفات مُوسَمة (Branded Typed Identifiers) — PHASE 31 · قسم 08.
 * الهدف: منع تمرير معرّف مجال مكان معرّف مجال آخر أثناء الترجمة (Compile Time).
 * كل معرّف نصّ في وقت التشغيل، لكنه نوع مستقل تمامًا في وقت الترجمة.
 * ممنوع استخدام `any` للهويات الأساسية (قسم 43).
 */

// الوسم العام: يضيف علامة نوعية غير موجودة فعليًا في وقت التشغيل (Nominal Typing).
export type Brand<TValue, TBrand extends string> = TValue & {
  // خاصية وهمية للقراءة فقط تميّز النوع ولا تُنشأ في الذاكرة إطلاقًا.
  readonly __brand: TBrand;
};

// معرّف المستخدم (صاحب الجلسة أو المنفّذ للعملية).
export type UserId = Brand<string, 'UserId'>;
// معرّف المستأجر (حساب SaaS الجذري الذي يعزل كل البيانات).
export type TenantId = Brand<string, 'TenantId'>;
// معرّف المؤسسة داخل المستأجر.
export type OrganizationId = Brand<string, 'OrganizationId'>;
// معرّف الفرع داخل المؤسسة.
export type BranchId = Brand<string, 'BranchId'>;
// معرّف المتجر (نقطة البيع/المستودع) داخل الفرع.
export type StoreId = Brand<string, 'StoreId'>;
// معرّف المستودع المخزني (قد يختلف عن المتجر في التوسعات القادمة).
export type WarehouseId = Brand<string, 'WarehouseId'>;
// معرّف الدور في نظام الصلاحيات.
export type RoleId = Brand<string, 'RoleId'>;
// معرّف الإذن القانوني.
export type PermissionId = Brand<string, 'PermissionId'>;
// معرّف المنتج في الكتالوج.
export type ProductId = Brand<string, 'ProductId'>;
// معرّف متغيّر المنتج (لون/حجم/وحدة).
export type ProductVariantId = Brand<string, 'ProductVariantId'>;
// معرّف تصنيف المنتجات.
export type CategoryId = Brand<string, 'CategoryId'>;
// معرّف عملية البيع (الفاتورة).
export type SaleId = Brand<string, 'SaleId'>;
// معرّف بند البيع داخل الفاتورة.
export type SaleLineId = Brand<string, 'SaleLineId'>;
// معرّف السلة النشطة.
export type CartId = Brand<string, 'CartId'>;
// معرّف بند داخل السلة.
export type CartItemId = Brand<string, 'CartItemId'>;
// معرّف الدفعة المالية.
export type PaymentId = Brand<string, 'PaymentId'>;
// معرّف عملية الاسترجاع.
export type RefundId = Brand<string, 'RefundId'>;
// معرّف حركة المخزون.
export type StockMovementId = Brand<string, 'StockMovementId'>;
// معرّف العميل.
export type CustomerId = Brand<string, 'CustomerId'>;
// معرّف المورّد.
export type SupplierId = Brand<string, 'SupplierId'>;
// معرّف أمر الشراء.
export type PurchaseOrderId = Brand<string, 'PurchaseOrderId'>;
// معرّف طلب الشراء (ما قبل أمر الشراء).
export type PurchaseRequestId = Brand<string, 'PurchaseRequestId'>;
// معرّف الموظف.
export type EmployeeId = Brand<string, 'EmployeeId'>;
// معرّف الحساب المالي في دليل الحسابات.
export type AccountId = Brand<string, 'AccountId'>;
// معرّف القيد/الحركة المالية.
export type TransactionId = Brand<string, 'TransactionId'>;
// معرّف الجهاز (لربط الجلسة والتدقيق بالجهاز).
export type DeviceId = Brand<string, 'DeviceId'>;
// معرّف العملية التجارية الواحدة (تتبّع من الطلب حتى الأثر — قسم 67).
export type OperationId = Brand<string, 'OperationId'>;
// معرّف الطلب الشبكي/الاستدعاء (Correlation ID).
export type RequestId = Brand<string, 'RequestId'>;
// معرّف محادثة/طلب الذكاء الاصطناعي.
export type AIRequestId = Brand<string, 'AIRequestId'>;
// معرّف الإشعار.
export type NotificationId = Brand<string, 'NotificationId'>;
// معرّف حدث المجال.
export type EventId = Brand<string, 'EventId'>;

// دالة عامة تُحوّل نصًّا خامًا إلى معرّف مُوسَم عند حدود النظام فقط.
const brand = <TId extends string>(value: string): TId => value as TId;

// محوّلات صريحة لكل معرّف (تُستخدم عند القراءة من التخزين/الشبكة/الواجهة).
export const asUserId = (value: string): UserId => brand<UserId>(value);
export const asTenantId = (value: string): TenantId => brand<TenantId>(value);
export const asOrganizationId = (value: string): OrganizationId => brand<OrganizationId>(value);
export const asBranchId = (value: string): BranchId => brand<BranchId>(value);
export const asStoreId = (value: string): StoreId => brand<StoreId>(value);
export const asWarehouseId = (value: string): WarehouseId => brand<WarehouseId>(value);
export const asRoleId = (value: string): RoleId => brand<RoleId>(value);
export const asPermissionId = (value: string): PermissionId => brand<PermissionId>(value);
export const asProductId = (value: string): ProductId => brand<ProductId>(value);
export const asProductVariantId = (value: string): ProductVariantId => brand<ProductVariantId>(value);
export const asCategoryId = (value: string): CategoryId => brand<CategoryId>(value);
export const asSaleId = (value: string): SaleId => brand<SaleId>(value);
export const asSaleLineId = (value: string): SaleLineId => brand<SaleLineId>(value);
export const asCartId = (value: string): CartId => brand<CartId>(value);
export const asCartItemId = (value: string): CartItemId => brand<CartItemId>(value);
export const asPaymentId = (value: string): PaymentId => brand<PaymentId>(value);
export const asRefundId = (value: string): RefundId => brand<RefundId>(value);
export const asStockMovementId = (value: string): StockMovementId => brand<StockMovementId>(value);
export const asCustomerId = (value: string): CustomerId => brand<CustomerId>(value);
export const asSupplierId = (value: string): SupplierId => brand<SupplierId>(value);
export const asPurchaseOrderId = (value: string): PurchaseOrderId => brand<PurchaseOrderId>(value);
export const asPurchaseRequestId = (value: string): PurchaseRequestId => brand<PurchaseRequestId>(value);
export const asEmployeeId = (value: string): EmployeeId => brand<EmployeeId>(value);
export const asAccountId = (value: string): AccountId => brand<AccountId>(value);
export const asTransactionId = (value: string): TransactionId => brand<TransactionId>(value);
export const asDeviceId = (value: string): DeviceId => brand<DeviceId>(value);
export const asOperationId = (value: string): OperationId => brand<OperationId>(value);
export const asRequestId = (value: string): RequestId => brand<RequestId>(value);
export const asAIRequestId = (value: string): AIRequestId => brand<AIRequestId>(value);
export const asNotificationId = (value: string): NotificationId => brand<NotificationId>(value);
export const asEventId = (value: string): EventId => brand<EventId>(value);

// يُرجع القيمة النصية الخام من أي معرّف مُوسَم (عند الكتابة للتخزين/الشبكة).
export const idToString = (value: Brand<string, string>): string => value as string;

// يقارن معرّفين مُوسَمين (أو معرّفًا بنصّ خام) مقارنة نصّية آمنة.
export const idEquals = (left: string | undefined, right: string | undefined): boolean =>
  // معرّفان غير معرّفين لا يُعتبران متساويين حتى لا تمرّ مطابقات فارغة.
  left !== undefined && right !== undefined && String(left) === String(right);

// يتحقق أن النص صالح كمعرّف (غير فارغ بعد إزالة الفراغات).
export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
