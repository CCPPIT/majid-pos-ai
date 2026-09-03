/**
 * اختبار تكامل — تفويض RBAC عبر الطبقات (PHASE 28).
 * يثبت أن الصلاحيات المشتقة من الأدوار تُقيّد الوصول فعلًا (إخفاء الواجهة
 * ليس أمنًا): محرّك التفويض يرفض بلا صلاحية، وخط أمان وكلاء الذكاء يحجب
 * الرؤى حسب الصلاحيات، ونواة الصلاحيات ترفض الإجراءات الحساسة.
 */
import {
  getRoleByCode,
  collectPermissions,
  effectiveScope,
  authorize,
} from '@/domain/security';
import { hasPermission, assertPermission } from '@/security/permissions/permission';
import { runAgents, applySafetyPipeline } from '@/domain/agents';
import { BusinessRuleViolationError } from '@/core/errors/AppError';

// يجمع صلاحيات دور بالكود.
function permsFor(roleCode: string): string[] {
  const role = getRoleByCode(roleCode);
  expect(role).toBeDefined();
  return collectPermissions([role!]);
}

describe('تكامل: RBAC يقيّد الوصول عبر الطبقات', () => {
  test('الكاشير يملك صلاحيات البيع دون التقارير/التدقيق/تسوية المخزون', () => {
    const perms = permsFor('cashier');
    expect(hasPermission(perms, 'payment.create')).toBe(true);
    expect(hasPermission(perms, 'receipt.create')).toBe(true);
    // قراءة المخزون/الطلبات مسموحة للكاشير.
    expect(hasPermission(perms, 'inventory.read')).toBe(true);
    expect(hasPermission(perms, 'order.read')).toBe(true);
    // لا صلاحيات إدارية/تقارير/تدقيق/تسوية.
    expect(hasPermission(perms, 'reports.view')).toBe(false);
    expect(hasPermission(perms, 'inventory.adjust')).toBe(false);
    expect(hasPermission(perms, 'audit.read')).toBe(false);
  });

  test('مدير المتجر يملك صلاحيات أوسع من الكاشير (تقارير/مخزون)', () => {
    const perms = permsFor('store-manager');
    expect(hasPermission(perms, 'reports.view')).toBe(true); // الكاشير لا يملكها.
    expect(hasPermission(perms, 'inventory.read')).toBe(true);
    // سجل التدقيق نطاقه tenant — مخصص للأدوار العليا/مسؤول الأمان، ليس مدير المتجر.
    expect(hasPermission(perms, 'audit.read')).toBe(false);
    expect(hasPermission(permsFor('security-administrator'), 'audit.read')).toBe(true);
  });

  test('super-admin يملك كل شيء عبر البدل الشامل', () => {
    const perms = permsFor('super-admin');
    expect(hasPermission(perms, 'anything.at.all')).toBe(true); // البدل '*'.
  });

  test('assertPermission يرمي خطأ تفويض عند غياب الصلاحية (لا مجرد إخفاء)', () => {
    const perms = permsFor('cashier');
    // الإجراء الحساس يُرفض برمي خطأ (تُستخدم في معالجات الأفعال لا الواجهة فقط).
    expect(() => assertPermission(perms, 'reports.view')).toThrow(BusinessRuleViolationError);
    // بينما يمر الإجراء المسموح دون رمي.
    expect(() => assertPermission(perms, 'pos.sale.create')).not.toThrow();
  });

  test('محرك التفويض يفرض النطاق: الكاشير (متجر) لا يُؤذَن لنطاق أوسع', () => {
    const cashierRole = getRoleByCode('cashier')!;
    const scope = effectiveScope([cashierRole]);
    // فعل على مستوى المتجر يمر إن وُجدت الصلاحية.
    expect(authorize(collectPermissions([cashierRole]), 'order.read', scope, 'store').allowed).toBe(true);
    // فعل يتطلب نطاق المنظمة يُرفض بنطاق (SCOPE_DENIED) حتى مع صلاحية قراءة.
    const wide = authorize(collectPermissions([cashierRole]), 'order.read', scope, 'organization');
    expect(wide.allowed).toBe(false);
    expect(wide.reason).toBe('SCOPE_DENIED');
  });

  test('خط أمان الوكلاء يحجب رؤى المجالات غير المصرّح بها فعليًا', () => {
    // بيانات تستثير رؤى من كل الوكلاء.
    const data = {
      todayRevenue: 5000, todayPaidOrders: 3, prevRevenue: 4000,
      tax: 300, discount: 100, currency: 'YER',
      lowStockCount: 2, outOfStockCount: 1, pendingPurchaseCount: 1,
      vipCount: 3, unorderedVipCount: 1, unpaidOrderCount: 1, todayExpenses: 0,
    };
    const insights = runAgents(data);
    expect(insights.length).toBeGreaterThan(0);

    // كاشير: يملك inventory.read فقط من بين الوكلاء؛ تُحجب المالية/المشتريات/
    // المبيعات/الأعمال (reports.view) والعملاء (customers.read بصيغة الجمع).
    const cashierPerms = permsFor('cashier');
    const cashierView = applySafetyPipeline(insights, cashierPerms);
    const visibleAgents = new Set(cashierView.visible.map((i) => i.agentId));
    expect(visibleAgents.has('inventory')).toBe(true); // يملك inventory.read.
    expect(visibleAgents.has('sales')).toBe(false); // يتطلب reports.view.
    expect(visibleAgents.has('business')).toBe(false);
    expect(visibleAgents.has('finance')).toBe(false); // يتطلب finance.read.
    expect(visibleAgents.has('procurement')).toBe(false); // يتطلب procurement.read.
    expect(visibleAgents.has('crm')).toBe(false); // يتطلب customers.read (جمع).
    expect(cashierView.hiddenCount).toBeGreaterThan(0);

    // زر إجراء إعادة الطلب (procurement.read) يجب أن يُزال من رؤيا المخزون
    // المنخفض حتى مع ظهور الرؤيا نفسها (إخفاء الفعل دون حجب المعلومة).
    const lowStockInsight = cashierView.visible.find(
      (i) => i.agentId === 'inventory' && i.bodyKey === 'agents.insight.lowStockBody',
    );
    expect(lowStockInsight).toBeDefined();
    expect(lowStockInsight?.action).toBeUndefined();

    // مدير متجر: يرى عددًا أكبر من الوكلاء.
    const managerView = applySafetyPipeline(insights, permsFor('store-manager'));
    expect(managerView.visible.length).toBeGreaterThan(cashierView.visible.length);
  });
});
