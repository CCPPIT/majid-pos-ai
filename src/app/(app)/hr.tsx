/**
 * مسار الموارد البشرية (PHASE 21).
 * شاشة كاملة خارج التبويبات: الموظفون + الحضور/الدوام.
 * الحماية بالصلاحية مدمجة داخل HrScreen.
 */
import { HrScreen } from '@/features/hr/HrScreen';

// نعرض شاشة الموارد البشرية.
export default function HrRoute() {
  return <HrScreen />;
}
