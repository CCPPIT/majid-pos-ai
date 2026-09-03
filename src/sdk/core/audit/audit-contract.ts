/**
 * عقد التدقيق — PHASE 31 · قسم 41.
 * كل عملية حسّاسة يجب أن تكون قابلة للتدقيق: من فعل ماذا، على أي مورد،
 * في أي نطاق، ومتى، وما النتيجة. الـSDK يبني الحدث؛ التخزين مسؤولية المضيف
 * (مستودع التدقيق القائم منذ PHASE 27) — لا يفرض الـSDK مزوّدًا واحدًا.
 */
import type { ISODateTime } from '../types/datetime';
import type {
  BranchId,
  OrganizationId,
  StoreId,
  TenantId,
  UserId,
} from '../identifiers/ids';

// نتيجة العملية المُدقَّقة.
export type AuditResult = 'success' | 'failure' | 'denied';

// حدث تدقيق كامل الحقول (قسم 41).
export interface AuditEvent {
  readonly actor: UserId | 'system'; // المنفّذ (مستخدم أو النظام).
  readonly tenantId?: TenantId; // المستأجر.
  readonly organizationId?: OrganizationId; // المؤسسة.
  readonly branchId?: BranchId; // الفرع.
  readonly storeId?: StoreId; // المتجر.
  readonly action: string; // الإجراء (sale.create · inventory.adjust…).
  readonly resource: string; // نوع المورد (sale · product · stock…).
  readonly resourceId?: string; // معرّف المورد المتأثر.
  readonly timestamp: ISODateTime; // لحظة التنفيذ.
  readonly result: AuditResult; // نتيجة التنفيذ.
  // بيانات إضافية آمنة (لا أسرار ولا بيانات دفع كاملة — قسم 65).
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
  readonly operationId?: string; // ربط الحدث بالعملية (قسم 67).
}

// مدخلات بناء حدث تدقيق (اللحظة والنتيجة لهما قيم افتراضية).
export interface AuditEventInput {
  readonly actor: UserId | 'system'; // المنفّذ.
  readonly action: string; // الإجراء.
  readonly resource: string; // المورد.
  readonly resourceId?: string; // معرّفه.
  readonly result?: AuditResult; // النتيجة (افتراضي: نجاح).
  readonly tenantId?: TenantId; // المستأجر.
  readonly organizationId?: OrganizationId; // المؤسسة.
  readonly branchId?: BranchId; // الفرع.
  readonly storeId?: StoreId; // المتجر.
  readonly metadata?: Record<string, string | number | boolean>; // بيانات إضافية.
  readonly operationId?: string; // معرّف العملية.
  readonly timestamp?: ISODateTime; // لحظة مخصّصة (للاختبارات).
}

// مفاتيح ممنوعة في بيانات التدقيق (حماية من تسريب أسرار — قسم 65).
const FORBIDDEN_METADATA_KEYS = ['token', 'pin', 'password', 'secret', 'cardnumber', 'cvv', 'otp'];

// يُزيل أي مفتاح حساس من البيانات الإضافية قبل التسجيل.
const sanitizeMetadata = (
  metadata: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> =>
  // نبني كائنًا جديدًا يحوي المفاتيح الآمنة فقط.
  Object.fromEntries(
    Object.entries(metadata).filter(
      // نستبعد أي مفتاح يحتوي كلمة حساسة بعد التطبيع.
      ([key]) => !FORBIDDEN_METADATA_KEYS.some((banned) => key.toLowerCase().replace(/[_\s-]/g, '').includes(banned)),
    ),
  );

// يبني حدث تدقيق مُطهَّرًا وجاهزًا للتخزين.
export const createAuditEvent = (input: AuditEventInput): AuditEvent => ({
  // المنفّذ كما مُرّر.
  actor: input.actor,
  // حقول النطاق (تُملأ من سياق الـSDK عادةً).
  tenantId: input.tenantId,
  organizationId: input.organizationId,
  branchId: input.branchId,
  storeId: input.storeId,
  // وصف الإجراء والمورد.
  action: input.action,
  resource: input.resource,
  resourceId: input.resourceId,
  // اللحظة: المُمرَّرة أو الآن.
  timestamp: input.timestamp ?? new Date().toISOString(),
  // النتيجة الافتراضية نجاح.
  result: input.result ?? 'success',
  // البيانات الإضافية بعد التطهير والتجميد.
  metadata: Object.freeze(sanitizeMetadata(input.metadata ?? {})),
  // معرّف العملية للربط بالتتبّع.
  operationId: input.operationId,
});

// مُسجّل التدقيق: عقد ينفّذه المضيف لتخزين الأحداث حيث يشاء.
export interface AuditLogger {
  // يسجّل حدث تدقيق (لا يُعيد نتيجة: التدقيق لا يعطّل العملية الأصلية).
  record(event: AuditEvent): void;
}

// مُسجّل صامت: الافتراضي حين لا يربط المضيف مخزّنًا للتدقيق.
export const noopAuditLogger: AuditLogger = {
  // نتجاهل الحدث عمدًا حتى يعمل الـSDK مستقلًا في الاختبارات.
  record: () => undefined,
};

// مُسجّل يجمع الأحداث في الذاكرة (يُستخدم في الاختبارات والتحقق من العقود).
export const createInMemoryAuditLogger = (): AuditLogger & { events: readonly AuditEvent[] } => {
  // مخزن الأحداث المسجّلة.
  const events: AuditEvent[] = [];
  return {
    // الإضافة المباشرة للمخزن.
    record: (event) => {
      events.push(event);
    },
    // كشف المخزن للقراءة في التأكيدات.
    events,
  };
};
