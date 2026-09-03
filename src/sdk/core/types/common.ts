/**
 * أنواع مشتركة عبر كل مجالات الـSDK — PHASE 31 · أقسام 43 و45 و56.
 * ممنوع `any`؛ نستخدم unknown وgenerics واتحادات مميّزة وأنواعًا موسومة.
 */
import type { ISODateTime } from './datetime';
import type { Filter, FilterGroup } from '../filters/filters';
import type { Sort } from '../sorting/sorting';
import type { Pagination } from '../pagination/pagination';
import type {
  BranchId,
  OrganizationId,
  StoreId,
  TenantId,
  UserId,
} from '../identifiers/ids';

// طوابع الإنشاء والتعديل على كل كيان مُدار.
export interface AuditableFields {
  readonly createdAt: ISODateTime; // لحظة الإنشاء.
  readonly updatedAt: ISODateTime; // آخر تعديل.
  readonly createdBy?: UserId; // منشئ السجل.
  readonly updatedBy?: UserId; // آخر معدِّل.
}

// حقول العزل متعدد المستأجرين على كل كيان تجاري (قسم 58).
export interface TenantScopedFields {
  readonly tenantId: TenantId; // المستأجر (إلزامي — جذر العزل).
  readonly organizationId?: OrganizationId; // المؤسسة.
  readonly branchId?: BranchId; // الفرع.
  readonly storeId?: StoreId; // المتجر.
}

// نطاق استعلام يُمرَّر للمستودعات لتضييق البيانات حسب السياق.
export interface ScopeFilter {
  readonly tenantId?: TenantId; // المستأجر المطلوب.
  readonly organizationId?: OrganizationId; // المؤسسة.
  readonly branchId?: BranchId; // الفرع.
  readonly storeId?: StoreId; // المتجر.
}

// خيارات استعلام موحّدة لكل قوائم الـSDK (قسم 44 — API متسق).
export interface QueryOptions {
  readonly pagination?: Pagination; // الترقيم.
  readonly sort?: Sort | readonly Sort[]; // الترتيب.
  readonly filters?: FilterGroup | readonly Filter[]; // الفلاتر.
  readonly scope?: ScopeFilter; // تضييق النطاق.
  readonly search?: string; // بحث نصي حر.
}

/**
 * حالة تنفيذ العملية في بيئة Offline-First (قسم 56).
 * لا نبني محرك المزامنة الآن، لكن العقد يحتمل النتائج الأربع منذ اليوم.
 */
export type OperationOutcome =
  | 'completed' // نُفّذت وثُبّتت محليًا.
  | 'pending' // مُسجّلة محليًا وبانتظار المزامنة.
  | 'offline' // تعذّرت لعدم الاتصال وسُجّلت للإعادة.
  | 'failed'; // فشلت نهائيًا.

// غلاف نتيجة عملية كتابة: البيانات + حالة التنفيذ + بيانات التتبّع.
export interface MutationEnvelope<T> {
  readonly data: T; // الكيان الناتج.
  readonly outcome: OperationOutcome; // حالة التنفيذ.
  readonly operationId: string; // معرّف العملية للتتبّع (قسم 67).
  readonly occurredAt: ISODateTime; // لحظة التنفيذ المحلي.
  readonly pendingSync: boolean; // هل تنتظر مزامنة لاحقة؟
}

// بيانات تتبّع تُرفق بكل عملية أعمال (قسم 67 — Observability).
export interface OperationTrace {
  readonly operationId: string; // معرّف العملية.
  readonly requestId: string; // معرّف الاستدعاء (Correlation).
  readonly timestamp: ISODateTime; // لحظة البدء.
  readonly actorId?: UserId; // المنفّذ.
  readonly tenantId?: TenantId; // المستأجر.
  readonly operation: string; // اسم العملية (products.create…).
}

// نوع مساعد: يجعل كل الحقول اختيارية بعمق (مفيد للتحديثات الجزئية).
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// نوع مساعد: يجعل حقولًا محددة إلزامية داخل نوع اختياري.
export type RequireFields<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// اسم مستعار واضح لأي سجل بيانات خام قادم من مصدر خارجي (بدل any).
export type RawRecord = Record<string, unknown>;
