/**
 * مستودع الموارد البشرية (PHASE 21).
 * يخفي المصدر عن الواجهة، يدير الموظفين (بحث/إنشاء/تعديل) والحضور
 * (بصمة دخول/خروج، منع تكرار الدخول، تجميع الملخصات). الحسابات في المجال.
 */
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import { logger } from '@/core/logging/logger';
import {
  applyDraftToEmployee,
  clockIn as buildClockIn,
  clockOut as closeClockOut,
  createEmployeeFromDraft,
  summarizeAttendance,
  validateEmployeeDraft,
  type AttendanceRecord,
  type AttendanceSummary,
  type Employee,
  type EmployeeDraft,
  type EmployeeQuery,
} from '@/domain/hr';
import type { HrSource } from '../sources/hr.source';

// سياق المنفّذ.
export interface HrActorContext {
  tenantId: ID;
  organizationId?: ID;
  branchId?: ID;
  storeId?: ID;
  userId?: ID;
  currency: string;
}

// واجهة المستودع.
export interface HrRepository {
  listEmployees(query?: EmployeeQuery): Promise<Employee[]>;
  getEmployee(id: ID): Promise<Employee | null>;
  createEmployee(draft: EmployeeDraft, ctx: HrActorContext): Promise<Employee>;
  updateEmployee(employee: Employee, draft: EmployeeDraft, ctx: HrActorContext): Promise<Employee>;
  listAttendance(): Promise<AttendanceRecord[]>;
  clockIn(employeeId: ID, ctx: HrActorContext, note?: string): Promise<AttendanceRecord>;
  clockOut(recordId: ID): Promise<AttendanceRecord>;
  attendanceSummary(): Promise<AttendanceSummary[]>;
}

// فلترة نقية للموظفين.
function filterEmployees(employees: Employee[], query: EmployeeQuery): Employee[] {
  let result = employees;
  const search = query.search?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (e) =>
        e.fullName.toLowerCase().includes(search) ||
        e.position.toLowerCase().includes(search) ||
        (e.phone ?? '').includes(search),
    );
  }
  if (query.status) result = result.filter((e) => e.status === query.status);
  return result;
}

export class AppHrRepository implements HrRepository {
  constructor(private readonly source: HrSource) {} // نستقبل المصدر.

  async listEmployees(query: EmployeeQuery = {}): Promise<Employee[]> {
    const all = await this.source.listEmployees();
    return filterEmployees(all, query);
  }

  async getEmployee(id: ID): Promise<Employee | null> {
    const all = await this.source.listEmployees();
    return all.find((e) => String(e.id) === String(id)) ?? null;
  }

  async createEmployee(draft: EmployeeDraft, ctx: HrActorContext): Promise<Employee> {
    const validation = validateEmployeeDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid employee');
    }
    const employee = createEmployeeFromDraft(draft, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      storeId: ctx.storeId,
      currency: ctx.currency,
    });
    await this.source.saveEmployee(employee);
    logger.info('Employee created', { id: String(employee.id) });
    return employee;
  }

  async updateEmployee(employee: Employee, draft: EmployeeDraft, ctx: HrActorContext): Promise<Employee> {
    const validation = validateEmployeeDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid employee');
    }
    const updated = applyDraftToEmployee(employee, draft, ctx.currency);
    await this.source.saveEmployee(updated);
    logger.info('Employee updated', { id: String(employee.id) });
    return updated;
  }

  async listAttendance(): Promise<AttendanceRecord[]> {
    return this.source.listAttendance();
  }

  // بصمة دخول: يمنع تسجيل دخول موظف لديه فترة مفتوحة بالفعل.
  async clockIn(employeeId: ID, ctx: HrActorContext, note?: string): Promise<AttendanceRecord> {
    const employee = await this.getEmployee(employeeId);
    if (!employee) throw new ValidationError('hr.error.employeeNotFound');

    const records = await this.source.listAttendance();
    const openForEmployee = records.some(
      (r) => String(r.employeeId) === String(employeeId) && r.status === 'open',
    );
    if (openForEmployee) {
      throw new ValidationError('hr.error.alreadyClockedIn');
    }

    const record = buildClockIn({
      tenantId: ctx.tenantId,
      employeeId,
      employeeName: employee.fullName,
      note,
    });
    await this.source.saveAttendance(record);
    logger.info('Employee clocked in', { employee: String(employeeId) });
    return record;
  }

  // بصمة خروج: يقفل الفترة ويحسب الدقائق.
  async clockOut(recordId: ID): Promise<AttendanceRecord> {
    const records = await this.source.listAttendance();
    const record = records.find((r) => String(r.id) === String(recordId));
    if (!record) throw new ValidationError('hr.error.recordNotFound');
    const closed = closeClockOut(record);
    await this.source.saveAttendance(closed);
    logger.info('Employee clocked out', { record: String(recordId), minutes: closed.workedMinutes });
    return closed;
  }

  // ملخص الحضور المجمع لكل موظف.
  async attendanceSummary(): Promise<AttendanceSummary[]> {
    const records = await this.source.listAttendance();
    return summarizeAttendance(records);
  }
}
