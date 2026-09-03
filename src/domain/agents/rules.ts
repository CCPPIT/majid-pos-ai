/**
 * محرّك قواعد الوكلاء النقي (PHASE 25).
 * يحوّل بيانات المتجر المجمّعة إلى رؤى (AgentInsight) عبر قواعد محلية
 * شفافة. لا تخزين ولا ترجمة ولا مال هنا — فقط أرقام خام وقرارات خطورة.
 * كل رؤية تقترح إجراءً تنقّليًا اختياريًا (لا كتابة تلقائية إطلاقًا).
 */
import type { AgentId, AgentDataInput, AgentInsight, AgentAction } from './types';

// عداد تسلسلي لمعرفات الرؤى داخل التشغيل.
let seq = 0;

// يبني رؤية واحدة (معرف فريد + طابع زمني).
function makeInsight(
  agentId: AgentId,
  severity: AgentInsight['severity'],
  titleKey: string,
  bodyKey: string,
  params: Record<string, number>,
  moneyKeys: string[],
  action?: AgentAction,
  now: string = new Date().toISOString(),
): AgentInsight {
  seq += 1;
  return {
    id: `insight-${Date.now()}-${seq}`,
    agentId,
    severity,
    titleKey,
    bodyKey,
    params,
    moneyKeys,
    action,
    createdAt: now,
  };
}

// وزن الخطورة للفرز (الأعلى أولًا).
const SEVERITY_RANK: Record<AgentInsight['severity'], number> = {
  critical: 4,
  warning: 3,
  info: 2,
  good: 1,
};

// ── وكيل المخزون ──
function inventoryRules(d: AgentDataInput, now: string): AgentInsight[] {
  const out: AgentInsight[] = [];
  // نافد → حرج.
  if (d.outOfStockCount > 0) {
    out.push(
      makeInsight(
        'inventory',
        'critical',
        'agents.insight.outOfStockTitle',
        'agents.insight.outOfStockBody',
        { count: d.outOfStockCount },
        [],
        { labelKey: 'agents.action.reviewInventory', permission: 'inventory.read', route: '/(app)/inventory' },
        now,
      ),
    );
  }
  // منخفض → تحذير.
  if (d.lowStockCount > 0) {
    out.push(
      makeInsight(
        'inventory',
        'warning',
        'agents.insight.lowStockTitle',
        'agents.insight.lowStockBody',
        { count: d.lowStockCount },
        [],
        { labelKey: 'agents.action.createPurchase', permission: 'procurement.read', route: '/(app)/procurement' },
        now,
      ),
    );
  }
  // كل شيء متوفر → إشارة جيدة.
  if (d.outOfStockCount === 0 && d.lowStockCount === 0) {
    out.push(
      makeInsight('inventory', 'good', 'agents.insight.stockHealthyTitle', 'agents.insight.stockHealthyBody', {}, [], undefined, now),
    );
  }
  return out;
}

// ── وكيل المبيعات ──
function salesRules(d: AgentDataInput, now: string): AgentInsight[] {
  const out: AgentInsight[] = [];
  if (d.todayPaidOrders === 0 && d.todayRevenue === 0) {
    // لا مبيعات اليوم.
    out.push(
      makeInsight(
        'sales',
        'warning',
        'agents.insight.noSalesTitle',
        'agents.insight.noSalesBody',
        {},
        [],
        { labelKey: 'agents.action.goPos', permission: 'orders.read', route: '/(app)/orders' },
        now,
      ),
    );
  } else {
    // نمو/تراجع مقابل الفترة السابقة.
    if (d.prevRevenue > 0) {
      const deltaPct = Math.round(((d.todayRevenue - d.prevRevenue) / d.prevRevenue) * 100);
      const growing = deltaPct >= 0;
      out.push(
        makeInsight(
          'sales',
          growing ? 'good' : 'warning',
          growing ? 'agents.insight.salesUpTitle' : 'agents.insight.salesDownTitle',
          growing ? 'agents.insight.salesUpBody' : 'agents.insight.salesDownBody',
          { pct: Math.abs(deltaPct), orders: d.todayPaidOrders },
          ['moneyRevenue'],
          { labelKey: 'agents.action.viewReports', permission: 'reports.view', route: '/(app)/(tabs)/reports' },
          now,
        ),
      );
    } else {
      // لا فترة سابقة: ملخص إيجابي عام.
      out.push(
        makeInsight(
          'sales',
          'good',
          'agents.insight.salesOkTitle',
          'agents.insight.salesOkBody',
          { orders: d.todayPaidOrders },
          ['moneyRevenue'],
          { labelKey: 'agents.action.viewReports', permission: 'reports.view', route: '/(app)/(tabs)/reports' },
          now,
        ),
      );
    }
  }
  return out;
}

// ── وكيل المالية ──
function financeRules(d: AgentDataInput, now: string): AgentInsight[] {
  const out: AgentInsight[] = [];
  // تحذير إن تجاوزت مصروفات اليوم 50% من إيراد اليوم.
  if (d.todayRevenue > 0 && d.todayExpenses > 0 && d.todayExpenses > d.todayRevenue * 0.5) {
    const ratioPct = Math.round((d.todayExpenses / d.todayRevenue) * 100);
    out.push(
      makeInsight(
        'finance',
        'warning',
        'agents.insight.expenseHighTitle',
        'agents.insight.expenseHighBody',
        { pct: ratioPct },
        ['moneyExpenses', 'moneyRevenue'],
        { labelKey: 'agents.action.reviewFinance', permission: 'finance.read', route: '/(app)/finance' },
        now,
      ),
    );
  } else if (d.todayExpenses > 0) {
    // مصروفات مسجّلة (معلومات).
    out.push(
      makeInsight(
        'finance',
        'info',
        'agents.insight.expenseLoggedTitle',
        'agents.insight.expenseLoggedBody',
        {},
        ['moneyExpenses'],
        { labelKey: 'agents.action.reviewFinance', permission: 'finance.read', route: '/(app)/finance' },
        now,
      ),
    );
  }
  return out;
}

// ── وكيل المشتريات ──
function procurementRules(d: AgentDataInput, now: string): AgentInsight[] {
  if (d.pendingPurchaseCount === 0) return [];
  return [
    makeInsight(
      'procurement',
      'warning',
      'agents.insight.pendingPoTitle',
      'agents.insight.pendingPoBody',
      { count: d.pendingPurchaseCount },
      [],
      { labelKey: 'agents.action.receiveStock', permission: 'procurement.read', route: '/(app)/procurement' },
      now,
    ),
  ];
}

// ── وكيل العملاء (CRM) ──
function crmRules(d: AgentDataInput, now: string): AgentInsight[] {
  const out: AgentInsight[] = [];
  // عملاء مميزون بلا أي شراء → فرصة تفعيل.
  if (d.unorderedVipCount > 0) {
    out.push(
      makeInsight(
        'crm',
        'info',
        'agents.insight.vipInactiveTitle',
        'agents.insight.vipInactiveBody',
        { count: d.unorderedVipCount },
        [],
        { labelKey: 'agents.action.openCustomers', permission: 'customers.read', route: '/(app)/customers' },
        now,
      ),
    );
  } else if (d.vipCount > 0) {
    // عملاء مميزون نشطون → إشارة جيدة.
    out.push(
      makeInsight(
        'crm',
        'good',
        'agents.insight.vipActiveTitle',
        'agents.insight.vipActiveBody',
        { count: d.vipCount },
        [],
        { labelKey: 'agents.action.openCustomers', permission: 'customers.read', route: '/(app)/customers' },
        now,
      ),
    );
  }
  return out;
}

// ── وكيل الكاشير ──
function cashierRules(d: AgentDataInput, now: string): AgentInsight[] {
  if (d.unpaidOrderCount === 0) return [];
  return [
    makeInsight(
      'cashier',
      'critical',
      'agents.insight.unpaidTitle',
      'agents.insight.unpaidBody',
      { count: d.unpaidOrderCount },
      [],
      { labelKey: 'agents.action.reviewOrders', permission: 'orders.read', route: '/(app)/orders' },
      now,
    ),
  ];
}

// ── وكيل الأعمال (لوحة عامة) ──
function businessRules(d: AgentDataInput, now: string): AgentInsight[] {
  // عدد التنبيهات الحرجة/التحذيرية عبر المجالات.
  const alerts = d.outOfStockCount + d.lowStockCount + d.pendingPurchaseCount + d.unpaidOrderCount;
  return [
    makeInsight(
      'business',
      alerts > 0 ? 'info' : 'good',
      'agents.insight.dailyBriefTitle',
      'agents.insight.dailyBriefBody',
      { alerts, orders: d.todayPaidOrders },
      ['moneyRevenue'],
      { labelKey: 'agents.action.viewReports', permission: 'reports.view', route: '/(app)/(tabs)/reports' },
      now,
    ),
  ];
}

// يشغّل كل الوكلاء ويعيد الرؤى مرتّبة: الأكثر خطورة أولًا.
export function runAgents(d: AgentDataInput, now: string = new Date().toISOString()): AgentInsight[] {
  const insights = [
    ...inventoryRules(d, now),
    ...salesRules(d, now),
    ...financeRules(d, now),
    ...procurementRules(d, now),
    ...crmRules(d, now),
    ...cashierRules(d, now),
    ...businessRules(d, now),
  ];
  // فرزة تنازلية بالخطورة، ثم الأحدث أولًا.
  return insights.sort((a, b) => {
    const rank = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rank !== 0) return rank;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
