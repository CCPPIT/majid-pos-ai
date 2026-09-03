/**
 * مستودع لوحة التحكم (PHASE 10).
 * يفصل الشاشة عن المصدر (Mock اليوم / API غدًا) ويُرجع لقطة مؤشرات
 * لنطاق الاستعلام الحالي (المتجر/الفرع/المنظمة).
 */
import type { DashboardSnapshot } from '@/domain/dashboard/types';
import type { QueryScope } from '@/domain/tenancy/scope';
import type { DashboardSource } from '../sources/dashboard.source';

// واجهة المستودع.
export interface DashboardRepository {
  // يجلب لقطة اللوحة لنطاق معين وبعملة معينة.
  getSnapshot(scope: QueryScope | null, currency: string): Promise<DashboardSnapshot>;
}

// التنفيذ المحلي.
export class AppDashboardRepository implements DashboardRepository {
  constructor(private readonly source: DashboardSource) {} // نستقبل المصدر.

  getSnapshot(scope: QueryScope | null, currency: string): Promise<DashboardSnapshot> {
    // نفوّض للمصدر (تُضاف الكاش/المزامنة لاحقًا هنا دون تغيير الشاشة).
    return this.source.getDashboardSnapshot(scope, currency);
  }
}
