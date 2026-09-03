/**
 * أنواع مجال الموارد البشرية (PHASE 21 — HR).
 * الموظفون، سجل الحضور/الانصراف (بصمات دوام بسيطة)، وملخص الرواتب.
 * كل المبالغ Money حقيقية عبر core/money — الواجهة لا تحسب شيئًا.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { Money } from '@/core/money/money';

// حالة الموظف.
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';

// كيان الموظف.
export interface Employee extends Auditable {
  id: ID; // معرف الموظف.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  fullName: string; // الاسم الكامل.
  phone?: string; // الهاتف.
  email?: string; // البريد.
  position: string; // المسمى الوظيفي (كاشير/مدير/…).
  roleCode?: string; // كود دور RBAC المرتبط (اختياري).
  baseSalary: Money; // الراتب الأساسي الشهري.
  hireDate: ISODateString; // تاريخ التعيين.
  status: EmployeeStatus; // الحالة.
  notes?: string; // ملاحظات.
}

// حالة سجل الحضور.
export type AttendanceStatus = 'open' | 'closed';

// سجل حضور (دوام واحد: بصمة دخول + خروج).
export interface AttendanceRecord extends Auditable {
  id: ID; // معرف السجل.
  tenantId: ID; // المستأجر.
  employeeId: ID; // الموظف.
  employeeName: string; // لقطة اسم الموظف.
  clockIn: ISODateString; // لحظة تسجيل الدخول.
  clockOut?: ISODateString; // لحظة تسجيل الخروج.
  workedMinutes?: number; // الدقائق المحتسبة (عند الخروج).
  status: AttendanceStatus; // مفتوح أم مغلق.
  note?: string; // ملاحظة.
}

// نموذج إدخال موظف.
export interface EmployeeDraft {
  fullName: string; // الاسم.
  phone: string; // الهاتف.
  email: string; // البريد.
  position: string; // المسمى الوظيفي.
  roleCode: string; // كود الدور.
  baseSalary: string; // الراتب كنص.
  hireDate: string; // تاريخ التعيين (نص للتحرير).
  notes: string; // ملاحظات.
}

// ملخص حضور موظف لفترة.
export interface AttendanceSummary {
  employeeId: ID; // الموظف.
  shiftsCount: number; // عدد فترات الدوام المغلقة.
  totalMinutes: number; // إجمالي الدقائق.
  totalHours: number; // إجمالي الساعات (بدقة عشرية).
  openShifts: number; // فترات لم تُقفل بعد.
}

// ملخص رواتب موظف.
export interface PayrollSummary {
  employeeId: ID; // الموظف.
  employeeName: string; // الاسم.
  baseSalary: Money; // الراتب الأساسي.
  attendanceDays: number; // أيام الحضور في الفترة.
  totalHours: number; // إجمالي ساعات الدوام.
  openShifts: number; // فترات مفتوحة.
}

// معايير استعلام الموظفين.
export interface EmployeeQuery {
  search?: string; // بحث بالاسم/الهاتف/الوظيفة.
  status?: EmployeeStatus; // فلترة بالحالة.
  storeId?: ID; // تضييق المتجر.
  branchId?: ID; // تضييق الفرع.
}

// سياق المنفّذ.
export interface HrContext {
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  userId?: ID; // المنفّذ.
  currency: string; // العملة.
}
