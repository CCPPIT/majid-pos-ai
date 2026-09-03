/**
 * مستودع التقارير (PHASE 22).
 * طبقة قراءة فقط: يجمع الطلبات والدفعات من مصادرها الحقيقية ويفوّض الحساب
 * لدوال المجال النقية. لا يخزّن شيئًا — كل رقم يُحسب عند الطلب ليبقى طازجًا.
 */
import type { ID } from '@/core/types/domain';
import { buildSalesReport, type ReportPeriod, type SalesReport } from '@/domain/reports';
import type { OrdersRepository } from './orders.repository';
import type { PaymentsRepository } from './payments.repository';

// واجهة المستودع.
export interface ReportsRepository {
  getSalesReport(period: ReportPeriod, scope: { storeId?: ID; branchId?: ID }, currency: string): Promise<SalesReport>;
}

export class AppReportsRepository implements ReportsRepository {
  constructor(
    private readonly ordersRepo: OrdersRepository, // مستودع الطلبات.
    private readonly paymentsRepo: PaymentsRepository, // مستودع المدفوعات.
  ) {}

  // يبني تقرير مبيعات لفترة ونطاق.
  async getSalesReport(
    period: ReportPeriod,
    scope: { storeId?: ID; branchId?: ID },
    currency: string,
  ): Promise<SalesReport> {
    // نجمع الطلبات والدفعات بالتوازي.
    const [orders, payments] = await Promise.all([
      this.ordersRepo.listOrders({ storeId: scope.storeId, branchId: scope.branchId }),
      this.paymentsRepo.listAllPayments(),
    ]);
    return buildSalesReport({ orders, payments, period, currency });
  }
}
