/**
 * اختبارات نظام RBAC (PHASE 07).
 * تغطي: عدد الأدوار، تفرد الأكواد، الصلاحيات حسب الدور، النطاقات،
 * محرك التفويض، وعناصر لوحة التحكم الديناميكية.
 */
import {
  ROLES, // كل الأدوار الـ100.
  getRoleByCode, // استرجاع دور بالكود.
  collectPermissions, // تجميع صلاحيات أدوار.
  effectiveScope, // النطاق الأقصى.
  can, // فحص إذن بسيط.
  authorize, // فحص إذن + نطاق.
  scopeCovers, // مقارنة النطاقات.
  visibleWidgets, // عناصر اللوحة المرئية.
  PERMISSION_CATALOG, // فهرس الصلاحيات.
} from '@/domain/security';

// نختصر أدوارًا معروفة للاختبارات.
const perms = (code: string) => collectPermissions([getRoleByCode(code)!]);

describe('فهرس الأدوار الـ100', () => {
  it('يحتوي على 100 دور بالضبط', () => {
    expect(ROLES).toHaveLength(100);
  });

  it('أكواد الأدوار فريدة', () => {
    const codes = ROLES.map((r) => r.code);
    expect(new Set(codes).size).toBe(100);
  });

  it('الأدوار العليا تملك صلاحية مطلقة', () => {
    for (const code of ['platform-owner', 'super-admin', 'organization-owner']) {
      expect(perms(code)).toContain('*');
    }
  });
});

describe('صلاحيات الكاشير', () => {
  it('يستطيع البيع وإدارة السلة والدفع', () => {
    const p = perms('cashier');
    expect(p).toContain('pos.sale.create');
    expect(p).toContain('pos.cart.update');
    expect(p).toContain('payment.create');
    expect(p).toContain('receipt.create');
  });

  it('لا يستطيع التقارير ولا المالية ولا إدارة المستخدمين', () => {
    const p = perms('cashier');
    expect(can(p, 'reports.view')).toBe(false);
    expect(can(p, 'finance.manage')).toBe(false);
    expect(can(p, 'users.manage')).toBe(false);
    expect(can(p, 'platform.manage')).toBe(false);
  });

  it('نطاق الكاشير هو المتجر', () => {
    expect(effectiveScope([getRoleByCode('cashier')!])).toBe('store');
  });
});

describe('محرك التفويض مع النطاق', () => {
  it('مدير المتجر يرى التقارير لكنه لا يصل لإدارة المنصة', () => {
    const role = getRoleByCode('store-manager')!;
    const p = collectPermissions([role]);
    expect(authorize(p, 'reports.view', role.scope).allowed).toBe(true);
    expect(can(p, 'platform.manage')).toBe(false);
  });

  it('النطاق الأوسع يغطي الأضيق', () => {
    expect(scopeCovers('branch', 'store')).toBe(true); // فرع يغطي متجرًا.
    expect(scopeCovers('store', 'branch')).toBe(false); // متجر لا يغطي فرعًا.
    expect(scopeCovers('global', 'tenant')).toBe(true); // منصة تغطي مستأجرًا.
    expect(scopeCovers('own', 'store')).toBe(false); // own لا يغطي المتجر.
  });

  it('يمنع إجراءً يتطلب نطاقًا أوسع من نطاق المستخدم', () => {
    // الموظف يملك إذن الحضور لكن نطاقه 'own'؛ قراءة الحضور على مستوى المتجر ممنوعة بالنطاق.
    const employee = getRoleByCode('employee')!;
    const result = authorize(collectPermissions([employee]), 'attendance.read', employee.scope, 'store');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SCOPE_DENIED');
  });

  it('المدير المالي يوافق على دفعات على مستوى المستأجر', () => {
    const cfo = getRoleByCode('cfo')!;
    expect(authorize(collectPermissions([cfo]), 'finance.approve', cfo.scope).allowed).toBe(true);
    expect(cfo.scope).toBe('tenant');
  });
});

describe('النطاق الأقصى لعدة أدوار', () => {
  it('يأخذ أوسع نطاق بين أدوار المستخدم', () => {
    const roles = [getRoleByCode('cashier')!, getRoleByCode('branch-manager')!];
    expect(effectiveScope(roles)).toBe('branch');
  });
});

describe('عناصر لوحة التحكم الديناميكية', () => {
  it('الكاشير يرى بيع/سلة/طلبات ولا يرى الإيراد/المالية/وكلاء AI', () => {
    const ids = visibleWidgets(perms('cashier')).map((w) => w.id);
    expect(ids).toContain('new-sale');
    expect(ids).toContain('cart');
    expect(ids).toContain('orders');
    expect(ids).not.toContain('revenue');
    expect(ids).not.toContain('finance');
    expect(ids).not.toContain('ai-agents');
  });

  it('مدير المتجر يرى الإيراد والمخزون', () => {
    const ids = visibleWidgets(perms('store-manager')).map((w) => w.id);
    expect(ids).toContain('revenue');
    expect(ids).toContain('inventory');
    expect(ids).toContain('employees');
  });

  it('مدير AI يرى وكلاء AI والتنبؤ', () => {
    const ids = visibleWidgets(perms('ai-manager')).map((w) => w.id);
    expect(ids).toContain('ai-agents');
    expect(ids).toContain('forecast');
    expect(ids).toContain('ai-insights');
  });
});

describe('اتساق الفهرس', () => {
  it('كل صلاحية صريحة في الأدوار تشير لمورد معروف أو wildcard', () => {
    const knownResources = new Set(PERMISSION_CATALOG.map((p) => p.resource));
    const violations: string[] = [];
    for (const role of ROLES) {
      for (const permKey of role.permissions) {
        if (permKey === '*') continue; // صلاحية مطلقة.
        const segments = permKey.split('.');
        const resource = segments[0] ?? '';
        const action = segments[1] ?? '';
        if (action !== '*' && !knownResources.has(resource)) violations.push(`${role.code}:${permKey}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
