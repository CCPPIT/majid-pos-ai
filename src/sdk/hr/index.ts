/**
 * مجال الموارد البشرية — PHASE 31 · قسم 27.
 */
import type {
  AsyncResult,
  AuditableFields,
  DateRange,
  EmployeeId,
  ISODateTime,
  Money,
  PaginatedResult,
  QueryOptions,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';

// حالة الموظف.
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

// نوع سجل الحضور.
export type AttendanceKind = 'check_in' | 'check_out' | 'absence' | 'leave';

// كيان الموظف.
export interface Employee extends TenantScopedFields, AuditableFields {
  readonly id: EmployeeId; // المعرّف.
  readonly userId?: UserId; // حساب المستخدم المرتبط.
  readonly fullName: string; // الاسم.
  readonly jobTitle: string; // المسمّى الوظيفي.
  readonly phone?: string; // الهاتف.
  readonly salary: Money; // الراتب الأساسي.
  readonly status: EmployeeStatus; // الحالة.
  readonly hiredAt: ISODateTime; // تاريخ التعيين.
}

// سجل حضور.
export interface AttendanceRecord extends TenantScopedFields {
  readonly id: string; // المعرّف.
  readonly employeeId: EmployeeId; // الموظف.
  readonly kind: AttendanceKind; // نوع السجل.
  readonly at: ISODateTime; // لحظته.
  readonly note?: string; // ملاحظة.
}

// استعلام سرد الموظفين.
export interface EmployeeQuery extends QueryOptions {
  readonly status?: EmployeeStatus; // تضييق بالحالة.
}

// مستودع الموارد البشرية.
export interface HrRepository {
  // يسرد الموظفين.
  listEmployees(query?: EmployeeQuery): AsyncResult<PaginatedResult<Employee>>;
  // يجلب موظفًا.
  getEmployee(id: EmployeeId): AsyncResult<Employee>;
  // يسجّل حضورًا/انصرافًا.
  recordAttendance(record: Omit<AttendanceRecord, 'id'>): AsyncResult<AttendanceRecord>;
  // يقرأ سجلات حضور موظف في فترة.
  getAttendance(employeeId: EmployeeId, range: DateRange): AsyncResult<readonly AttendanceRecord[]>;
}

// هل الموظف متاح للعمل الآن؟ (دالة نقية).
export const isAvailable = (employee: Employee): boolean => employee.status === 'active';
