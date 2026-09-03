/**
 * التبويب الرئيسي — لوحة التحكم الديناميكية (PHASE 10).
 * العناصر تُفلتر بصلاحيات الدور من سجل الـ Widgets (PHASE 07)، والمؤشرات
 * تُجلب عبر مستودع اللوحة بنطاق المتجر النشط.
 */
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { dashboardRepository } from '@/shared/container';

// الشاشة تستخدم المستودع المحقون من حاوية التركيب.
export default function HomeTab() {
  return <DashboardScreen repository={dashboardRepository} />;
}
