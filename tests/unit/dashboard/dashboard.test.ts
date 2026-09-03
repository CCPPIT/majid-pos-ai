/**
 * اختبارات PHASE 10 — لوحة التحكم الديناميكية.
 * تغطي: فلترة العناصر بالصلاحية، المؤشرات التجريبية للنطاق، المستودع،
 * وإجراءات العناصر (تنقّل/لافتة).
 */
import { AppDashboardRepository } from '@/data/repositories/dashboard.repository';
import { MockDashboardSource } from '@/data/sources/dashboard.source';
import { WIDGETS, visibleWidgets } from '@/domain/security/dashboard-widgets';
import type { QueryScope } from '@/domain/tenancy/scope';
import { getWidgetAction, WIDGET_ACTIONS } from '@/features/dashboard/widget-actions';

// صلاحيات الكاشير (نقطة البيع أساسًا).
const CASHIER_PERMS = ['pos.sale.create', 'pos.cart.read', 'order.read', 'sales.read'];
// صلاحيات المدير (تقارير/مخزون/موظفون/عملاء).
const MANAGER_PERMS = [
  'pos.sale.create',
  'sales.read',
  'order.read',
  'reports.view',
  'reports.read',
  'inventory.read',
  'employees.read',
  'customer.read',
  'finance.read',
  'ai.read',
  'ai.manage',
  'forecasting.read',
];

describe('PHASE 10 — widget registry filtering', () => {
  it('السجل يحتوي 14 عنصرًا بمعرفات فريدة', () => {
    expect(WIDGETS).toHaveLength(14);
    const ids = WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length); // لا تكرار.
  });

  it('الكاشير يرى عناصر البيع فقط', () => {
    const visible = visibleWidgets(CASHIER_PERMS).map((w) => w.id);
    expect(visible).toContain('new-sale'); // بيع جديد.
    expect(visible).toContain('cart'); // السلة.
    expect(visible).toContain('orders'); // الطلبات.
    expect(visible).toContain('todays-sales'); // مبيعات اليوم.
    expect(visible).not.toContain('finance'); // المالية مخفية.
    expect(visible).not.toContain('employees'); // الموظفون مخفون.
    expect(visible).not.toContain('ai-agents'); // وكلاء AI مخفون.
  });

  it('المدير يرى العناصر الإدارية والـ AI', () => {
    const visible = visibleWidgets(MANAGER_PERMS).map((w) => w.id);
    expect(visible).toContain('revenue');
    expect(visible).toContain('inventory');
    expect(visible).toContain('employees');
    expect(visible).toContain('finance');
    expect(visible).toContain('ai-insights');
    expect(visible).toContain('forecast');
    expect(visible).toContain('ai-agents');
    expect(visible).toContain('alerts');
  });

  it('الصلاحية المطلقة (*) تُظهر كل العناصر', () => {
    expect(visibleWidgets(['*'])).toHaveLength(14);
  });

  it('بلا صلاحيات لا يظهر أي عنصر', () => {
    expect(visibleWidgets([])).toHaveLength(0);
  });
});

describe('PHASE 10 — dashboard source & repository', () => {
  it('المصدر يُرجع مؤشرات لكل عناصر السجل عدا بطاقة الإجراء', async () => {
    const source = new MockDashboardSource();
    const scope: QueryScope = { tenantId: 't1' as never, organizationId: 'o1' as never, branchId: 'b1' as never, storeId: 's1' as never };
    const snapshot = await source.getDashboardSnapshot(scope, 'YER');
    expect(snapshot.currency).toBe('YER');
    expect(snapshot.metrics['todays-sales']?.amount).toBeGreaterThan(0);
    expect(snapshot.metrics['orders']?.count).toBeGreaterThanOrEqual(0);
    expect(snapshot.metrics['new-sale']).toBeUndefined(); // بطاقة إجراء بلا مؤشر.
    // المؤشر النصي يحمل مفتاح ترجمة لا نصًا خامًا.
    expect(snapshot.metrics['ai-insights']?.textKey).toBeDefined();
  });

  it('القيم تختلف باختلاف النطاق (تضييق المتجر/الفرع)', async () => {
    const source = new MockDashboardSource();
    const storeA: QueryScope = { storeId: 's1' } as QueryScope;
    const storeB: QueryScope = { storeId: 's2' } as QueryScope;
    const a = await source.getDashboardSnapshot(storeA, 'YER');
    const b = await source.getDashboardSnapshot(storeB, 'YER');
    // بصمتان مختلفتان → قيم مختلفة (توضيح أن النطاق مؤثر).
    expect(a.metrics['todays-sales']?.amount).not.toBe(b.metrics['todays-sales']?.amount);
  });

  it('المستودع يفوّض للمصدر ويعيد اللقطة', async () => {
    const repo = new AppDashboardRepository(new MockDashboardSource());
    const snapshot = await repo.getSnapshot({ storeId: 's1' } as QueryScope, 'SAR');
    expect(snapshot.currency).toBe('SAR');
    expect(snapshot.generatedAt).toBeDefined();
  });
});

describe('PHASE 10 — widget actions', () => {
  it('كل عنصر في السجل له إجراء معرّف', () => {
    for (const widget of WIDGETS) {
      expect(WIDGET_ACTIONS[widget.id]).toBeDefined();
    }
  });

  it('الإجراءات التنقلية تشير لمسارات قائمة', () => {
    expect(getWidgetAction('new-sale').href).toBe('/(app)/(tabs)/pos');
    expect(getWidgetAction('orders').href).toBe('/(app)/(tabs)/orders');
    expect(getWidgetAction('reports').href).toBe('/(app)/(tabs)/reports');
  });

  it('العناصر غير المنفذة لافتات بمرحلتها (لا سلوك وهمي)', () => {
    expect(getWidgetAction('inventory').kind).toBe('placeholder');
    expect(getWidgetAction('employees').kind).toBe('placeholder');
    expect(getWidgetAction('finance').kind).toBe('placeholder');
    expect(getWidgetAction('ai-agents').kind).toBe('placeholder');
    // عنصر مجهول → لافتة افتراضية.
    expect(getWidgetAction('unknown-x').kind).toBe('placeholder');
  });
});
