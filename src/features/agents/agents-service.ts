/**
 * خدمة الوكلاء الأذكياء (PHASE 25).
 * تجمع البيانات الحقيقية من المستودعات (تقارير/مخزون/مشتريات/عملاء/طلبات/
 * مصروفات)، تبني مدخلات محرّك القواعد النقي، تشغّل الوكلاء، تمرّر الناتج عبر
 * خط الأمان (حسب الصلاحيات)، ثم تُنسّق المبالغ للعرض. لا حسابات مالية هنا —
 * الأرقام مقروءة من تقارير مبنية عبر core/money، والقواعد نقية في المجال.
 */
import { runAgents, applySafetyPipeline } from '@/domain/agents';
import type { AgentDataInput, AgentInsight, AgentActionRoute } from '@/domain/agents';
import { reportsRepository, inventoryRepository, procurementRepository, customersRepository, ordersRepository, financeRepository } from '@/shared/container';
import { logger } from '@/core/logging/logger';

// مُنسّقات i18n المحقونة (تفادي استيراد الواجهة في الخدمة).
export interface AgentFormatter {
  fmtMoney: (amount: number, currency?: string) => string; // مبلغ منسّق.
  currency: string; // عملة العرض.
}

// إجراء جاهز للعرض (مع تسميته المُترجَمة).
export interface AgentViewAction {
  label: string; // التسمية المُترجَمة.
  permission: string; // الصلاحية (للتوثيق).
  route: AgentActionRoute; // الوجهة (تنقّل فقط — لا كتابة).
}

// رؤيا جاهزة للعرض (نص مُترجَم + مبالغ مُنسّقة).
export interface AgentViewInsight extends Omit<AgentInsight, 'action'> {
  title: string; // العنوان المُترجَم.
  body: string; // النص المُترجَم مع المبالغ.
  action?: AgentViewAction; // الإجراء المُترجَم (إن وُجد ومُرِّر أمنيًا).
}

// يبني معاملات الترجمة (أرقام + مبالغ منسّقة).
function buildParams(insight: AgentInsight, d: AgentDataInput, f: AgentFormatter): Record<string, string | number> {
  const params: Record<string, string | number> = { ...insight.params };
  // المبالغ المُشار إليها بمفاتيح money*.
  if (insight.moneyKeys?.includes('moneyRevenue')) params.moneyRevenue = f.fmtMoney(d.todayRevenue, d.currency);
  if (insight.moneyKeys?.includes('moneyExpenses')) params.moneyExpenses = f.fmtMoney(d.todayExpenses, d.currency);
  return params;
}

// يجمع بيانات المتجر ويشغّل الوكلاء ويعيد الرؤى الآمنة المُنسّقة.
export async function collectInsights(
  permissions: readonly string[],
  f: AgentFormatter,
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<AgentViewInsight[]> {
  try {
    // تقرير اليوم (إيراد/طلبات/ضريبة/خصم/نمو).
    const report = await reportsRepository.getSalesReport('today', {}, f.currency);

    // ملخص المخزون (منخفض/نافد).
    const inv = await inventoryRepository.summary();

    // أوامر الشراء غير المكتملة (مقدمة/معتمدة/مستلمة جزئيًا).
    const purchaseOrders = await procurementRepository.listPurchaseOrders();
    const pendingPo = purchaseOrders.filter((po) => po.status === 'submitted' || po.status === 'approved' || po.status === 'partially_received').length;

    // العملاء: المميزون وبلا شراء.
    const customers = await customersRepository.list();
    const vip = customers.filter((c) => c.tier === 'gold' || c.tier === 'platinum');
    const unorderedVip = vip.filter((c) => c.orderCount === 0).length;

    // الطلبات غير المدفوعة بالكامل.
    const orders = await ordersRepository.listOrders();
    const unpaid = orders.filter((o) => o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial').length;

    // مصروفات اليوم.
    const expenses = await financeRepository.listExpenses();
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayExpenses = expenses
      .filter((e) => e.spentAt.slice(0, 10) === todayKey)
      .reduce((sum, e) => sum + e.amount.amount, 0);

    // إيراد الفترة السابقة يُشتق عكسيًا من نسبة النمو (نفس رياضة المجال).
    const growth = report.growth;
    const prevRevenue = growth !== 0 && Number.isFinite(growth) ? Math.round((report.revenue.amount * 100) / (100 + growth)) : 0;

    const data: AgentDataInput = {
      todayRevenue: report.revenue.amount,
      todayPaidOrders: report.paidCount,
      prevRevenue,
      tax: report.tax.amount,
      discount: report.discount.amount,
      currency: f.currency,
      lowStockCount: inv.lowStock,
      outOfStockCount: inv.outOfStock,
      pendingPurchaseCount: pendingPo,
      vipCount: vip.length,
      unorderedVipCount: unorderedVip,
      unpaidOrderCount: unpaid,
      todayExpenses,
    };

    // تشغيل الوكلاء ثم خط الأمان حسب الصلاحيات.
    const insights = runAgents(data);
    const { visible } = applySafetyPipeline(insights, permissions);

    // ترجمة وتنسيق للعرض.
    return visible.map((insight): AgentViewInsight => ({
      id: insight.id,
      agentId: insight.agentId,
      severity: insight.severity,
      titleKey: insight.titleKey,
      bodyKey: insight.bodyKey,
      params: insight.params,
      moneyKeys: insight.moneyKeys,
      createdAt: insight.createdAt,
      title: t(insight.titleKey),
      body: t(insight.bodyKey, buildParams(insight, data, f)),
      action: insight.action
        ? { label: t(insight.action.labelKey), permission: insight.action.permission, route: insight.action.route }
        : undefined,
    }));
  } catch (error) {
    logger.error('Agents insight collection failed', { error: String(error) });
    return [];
  }
}
