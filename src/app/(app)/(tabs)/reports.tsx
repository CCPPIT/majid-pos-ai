/**
 * تبويب التقارير (PHASE 22 — Reports & Analytics).
 * كان شاشة مؤقتة؛ الآن يعرض شاشة التقارير الحقيقية المشتقة من الطلبات والمدفوعات.
 * الحماية بالصلاحية مدمجة داخل ReportsScreen (PermissionGuard).
 */
import { ReportsScreen } from '@/features/reports/ReportsScreen';

// نعرض شاشة التقارير.
export default function ReportsTab() {
  return <ReportsScreen />;
}
