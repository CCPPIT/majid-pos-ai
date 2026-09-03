/**
 * اختبارات الوكلاء الأذكياء وخط أمان الإجراءات (PHASE 25).
 * تغطي محرّك القواعد النقي (رؤى كل وكيل، الخطورة، الفرز) وخط الأمان
 * (حجب الرؤى حسب صلاحيات المجال، وإزالة أزرار الإجراءات دون صلاحية).
 */
import { runAgents, applySafetyPipeline, AGENTS } from '@/domain/agents';
import type { AgentDataInput } from '@/domain/agents';

// مدخلات بيانات أساسية (متجر هادئ/سليم).
function baseData(over: Partial<AgentDataInput> = {}): AgentDataInput {
  return {
    todayRevenue: 0,
    todayPaidOrders: 0,
    prevRevenue: 0,
    tax: 0,
    discount: 0,
    currency: 'YER',
    lowStockCount: 0,
    outOfStockCount: 0,
    pendingPurchaseCount: 0,
    vipCount: 0,
    unorderedVipCount: 0,
    unpaidOrderCount: 0,
    todayExpenses: 0,
    ...over,
  };
}

// يختصر البحث عن رؤيا بمفتاح جسم معين.
function bodies(insights: ReturnType<typeof runAgents>): string[] {
  return insights.map((i) => i.bodyKey);
}

describe('agents catalog', () => {
  test('defines exactly seven agents', () => {
    expect(AGENTS).toHaveLength(7);
    const ids = AGENTS.map((a) => a.id).sort();
    expect(ids).toEqual(['business', 'cashier', 'crm', 'finance', 'inventory', 'procurement', 'sales']);
  });
});

describe('inventory agent rules', () => {
  test('flags out-of-stock as critical', () => {
    const out = runAgents(baseData({ outOfStockCount: 3 }));
    const crit = out.find((i) => i.severity === 'critical' && i.agentId === 'inventory');
    expect(crit).toBeDefined();
    expect(crit?.params.count).toBe(3);
  });

  test('flags low-stock as warning', () => {
    const out = runAgents(baseData({ lowStockCount: 2 }));
    expect(bodies(out)).toContain('agents.insight.lowStockBody');
  });

  test('healthy stock produces good insight', () => {
    const out = runAgents(baseData());
    expect(bodies(out)).toContain('agents.insight.stockHealthyBody');
  });
});

describe('sales agent rules', () => {
  test('no sales today → warning', () => {
    const out = runAgents(baseData());
    expect(bodies(out)).toContain('agents.insight.noSalesBody');
  });

  test('growth above previous → good with pct', () => {
    const out = runAgents(baseData({ todayRevenue: 20000, todayPaidOrders: 5, prevRevenue: 10000 }));
    const up = out.find((i) => i.bodyKey === 'agents.insight.salesUpBody');
    expect(up).toBeDefined();
    expect(up?.severity).toBe('good');
    expect(up?.params.pct).toBe(100);
  });

  test('decline below previous → warning', () => {
    const out = runAgents(baseData({ todayRevenue: 5000, todayPaidOrders: 2, prevRevenue: 10000 }));
    const down = out.find((i) => i.bodyKey === 'agents.insight.salesDownBody');
    expect(down?.severity).toBe('warning');
    expect(down?.params.pct).toBe(50);
  });
});

describe('finance agent rules', () => {
  test('expenses over half revenue → warning with ratio', () => {
    const out = runAgents(baseData({ todayRevenue: 10000, todayPaidOrders: 3, prevRevenue: 0, todayExpenses: 7000 }));
    const high = out.find((i) => i.bodyKey === 'agents.insight.expenseHighBody');
    expect(high).toBeDefined();
    expect(high?.params.pct).toBe(70);
  });

  test('moderate expenses → info only', () => {
    const out = runAgents(baseData({ todayRevenue: 10000, todayPaidOrders: 3, todayExpenses: 2000 }));
    expect(bodies(out)).toContain('agents.insight.expenseLoggedBody');
    expect(bodies(out)).not.toContain('agents.insight.expenseHighBody');
  });
});

describe('procurement / crm / cashier rules', () => {
  test('pending purchase orders → warning', () => {
    const out = runAgents(baseData({ pendingPurchaseCount: 2 }));
    const po = out.find((i) => i.bodyKey === 'agents.insight.pendingPoBody');
    expect(po?.params.count).toBe(2);
  });

  test('inactive VIP customers → info', () => {
    const out = runAgents(baseData({ vipCount: 4, unorderedVipCount: 2 }));
    const vip = out.find((i) => i.bodyKey === 'agents.insight.vipInactiveBody');
    expect(vip?.params.count).toBe(2);
  });

  test('active VIP customers → good', () => {
    const out = runAgents(baseData({ vipCount: 4, unorderedVipCount: 0 }));
    expect(bodies(out)).toContain('agents.insight.vipActiveBody');
  });

  test('unpaid orders → critical', () => {
    const out = runAgents(baseData({ unpaidOrderCount: 3 }));
    const unpaid = out.find((i) => i.bodyKey === 'agents.insight.unpaidBody');
    expect(unpaid?.severity).toBe('critical');
    expect(unpaid?.params.count).toBe(3);
  });
});

describe('business agent & sorting', () => {
  test('always produces a daily brief', () => {
    const out = runAgents(baseData());
    expect(bodies(out)).toContain('agents.insight.dailyBriefBody');
  });

  test('sorts critical first', () => {
    const out = runAgents(baseData({ outOfStockCount: 1, unpaidOrderCount: 1, todayRevenue: 5000, todayPaidOrders: 2, prevRevenue: 4000 }));
    expect(out[0]?.severity).toBe('critical');
  });
});

describe('action safety pipeline', () => {
  const allPerms = ['reports.view', 'inventory.read', 'finance.read', 'procurement.read', 'customers.read', 'orders.read'];

  test('with all permissions, every insight is visible', () => {
    const insights = runAgents(baseData({ outOfStockCount: 1, pendingPurchaseCount: 1, unpaidOrderCount: 1, vipCount: 1 }));
    const { visible, hiddenCount } = applySafetyPipeline(insights, allPerms);
    expect(hiddenCount).toBe(0);
    expect(visible).toHaveLength(insights.length);
  });

  test('hides inventory insights when lacking inventory.read', () => {
    const insights = runAgents(baseData({ outOfStockCount: 2 }));
    const perms = allPerms.filter((p) => p !== 'inventory.read');
    const { visible, hiddenCount } = applySafetyPipeline(insights, perms);
    expect(visible.find((i) => i.agentId === 'inventory')).toBeUndefined();
    expect(hiddenCount).toBeGreaterThan(0);
  });

  test('removes action button when the action permission is missing but keeps insight', () => {
    // مخزون منخفض: رؤياه تظهر بصلاحية inventory.read لكن زرها "إنشاء أمر شراء"
    // يتطلب procurement.read — المحجوب هنا، فيُزال الزر مع بقاء الرؤيا.
    const insights = runAgents(baseData({ lowStockCount: 2 }));
    const perms = ['reports.view', 'inventory.read', 'finance.read', 'customers.read', 'orders.read'];
    const { visible } = applySafetyPipeline(insights, perms);
    const low = visible.find((i) => i.agentId === 'inventory' && i.bodyKey === 'agents.insight.lowStockBody');
    expect(low).toBeDefined(); // الرؤيا ظاهرة.
    expect(low?.action).toBeUndefined(); // زر الإجراء محجوب.
  });

  test('never auto-executes: insights carry no execution beyond a route', () => {
    const insights = runAgents(baseData({ outOfStockCount: 1 }));
    for (const i of insights) {
      if (i.action) expect(typeof i.action.route).toBe('string');
    }
  });
});
