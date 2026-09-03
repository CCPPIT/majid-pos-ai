/**
 * منطق الموارد البشرية النقي (PHASE 21).
 * تحقق وبناء الموظف، حساب وقت الدوام من بصمتي الدخول/الخروج، وتجميع
 * ملخص الحضور لكل موظف. دوال خالصة بلا تخزين — قابلة للاختبار بالكامل.
 */
import { money } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId, type ID } from '@/core/types/domain';
import type {
  AttendanceRecord,
  AttendanceSummary,
  Employee,
  EmployeeDraft,
} from './types';

// تطبيع الهاتف.
function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]/g, '');
}

// تحقق نموذج موظف (الاسم والمسمى والراتب إلزامية).
export function validateEmployeeDraft(draft: EmployeeDraft): { valid: boolean; errorKey?: string } {
  if (!draft.fullName.trim()) return { valid: false, errorKey: 'hr.error.nameRequired' };
  if (!draft.position.trim()) return { valid: false, errorKey: 'hr.error.positionRequired' };
  const salary = Number(draft.baseSalary);
  if (!Number.isFinite(salary) || salary < 0) return { valid: false, errorKey: 'hr.error.salaryInvalid' };
  if (draft.phone.trim() && !/^[0-9+]{6,20}$/.test(normalizePhone(draft.phone))) {
    return { valid: false, errorKey: 'hr.error.phoneInvalid' };
  }
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return { valid: false, errorKey: 'hr.error.emailInvalid' };
  }
  return { valid: true };
}

// يبني كيان موظف من النموذج (الراتب كائن Money).
export function createEmployeeFromDraft(
  draft: EmployeeDraft,
  ctx: { tenantId: ID; organizationId?: ID; branchId?: ID; storeId?: ID; currency: string },
  now: string = new Date().toISOString(),
): Employee {
  const validation = validateEmployeeDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid employee');
  return {
    id: asId(`employee-${Date.now()}`),
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    storeId: ctx.storeId,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim() ? normalizePhone(draft.phone) : undefined,
    email: draft.email.trim() || undefined,
    position: draft.position.trim(),
    roleCode: draft.roleCode.trim() || undefined,
    baseSalary: money(Number(draft.baseSalary) || 0, ctx.currency),
    hireDate: draft.hireDate.trim() || now.slice(0, 10),
    status: 'active',
    notes: draft.notes.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

// يحدّث موظفًا قائمًا من نموذج (يحافظ على الهوية والحالة والتاريخ).
export function applyDraftToEmployee(
  existing: Employee,
  draft: EmployeeDraft,
  currency: string,
  now: string = new Date().toISOString(),
): Employee {
  const validation = validateEmployeeDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid employee');
  return {
    ...existing,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim() ? normalizePhone(draft.phone) : undefined,
    email: draft.email.trim() || undefined,
    position: draft.position.trim(),
    roleCode: draft.roleCode.trim() || undefined,
    baseSalary: money(Number(draft.baseSalary) || 0, currency),
    notes: draft.notes.trim() || undefined,
    updatedAt: now,
  };
}

// يحوّل موظفًا إلى نموذج إدخال (لفتح التعديل).
export function employeeToDraft(employee: Employee): EmployeeDraft {
  return {
    fullName: employee.fullName,
    phone: employee.phone ?? '',
    email: employee.email ?? '',
    position: employee.position,
    roleCode: employee.roleCode ?? '',
    baseSalary: String(employee.baseSalary.amount),
    hireDate: employee.hireDate.slice(0, 10),
    notes: employee.notes ?? '',
  };
}

// يحسب الدقائق بين بصمة دخول وخروج (يمنع السالب، التقريب لأقرب دقيقة).
export function minutesBetween(clockIn: string, clockOut: string): number {
  const inMs = new Date(clockIn).getTime();
  const outMs = new Date(clockOut).getTime();
  const diff = outMs - inMs;
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.round(diff / 60000);
}

// يغلق سجل حضور بتسجيل الخروج ويحسب الدقائق (لا يقفل المغلق).
export function clockOut(record: AttendanceRecord, now: string = new Date().toISOString()): AttendanceRecord {
  if (record.status === 'closed' || record.clockOut) return record; // لا شيء.
  const workedMinutes = minutesBetween(record.clockIn, now);
  return {
    ...record,
    clockOut: now,
    workedMinutes,
    status: 'closed',
    updatedAt: now,
  };
}

// يفتح سجل حضور جديد (بصمة دخول).
export function clockIn(
  args: { tenantId: ID; employeeId: ID; employeeName: string; note?: string },
  now: string = new Date().toISOString(),
): AttendanceRecord {
  return {
    id: asId(`attendance-${Date.now()}`),
    tenantId: args.tenantId,
    employeeId: args.employeeId,
    employeeName: args.employeeName,
    clockIn: now,
    status: 'open',
    note: args.note,
    createdAt: now,
    updatedAt: now,
  };
}

// يجمع سجلات الحضور إلى ملخصات لكل موظف (يستثني السجلات المفتوحة من الدقائق).
export function summarizeAttendance(records: AttendanceRecord[]): AttendanceSummary[] {
  const map = new Map<string, AttendanceSummary>();
  for (const r of records) {
    const key = String(r.employeeId);
    const cur = map.get(key) ?? {
      employeeId: r.employeeId,
      shiftsCount: 0,
      totalMinutes: 0,
      totalHours: 0,
      openShifts: 0,
    };
    if (r.status === 'open') {
      cur.openShifts += 1; // فترة لم تُقفل.
    } else if (typeof r.workedMinutes === 'number') {
      cur.shiftsCount += 1;
      cur.totalMinutes += r.workedMinutes;
    }
    map.set(key, cur);
  }
  // تحويل الدقائق إلى ساعات بدقة عشرية.
  return Array.from(map.values()).map((s) => ({
    ...s,
    totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
  }));
}
