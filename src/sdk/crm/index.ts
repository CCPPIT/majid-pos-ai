/**
 * مجال إدارة علاقات العملاء — PHASE 31 · قسم 22.
 * يبني فوق مجال customers: الملاحظات والحملات والمتابعات.
 */
import type {
  AsyncResult,
  AuditableFields,
  CustomerId,
  ISODateTime,
  PaginatedResult,
  QueryOptions,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';
import type { ContactChannel } from '@/sdk/customers';

// نوع نشاط CRM.
export type CrmActivityType = 'note' | 'call' | 'visit' | 'campaign' | 'follow_up';

// نشاط مسجّل على ملف عميل.
export interface CrmActivity extends TenantScopedFields, AuditableFields {
  readonly id: string; // المعرّف.
  readonly customerId: CustomerId; // العميل.
  readonly type: CrmActivityType; // نوع النشاط.
  readonly summary: string; // ملخصه.
  readonly channel?: ContactChannel; // القناة المستخدمة.
  readonly performedBy?: UserId; // منفّذه.
  readonly occurredAt: ISODateTime; // لحظته.
  readonly followUpAt?: ISODateTime; // موعد المتابعة.
}

// استعلام أنشطة CRM.
export interface CrmActivityQuery extends QueryOptions {
  readonly customerId?: CustomerId; // أنشطة عميل محدد.
  readonly type?: CrmActivityType; // نوع محدد.
  readonly pendingFollowUp?: boolean; // المتابعات المستحقة فقط.
}

// مستودع CRM.
export interface CrmRepository {
  // يسرد الأنشطة.
  listActivities(query?: CrmActivityQuery): AsyncResult<PaginatedResult<CrmActivity>>;
  // يسجّل نشاطًا.
  recordActivity(activity: Omit<CrmActivity, 'id' | 'createdAt' | 'updatedAt'>): AsyncResult<CrmActivity>;
  // يقرأ المتابعات المستحقة حتى تاريخ.
  getDueFollowUps(until: ISODateTime): AsyncResult<readonly CrmActivity[]>;
}

// هل المتابعة مستحقة الآن؟ (دالة نقية).
export const isFollowUpDue = (activity: CrmActivity, now: ISODateTime): boolean => {
  // بلا موعد متابعة لا استحقاق.
  if (activity.followUpAt === undefined) return false;
  // المقارنة الزمنية.
  return new Date(activity.followUpAt).getTime() <= new Date(now).getTime();
};
