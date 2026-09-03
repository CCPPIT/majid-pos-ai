/**
 * اختبارات مجال ومستودع الموارد البشرية (PHASE 21).
 * تغطي: تحقق الموظف، بناء/تعديل الموظف (راتب Money)، حساب وقت الدوام،
 * بصمة دخول/خروج (منع تكرار الدخول، حساب الساعات)، وتجميع ملخص الحضور،
 * وتكامل المستودع (إنشاء/دخول/خروج/ملخص).
 */
import {
  validateEmployeeDraft,
  createEmployeeFromDraft,
  applyDraftToEmployee,
  minutesBetween,
  clockIn,
  clockOut,
  summarizeAttendance,
  type EmployeeDraft,
} from '@/domain/hr';
import { money } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';
import { LocalHrSource } from '@/data/sources/hr.source';
import { AppHrRepository } from '@/data/repositories/hr.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';

// سياق للاختبارات.
const ctx = { tenantId: asId('tenant-t'), storeId: asId('store-1'), currency: 'YER' };

// نموذج موظف صالح.
const validDraft: EmployeeDraft = {
  fullName: 'سالم الكاشير',
  phone: '777123456',
  email: 's@example.com',
  position: 'كاشير',
  roleCode: 'cashier',
  baseSalary: '200000',
  hireDate: '2026-01-01',
  notes: '',
};

describe('employee validation & factory (PHASE 21)', () => {
  test('accepts valid draft', () => {
    expect(validateEmployeeDraft(validDraft).valid).toBe(true);
  });

  test('rejects missing name/position and bad salary/phone/email', () => {
    expect(validateEmployeeDraft({ ...validDraft, fullName: '' }).valid).toBe(false);
    expect(validateEmployeeDraft({ ...validDraft, position: '' }).errorKey).toBe('hr.error.positionRequired');
    expect(validateEmployeeDraft({ ...validDraft, baseSalary: 'abc' }).errorKey).toBe('hr.error.salaryInvalid');
    expect(validateEmployeeDraft({ ...validDraft, phone: 'xyz' }).errorKey).toBe('hr.error.phoneInvalid');
    expect(validateEmployeeDraft({ ...validDraft, email: 'bad' }).errorKey).toBe('hr.error.emailInvalid');
  });

  test('builds an employee with Money salary and active status', () => {
    const e = createEmployeeFromDraft(validDraft, ctx);
    expect(e.baseSalary).toEqual(money(200000, 'YER'));
    expect(e.status).toBe('active');
    expect(e.position).toBe('كاشير');
  });

  test('update changes fields and preserves identity/status', () => {
    const e = createEmployeeFromDraft(validDraft, ctx);
    const updated = applyDraftToEmployee(e, { ...validDraft, position: 'مدير فرع', baseSalary: '300000' }, 'YER');
    expect(updated.id).toBe(e.id);
    expect(updated.position).toBe('مدير فرع');
    expect(updated.baseSalary).toEqual(money(300000, 'YER'));
    expect(updated.status).toBe('active');
  });
});

describe('attendance math (PHASE 21)', () => {
  test('minutes between clock-in/out', () => {
    const mins = minutesBetween('2026-01-01T08:00:00.000Z', '2026-01-01T12:30:00.000Z');
    expect(mins).toBe(270); // 4 ساعات و30 دقيقة.
  });

  test('never negative for out-before-in', () => {
    expect(minutesBetween('2026-01-01T12:00:00.000Z', '2026-01-01T08:00:00.000Z')).toBe(0);
  });

  test('clock in is open; clock out computes worked minutes and is idempotent', () => {
    let rec = clockIn({ tenantId: ctx.tenantId, employeeId: asId('emp-1'), employeeName: 'سالم' }, '2026-01-01T08:00:00.000Z');
    expect(rec.status).toBe('open');
    rec = clockOut(rec, '2026-01-01T16:00:00.000Z'); // 8 ساعات.
    expect(rec.status).toBe('closed');
    expect(rec.workedMinutes).toBe(480);
    // الخروج مرّة أخرى لا يغيّر شيئًا (idempotent).
    const again = clockOut(rec, '2026-01-01T20:00:00.000Z');
    expect(again.workedMinutes).toBe(480);
  });

  test('summarizeAttendance aggregates closed shifts and counts open ones', () => {
    const r1 = clockOut(
      clockIn({ tenantId: ctx.tenantId, employeeId: asId('emp-1'), employeeName: 'أ' }, '2026-01-01T08:00:00.000Z'),
      '2026-01-01T16:00:00.000Z',
    );
    const r2 = clockIn({ tenantId: ctx.tenantId, employeeId: asId('emp-1'), employeeName: 'أ' }, '2026-01-02T08:00:00.000Z');
    const summary = summarizeAttendance([r1, r2]);
    const emp1 = summary.find((s) => String(s.employeeId) === 'emp-1');
    expect(emp1?.shiftsCount).toBe(1); // فترات مغلقة.
    expect(emp1?.openShifts).toBe(1); // فترات مفتوحة.
    expect(emp1?.totalHours).toBe(8);
  });
});

// يبني مستودع HR فوق تخزين ذاكرة.
function makeRepo() {
  const prefs = new InMemoryPreferencesSource();
  const source = new LocalHrSource({
    getString: (k) => prefs.getString(k),
    setString: (k, v) => prefs.setString(k, v),
  });
  return new AppHrRepository(source);
}

describe('HR repository (PHASE 21)', () => {
  test('create and search employees', async () => {
    const repo = makeRepo();
    const employee = await repo.createEmployee(validDraft, ctx);
    expect(employee.fullName).toBe('سالم الكاشير');
    const found = await repo.listEmployees({ search: 'سالم' });
    expect(found.some((e) => e.id === employee.id)).toBe(true);
    const byPosition = await repo.listEmployees({ search: 'كاشير' });
    expect(byPosition.length).toBe(1);
  });

  test('clock in then out updates worked time; double clock-in rejected', async () => {
    const repo = makeRepo();
    const employee = await repo.createEmployee(validDraft, ctx);

    const rec = await repo.clockIn(employee.id, ctx);
    expect(rec.status).toBe('open');

    // دخول ثانٍ قبل الخروج يُرفض.
    await expect(repo.clockIn(employee.id, ctx)).rejects.toBeInstanceOf(ValidationError);

    // الخروج يغلق الفترة.
    const closed = await repo.clockOut(rec.id);
    expect(closed.status).toBe('closed');
    expect(typeof closed.workedMinutes).toBe('number');
  });

  test('attendanceSummary aggregates across records', async () => {
    const repo = makeRepo();
    const employee = await repo.createEmployee(validDraft, ctx);
    const rec = await repo.clockIn(employee.id, ctx);
    await repo.clockOut(rec.id);
    const summary = await repo.attendanceSummary();
    const row = summary.find((s) => String(s.employeeId) === String(employee.id));
    expect(row?.shiftsCount).toBe(1);
  });

  test('clocking unknown employee throws', async () => {
    const repo = makeRepo();
    await expect(repo.clockIn(asId('nope'), ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
