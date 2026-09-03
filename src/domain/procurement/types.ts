/**
 * أنواع مجال المشتريات (PHASE 18 — Procurement).
 * المورّدون وأوامر الشراء بدورة حياة واضحة:
 * مسودة → مُقدَّمة → معتمدة → مُستلَمة (جزئيًا/كليًا) أو ملغاة.
 * كل الحسابات النقدية تتم في core/money ولا تُمسّها الواجهة.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { Money, CurrencyCode } from '@/core/money/money';

// حالة أمر الشراء عبر دورة حياته.
export type PurchaseOrderStatus =
  | 'draft' // مسودة (قابلة للتعديل/الحذف).
  | 'submitted' // مُقدَّمة بانتظار الاعتماد.
  | 'approved' // معتمدة وجاهزة للاستلام.
  | 'partially_received' // استُلم جزء من الكميات.
  | 'received' // استُلمت كل الكميات (مكتمل).
  | 'cancelled'; // ملغى.

// كيان المورّد.
export interface Supplier extends Auditable {
  id: ID; // معرف المورّد.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  nameAr: string; // اسم المورّد بالعربية.
  nameEn: string; // اسم المورّد بالإنجليزية (اختياري، يرجع للعربي).
  contactName?: string; // اسم جهة الاتصال.
  phone?: string; // رقم الهاتف.
  email?: string; // البريد الإلكتروني.
  address?: string; // العنوان.
  taxNumber?: string; // الرقم الضريبي.
  currency: CurrencyCode; // عملة التعامل.
  active: boolean; // هل المورّد نشط؟
}

// سطر في أمر الشراء (صنف مطلوب بكمية وتكلفة وحدة).
export interface PurchaseOrderLine {
  productId: ID; // معرف المنتج في الكتالوج.
  nameAr: string; // لقطة اسم المنتج (عربي) لحظة الأمر.
  nameEn: string; // لقطة الاسم (إنجليزي).
  sku?: string; // رمز الصنف.
  barcode?: string; // الباركود.
  orderedQuantity: number; // الكمية المطلوبة.
  receivedQuantity: number; // الكمية المُستلَمة فعلًا.
  unitCost: Money; // تكلفة الوحدة الواحدة.
  lineTotal: Money; // إجمالي السطر (الكمية × التكلفة).
}

// أمر الشراء.
export interface PurchaseOrder extends Auditable {
  id: ID; // معرف الأمر.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر المستلم.
  poNumber: string; // الرقم المرجعي المنسّق (PO-0001).
  supplierId: ID; // معرف المورّد.
  supplierNameAr: string; // لقطة اسم المورّد.
  supplierNameEn: string; // لقطة اسم المورّد إنجليزي.
  status: PurchaseOrderStatus; // الحالة.
  lines: PurchaseOrderLine[]; // الأسطر.
  currency: CurrencyCode; // عملة الأمر.
  subtotal: Money; // مجموع الأسطر قبل الضريبة.
  taxRate: number; // نسبة الضريبة على المشتريات (0 = لا ضريبة).
  tax: Money; // قيمة الضريبة.
  total: Money; // الإجمالي النهائي.
  notes?: string; // ملاحظات.
  expectedDate?: ISODateString; // تاريخ التوريد المتوقع.
  submittedAt?: ISODateString; // لحظة التقديم.
  approvedAt?: ISODateString; // لحظة الاعتماد.
  approvedBy?: ID; // من اعتمد الأمر.
  receivedAt?: ISODateString; // لحظة إكمال الاستلام.
  cancelledAt?: ISODateString; // لحظة الإلغاء.
}

// نموذج إدخال مورّد (من الشاشة).
export interface SupplierDraft {
  nameAr: string; // الاسم عربي.
  nameEn: string; // الاسم إنجليزي.
  contactName: string; // جهة الاتصال.
  phone: string; // الهاتف.
  email: string; // البريد.
  address: string; // العنوان.
  taxNumber: string; // الرقم الضريبي.
  currency: CurrencyCode; // العملة.
}

// سطر خام أثناء بناء الأمر (كمية + تكلفة كنص من الشاشة).
export interface DraftOrderLine {
  productId: ID; // المنتج.
  nameAr: string; // الاسم عربي.
  nameEn: string; // الاسم إنجليزي.
  sku?: string; // SKU.
  barcode?: string; // الباركود.
  quantity: number; // الكمية.
  unitCostAmount: number; // تكلفة الوحدة.
}

// طلب إنشاء أمر شراء.
export interface CreatePurchaseOrderInput {
  supplierId: ID; // المورّد.
  supplierNameAr: string; // اسم المورّد.
  supplierNameEn: string; // اسم المورّد إنجليزي.
  lines: DraftOrderLine[]; // الأسطر الخام.
  currency: CurrencyCode; // العملة.
  taxRate: number; // نسبة الضريبة.
  notes?: string; // ملاحظات.
  expectedDate?: ISODateString; // تاريخ متوقع.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  createdBy?: ID; // المنشئ.
  sequence: number; // الرقم التسلسلي.
}

// نتيجة فحص الانتقال بين حالات الأمر.
export interface TransitionResult {
  allowed: boolean; // هل الانتقال مسموح؟
  reason?: string; // سبب المنع (مفتاح i18n).
}
