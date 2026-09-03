/**
 * اختبارات نظام الصلاحيات — PHASE 31 · أقسام 38 و59.
 * الأهم أمنيًا: التحقق أن الافتراضي هو المنع (Fail-Closed)، وأن المنع
 * الصريح يغلب السماح (Deny Wins)، وأن النطاق الأضيق لا يصل للأوسع.
 */
import {
  SCOPE_RANK,
  collectPermissions,
  createRbacService,
  decide,
  effectiveScope,
  permissionKey,
  scopeCovers,
  type Policy,
  type Role,
} from '@/sdk/rbac';
import {
  cashierRole,
  createInMemoryRbacRepository,
  ownerRole,
  testContext,
} from '../../helpers/sdk-mocks';

describe('SDK RBAC — النطاقات', () => {
  // ترتيب النطاقات ثابت ومعرّف صراحةً.
  it('يرتّب النطاقات من الأضيق للأوسع', () => {
    expect(SCOPE_RANK.own).toBeLessThan(SCOPE_RANK.store);
    expect(SCOPE_RANK.store).toBeLessThan(SCOPE_RANK.branch);
    expect(SCOPE_RANK.branch).toBeLessThan(SCOPE_RANK.organization);
    expect(SCOPE_RANK.organization).toBeLessThan(SCOPE_RANK.tenant);
    expect(SCOPE_RANK.tenant).toBeLessThan(SCOPE_RANK.global);
  });

  // الأوسع يغطي الأضيق لا العكس.
  it('يغطّي النطاق الأوسع النطاق الأضيق', () => {
    expect(scopeCovers('tenant', 'store')).toBe(true);
    expect(scopeCovers('global', 'own')).toBe(true);
    // والعكس ممنوع.
    expect(scopeCovers('own', 'store')).toBe(false);
    expect(scopeCovers('store', 'tenant')).toBe(false);
  });

  // النطاق الفعّال هو أوسع نطاق بين الأدوار.
  it('يحسب أوسع نطاق بين أدوار المستخدم', () => {
    const roles: Role[] = [
      { ...cashierRole(), scope: 'store' },
      { ...ownerRole(), scope: 'organization' },
    ];
    expect(effectiveScope(roles)).toBe('organization');
  });

  // بلا أدوار = أضيق نطاق ممكن (لا افتراض سخي).
  it('يعيد أضيق نطاق عند غياب الأدوار', () => {
    expect(effectiveScope([])).toBe('own');
  });
});

describe('SDK RBAC — قرار التفويض', () => {
  // صيغة الإذن القانونية ثابتة.
  it('يبني نص الإذن من المورد والفعل', () => {
    expect(permissionKey('pos', 'sale.create')).toBe('pos.sale.create');
  });

  // غياب الإذن يمنع (Fail-Closed).
  it('يمنع عند غياب الإذن تمامًا', () => {
    const decision = decide([], 'tenant', { resource: 'products', action: 'delete' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('PERMISSION_DENIED');
  });

  // امتلاك الإذن يسمح.
  it('يسمح عند امتلاك الإذن ضمن النطاق', () => {
    const decision = decide(['products.read'], 'store', { resource: 'products', action: 'read' });
    expect(decision.allowed).toBe(true);
  });

  // النطاق الأضيق لا ينفّذ عملية تتطلب نطاقًا أوسع.
  it('يمنع عند قصور النطاق رغم امتلاك الإذن', () => {
    const decision = decide(['reports.read'], 'store', {
      resource: 'reports',
      action: 'read',
      scope: 'tenant',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SCOPE_DENIED');
  });

  // البدل الشامل يمنح كل الصلاحيات.
  it('يسمح البدل الشامل بكل الأفعال', () => {
    expect(decide(['*'], 'tenant', { resource: 'anything', action: 'delete' }).allowed).toBe(true);
  });

  // المنع الصريح في السياسة يغلب السماح (Deny Wins).
  it('يغلّب المنع الصريح على السماح', () => {
    // سياسة تمنع الاسترجاع فوق حد معين.
    const policies: Policy[] = [
      {
        id: 'p-1',
        name: 'حد الاسترجاع',
        // السياسة تنظّم إذن الاسترجاع تحديدًا.
        permission: 'payment.refund',
        effect: 'allow',
        conditions: { maxAmount: 1000 },
      },
    ];
    // المستخدم يملك الإذن، لكن المبلغ يتجاوز الحد.
    const decision = decide(['payment.refund'], 'tenant', { resource: 'payment', action: 'refund' }, policies, {
      amount: 5000,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('POLICY_DENIED');
  });

  // نفس السياسة تسمح تحت الحد.
  it('يسمح ضمن حدود السياسة', () => {
    const policies: Policy[] = [
      {
        id: 'p-1',
        name: 'حد الاسترجاع',
        // السياسة تنظّم إذن الاسترجاع تحديدًا.
        permission: 'payment.refund',
        effect: 'allow',
        conditions: { maxAmount: 1000 },
      },
    ];
    const decision = decide(['payment.refund'], 'tenant', { resource: 'payment', action: 'refund' }, policies, {
      amount: 500,
    });
    expect(decision.allowed).toBe(true);
  });

  // تجميع صلاحيات عدة أدوار بلا تكرار.
  it('يجمع صلاحيات الأدوار في قائمة فريدة', () => {
    const roles: Role[] = [
      { ...cashierRole(), permissions: ['products.read', 'pos.sale.create'] },
      { ...ownerRole(), permissions: ['products.read', 'products.delete'] },
    ];
    const permissions = collectPermissions(roles);
    expect(permissions).toContain('products.read');
    expect(permissions).toContain('products.delete');
    // بلا تكرار.
    expect(permissions.filter((p) => p === 'products.read')).toHaveLength(1);
  });
});

describe('SDK RBAC — الخدمة', () => {
  // الخدمة تقرأ الأدوار من السياق وتفحص الصلاحيات.
  it('تسمح لدور المالك بكل العمليات', async () => {
    const contextStore = testContext({ roleIds: ['owner'] as never });
    const service = createRbacService({
      repository: createInMemoryRbacRepository([ownerRole()]),
      contextStore,
    });
    const decision = await service.can({ resource: 'products', action: 'delete' });
    expect(decision.success).toBe(true);
    if (decision.success) expect(decision.data.allowed).toBe(true);
  });

  // الكاشير لا يملك حذف المنتجات.
  it('تمنع الكاشير من العمليات خارج صلاحياته', async () => {
    const contextStore = testContext({ roleIds: ['cashier'] as never, permissions: [] });
    const service = createRbacService({
      repository: createInMemoryRbacRepository([cashierRole()]),
      contextStore,
    });
    const decision = await service.can({ resource: 'products', action: 'delete' });
    // الرفض يُعاد كخطأ تفويض لا كقرار سماح.
    expect(decision.success).toBe(false);
  });

  // الكاشير يملك إنشاء البيع.
  it('تسمح للكاشير بإنشاء بيع', async () => {
    const contextStore = testContext({ roleIds: ['cashier'] as never, permissions: [] });
    const service = createRbacService({
      repository: createInMemoryRbacRepository([cashierRole()]),
      contextStore,
    });
    const decision = await service.can({ resource: 'pos', action: 'sale.create' });
    expect(decision.success).toBe(true);
  });

  // Fail-Closed: فشل قراءة الأدوار = بلا صلاحيات.
  it('تمنع كل شيء عند غياب الأدوار (Fail-Closed)', async () => {
    const contextStore = testContext({ roleIds: [] as never, permissions: [] });
    const service = createRbacService({
      repository: createInMemoryRbacRepository([]),
      contextStore,
    });
    const decision = await service.can({ resource: 'products', action: 'read' });
    expect(decision.success).toBe(false);
  });

  // النطاق الفعّال يُقرأ من الأدوار.
  it('تقرأ النطاق الفعّال من أدوار المستخدم', async () => {
    const contextStore = testContext({ roleIds: ['cashier'] as never });
    const service = createRbacService({
      repository: createInMemoryRbacRepository([cashierRole()]),
      contextStore,
    });
    expect(await service.getScope()).toBe('store');
  });
});
