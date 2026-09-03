/**
 * نقطة تصدير مجال الموارد البشرية (PHASE 21).
 */
export * from './types'; // أنواع الموظفين والحضور.
export {
  validateEmployeeDraft,
  createEmployeeFromDraft,
  applyDraftToEmployee,
  employeeToDraft,
  minutesBetween,
  clockOut,
  clockIn,
  summarizeAttendance,
} from './logic'; // المنطق النقي.
