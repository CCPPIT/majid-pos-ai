/**
 * مصدر الموارد البشرية المحلي الدائم (PHASE 21).
 * يخزّن الموظفين وسجلات الحضور على الجهاز (Offline-First) عبر التفضيلات
 * النصية في مفتاح واحد (لأن البيانات مترابطة). اليوم محلي، وغدًا API.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { AttendanceRecord, Employee } from '@/domain/hr/types';

// واجهة تخزين نصية.
export interface HrStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// البيانات المحفوظة.
interface PersistedHr {
  employees: Employee[]; // الموظفون.
  attendance: AttendanceRecord[]; // سجلات الحضور.
}

// واجهة المصدر.
export interface HrSource {
  listEmployees(): Promise<Employee[]>;
  saveEmployee(employee: Employee): Promise<void>;
  listAttendance(): Promise<AttendanceRecord[]>;
  saveAttendance(record: AttendanceRecord): Promise<void>;
}

// قراءة JSON آمنة (تتسامح مع الفساد).
async function read(store: HrStore): Promise<PersistedHr> {
  try {
    const raw = await store.getString(STORAGE_KEYS.hrData);
    if (!raw) return { employees: [], attendance: [] };
    const parsed = JSON.parse(raw) as PersistedHr;
    return { employees: parsed.employees ?? [], attendance: parsed.attendance ?? [] };
  } catch (error) {
    logger.warn('Failed to parse HR data', { error: String(error) });
    return { employees: [], attendance: [] };
  }
}

// كتابة البيانات كاملة.
async function write(store: HrStore, data: PersistedHr): Promise<void> {
  await store.setString(STORAGE_KEYS.hrData, JSON.stringify(data));
}

export class LocalHrSource implements HrSource {
  constructor(private readonly store: HrStore) {} // نستقبل المخزن.

  // قائمة الموظفين (النشطون أولًا ثم الأحدث تعيينًا).
  async listEmployees(): Promise<Employee[]> {
    const data = await read(this.store);
    return [...data.employees].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.hireDate.localeCompare(a.hireDate);
    });
  }

  // حفظ/تحديث موظف (يستبدل بنفس المعرف).
  async saveEmployee(employee: Employee): Promise<void> {
    const data = await read(this.store);
    const rest = data.employees.filter((e) => String(e.id) !== String(employee.id));
    await write(this.store, { ...data, employees: [employee, ...rest] });
  }

  // قائمة الحضور (الأحدث أولًا بلحظة الدخول).
  async listAttendance(): Promise<AttendanceRecord[]> {
    const data = await read(this.store);
    return [...data.attendance].sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  }

  // حفظ/تحديث سجل حضور (يستبدل بنفس المعرف).
  async saveAttendance(record: AttendanceRecord): Promise<void> {
    const data = await read(this.store);
    const rest = data.attendance.filter((r) => String(r.id) !== String(record.id));
    await write(this.store, { ...data, attendance: [record, ...rest] });
  }
}
