/**
 * البيانات الوصفية للعقود والاستجابات — PHASE 32 · أقسام 08 · 28 · 42 · 65–70.
 *
 * كل استجابة علنية وكل عملية مهمة تحمل بطاقة وصفية تتيح:
 *  • تتبّع الطلب عبر الطبقات (requestId / operationId) — قسم 68.
 *  • معرفة نسخة العقد والـSDK التي أنتجت البيانات — أقسام 08 و09.
 *  • حمل نطاق المستأجر/المتجر دون تجاوز الحدود — قسم 42.
 *  • وسم تصنيف الخصوصية لإخفاء الحقول الحساسة من السجلات — أقسام 65–67.
 */
import type { Branded, StoreId, TenantId } from '../primitives/ids';

// طابع زمني بصيغة ISO (نص شفاف في العقود).
export type ISODateTime = string;

// مستوى استقرار العقد — أقسام 46 و47.
export type StabilityLevel =
  | 'experimental' // تجريبي: غير مستقر، قد يتغيّر دون إشعار كاسر.
  | 'alpha' // ألفا: مسودة مبكرة.
  | 'beta' // بيتا: شبه مستقر.
  | 'stable' // مستقر: محمي بقواعد الإصدار الدلالي.
  | 'deprecated'; // مهجور: موثّق بموعد إزالة وبديل (قسم 19).

// تصنيف سرية/خصوصية الحمولة — قسم 67.
export type PrivacyLevel =
  | 'public' // عام: لا حساسية.
  | 'internal' // داخلي: بيانات تشغيلية.
  | 'confidential' // سري: بيانات أعمال حساسة.
  | 'restricted'; // مقيّد: بيانات شخصية/دفع (PII).

// بطاقة تعريف العقد العلني — قسم 08.
export interface ContractMetadata {
  readonly contractName: string; // الاسم الموحّد للعقد (مثل: @majid/contracts/products/Product).
  readonly contractVersion: string; // نسخة العقد الدلالية (X.Y.Z).
  readonly domain: string; // اسم المجال المالك (products · sales · payments…).
  readonly stability: StabilityLevel; // مستوى الاستقرار — قسم 47.
  readonly description?: string; // وصف بشري يغذّي توليد التوثيق لاحقًا — قسم 71.
}

// الحقول الإلزامية لنطاق تعدّد المستأجرين — قسم 42.
export interface TenantScope {
  readonly tenantId: TenantId; // المستأجر صاحب البيانات (لا عبور بين المستأجرين).
  readonly organizationId?: Branded<string, 'OrganizationId'>; // المؤسسة.
  readonly branchId?: Branded<string, 'BranchId'>; // الفرع.
  readonly storeId?: StoreId; // المتجر.
}

// بيانات تتبّع ومراقبة تُرفق بكل عملية — قسم 68.
export interface OperationTrace {
  readonly requestId?: string; // معرّف الطلب الواحد (يتدفق عبر الطبقات).
  readonly operationId?: string; // معرّف العملية المنطقية (قد يضم عدة طلبات).
  readonly timestamp?: ISODateTime; // لحظة إنتاج الاستجابة.
  readonly durationMs?: number; // زمن التنفيذ بالميللي ثانية.
  readonly traceId?: string; // معرّف تتبّع موزّع (مستقبلي).
}

// بيانات خصوصية الحمولة — أقسام 65 و66 و67.
export interface PrivacyMetadata {
  readonly dataClassification: PrivacyLevel; // تصنيف الحمولة.
  readonly requiresConsent?: boolean; // هل تتطلب موافقة المستخدم قبل إرسالها للذكاء؟
  readonly sensitiveFields?: readonly string[]; // أسماء الحقول الحساسة (PII) لتُقنّع في السجلات.
}

// بطاقة الاستجابة المعيارية — قسم 28.
export interface ResponseMetadata {
  readonly contractVersion: string; // نسخة العقد المنتِجة.
  readonly sdkVersion: string; // نسخة الـSDK المنتِجة.
  readonly requestId?: string; // معرّف الطلب.
  readonly operationId?: string; // معرّف العملية.
  readonly timestamp: ISODateTime; // لحظة الإنتاج.
  readonly trace?: OperationTrace; // تفاصيل تتبّع إضافية.
}

// الاستجابة المعيارية للـSDK — قسم 28: { data, metadata? }.
export interface SDKResponse<T> {
  readonly data: T; // الحمولة المُطبَّعة (مُتحقَّق منها بـZod قبل الوصول هنا).
  readonly metadata: ResponseMetadata; // بطاقة الإصدار والتتبّع.
}

// يبني بطاقة بيانات وصفية لعقد علني (تُستخدم في تعريف كل عقد).
export const defineContractMetadata = (input: {
  readonly contractName: string; // اسم العقد الموحّد.
  readonly contractVersion: string; // نسخته الدلالية.
  readonly domain: string; // مجاله.
  readonly stability?: StabilityLevel; // مستقر افتراضيًا.
  readonly description?: string; // وصفه.
}): ContractMetadata =>
  // نعيد كائنًا مجمّدًا يحمي الثوابت من التعديل.
  Object.freeze({
    contractName: input.contractName,
    contractVersion: input.contractVersion,
    domain: input.domain,
    stability: input.stability ?? 'stable',
    description: input.description,
  });
