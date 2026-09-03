/**
 * اختبارات خط أمان الذكاء الاصطناعي — PHASE 31 · أقسام 48 و59.
 * هذه أهم اختبارات المرحلة أمنيًا: تُثبت أن الذكاء لا يستطيع تعديل
 * أي بيانات دون المرور بالمسار الكامل، وأن كل بوابة تمنع فعلًا.
 */
import { z } from 'zod';
import {
  AI_PIPELINE_STAGES,
  assessRisk,
  buildPreview,
  filterInsightsByPermission,
  gateConfirmation,
  gateIntent,
  gatePermission,
  gateValidation,
  requiresFullPipeline,
  runSafetyPipeline,
  type AIIntent,
} from '@/sdk/ai';

// نية اختبار قابلة للتخصيص.
const makeIntent = (over: Partial<AIIntent> = {}): AIIntent => ({
  type: 'mutate',
  domain: 'products',
  action: 'update',
  resource: 'product',
  parameters: { productId: 'p-1', priceAmount: 1500 },
  confidence: 0.95,
  requiredPermission: 'products.update',
  riskLevel: 'medium',
  ...over,
});

// مخطط معاملات التعديل المستخدم في الاختبارات.
const updateSchema = z.object({
  productId: z.string().min(1),
  priceAmount: z.number().positive(),
});

describe('SDK AI — ترتيب خط الأمان', () => {
  // المراحل السبع معرّفة بالترتيب الصحيح ولا تُتجاوز.
  it('يعرّف المراحل السبع بالترتيب الإلزامي', () => {
    expect(AI_PIPELINE_STAGES).toEqual([
      'intent',
      'permission',
      'validation',
      'preview',
      'confirmation',
      'action',
      'audit',
    ]);
  });
});

describe('SDK AI — تقييم المخاطرة', () => {
  // القراءة بلا مخاطرة.
  it('يصنّف القراءة والتنقّل بلا مخاطرة', () => {
    expect(assessRisk('query', 'read')).toBe('none');
    expect(assessRisk('navigate', 'open')).toBe('none');
    expect(assessRisk('report', 'generate')).toBe('none');
  });

  // النية المجهولة أخطر ما يكون (رفض افتراضي).
  it('يصنّف النية المجهولة كخطر حرج', () => {
    expect(assessRisk('unknown', 'anything')).toBe('critical');
  });

  // الأفعال المالية والحذف عالية الخطورة.
  it('يصنّف الحذف والاسترجاع كخطر عالٍ', () => {
    expect(assessRisk('mutate', 'delete')).toBe('high');
    expect(assessRisk('mutate', 'refund')).toBe('high');
    expect(assessRisk('mutate', 'adjust')).toBe('high');
  });

  // التعديل العادي متوسط.
  it('يصنّف التعديل العادي كخطر متوسط', () => {
    expect(assessRisk('mutate', 'update')).toBe('medium');
  });

  // كل تعديل يمر بالمسار الكامل.
  it('يُلزم كل تعديل بالمسار الكامل', () => {
    expect(requiresFullPipeline(makeIntent({ type: 'mutate' }))).toBe(true);
    expect(requiresFullPipeline(makeIntent({ type: 'unknown', riskLevel: 'critical' }))).toBe(true);
    // القراءة الصرفة معفاة.
    expect(requiresFullPipeline(makeIntent({ type: 'query', riskLevel: 'none' }))).toBe(false);
  });
});

describe('SDK AI — بوابة النية', () => {
  // النية المفهومة عالية الثقة تمر.
  it('يقبل نية واضحة عالية الثقة', () => {
    expect(gateIntent(makeIntent()).allowed).toBe(true);
  });

  // النية المجهولة تُرفض (لا تخمين في عمليات مالية).
  it('يرفض النية المجهولة', () => {
    const decision = gateIntent(makeIntent({ type: 'unknown' }));
    expect(decision.allowed).toBe(false);
    expect(decision.stage).toBe('intent');
  });

  // الثقة المنخفضة تُرفض.
  it('يرفض النية منخفضة الثقة', () => {
    const decision = gateIntent(makeIntent({ confidence: 0.3 }));
    expect(decision.allowed).toBe(false);
    expect(decision.reasonKey).toContain('lowConfidence');
  });
});

describe('SDK AI — بوابة الصلاحية', () => {
  // امتلاك الإذن يسمح بالمتابعة.
  it('يسمح لمن يملك الإذن المطلوب', () => {
    expect(gatePermission(makeIntent(), ['products.update']).allowed).toBe(true);
  });

  // غياب الإذن يمنع (Fail-Closed).
  it('يمنع من لا يملك الإذن', () => {
    const decision = gatePermission(makeIntent(), ['products.read']);
    expect(decision.allowed).toBe(false);
    expect(decision.stage).toBe('permission');
  });

  // نية بلا إذن معرّف تُرفض (لا افتراض سماح).
  it('يمنع النية التي لا تعرّف إذنها', () => {
    const decision = gatePermission(makeIntent({ requiredPermission: '' }), ['*']);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonKey).toContain('noPermissionDefined');
  });

  // بلا أي صلاحيات لا شيء يمر.
  it('يمنع كل تعديل عند غياب الصلاحيات تمامًا', () => {
    expect(gatePermission(makeIntent(), []).allowed).toBe(false);
  });
});

describe('SDK AI — بوابة التحقق', () => {
  // المعاملات الصحيحة تمر مُقوَّمة الأنواع.
  it('يقبل المعاملات المطابقة للمخطط', () => {
    const result = gateValidation(updateSchema, { productId: 'p-1', priceAmount: 1500 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priceAmount).toBe(1500);
  });

  // المعاملات الخاطئة تُرفض بخطأ تحقق موصوف.
  it('يرفض المعاملات المخالفة ويصف الحقول', () => {
    const result = gateValidation(updateSchema, { productId: '', priceAmount: -5 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  // القيم غير المتوقعة لا تُسقط النظام.
  it('يرفض المدخلات العشوائية بلا رمي استثناء', () => {
    expect(gateValidation(updateSchema, null).success).toBe(false);
    expect(gateValidation(updateSchema, 'نص').success).toBe(false);
  });
});

describe('SDK AI — بوابة المعاينة والتأكيد', () => {
  // المعاينة تحمل دائمًا علم التأكيد الإلزامي.
  it('تبني معاينة تتطلب تأكيدًا دائمًا', () => {
    const preview = buildPreview({
      summaryKey: 'sdk.ai.preview.updatePrice',
      changes: [{ field: 'price', currentValue: '1000', proposedValue: '1500' }],
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.changes).toHaveLength(1);
  });

  // الافتراض المحافظ: غير قابلة للتراجع ما لم يُصرَّح.
  it('تفترض عدم قابلية التراجع افتراضيًا', () => {
    expect(buildPreview({ summaryKey: 'k', changes: [] }).reversible).toBe(false);
  });

  // بلا تأكيد لا تنفيذ (الصمت ليس موافقة).
  it('يمنع التنفيذ بلا تأكيد صريح', () => {
    const decision = gateConfirmation(false, true);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonKey).toContain('notConfirmed');
  });

  // بلا معاينة معروضة لا تنفيذ (المستخدم لم يرَ الأثر).
  it('يمنع التنفيذ إن لم تُعرض المعاينة', () => {
    const decision = gateConfirmation(true, false);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonKey).toContain('previewNotShown');
  });

  // التأكيد بعد المعاينة يسمح.
  it('يسمح بعد عرض المعاينة والتأكيد', () => {
    expect(gateConfirmation(true, true).allowed).toBe(true);
  });
});

describe('SDK AI — خط الأمان الكامل', () => {
  // المسار السعيد ينتهي بمعاينة تنتظر التأكيد — لا بتنفيذ.
  it('ينتهي بمعاينة تنتظر التأكيد لا بتنفيذ', () => {
    const result = runSafetyPipeline({
      intent: makeIntent(),
      permissions: ['products.update'],
      schema: updateSchema,
      summaryKey: 'sdk.ai.preview.updatePrice',
      changes: [{ field: 'price', currentValue: '1000', proposedValue: '1500' }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // النتيجة تحمل معاينة تتطلب تأكيدًا.
    expect(result.data.requiresConfirmation).toBe(true);
    expect(result.data.preview.requiresConfirmation).toBe(true);
    // والمعاملات مُتحقَّق منها.
    expect(result.data.parameters.productId).toBe('p-1');
  });

  // غياب الصلاحية يوقف المسار عند البوابة الثانية.
  it('يوقف المسار عند غياب الصلاحية', () => {
    const result = runSafetyPipeline({
      intent: makeIntent(),
      permissions: [],
      schema: updateSchema,
      summaryKey: 'k',
      changes: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('AUTHORIZATION_ERROR');
  });

  // النية المجهولة توقف المسار عند البوابة الأولى قبل أي فحص آخر.
  it('يوقف النية المجهولة قبل فحص الصلاحية', () => {
    const result = runSafetyPipeline({
      intent: makeIntent({ type: 'unknown' }),
      permissions: ['*', 'products.update'],
      schema: updateSchema,
      summaryKey: 'k',
      changes: [],
    });
    expect(result.success).toBe(false);
    // الخطأ خطأ تحقق مرحلة النية لا خطأ تفويض.
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  // معاملات خاطئة توقف المسار قبل بناء المعاينة.
  it('يوقف المعاملات المخالفة قبل المعاينة', () => {
    const result = runSafetyPipeline({
      intent: makeIntent({ parameters: { productId: '', priceAmount: -1 } }),
      permissions: ['products.update'],
      schema: updateSchema,
      summaryKey: 'k',
      changes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('SDK AI — فلترة الرؤى', () => {
  // رؤى الاختبار.
  const insights = [
    { id: '1', requiredPermission: 'inventory.read', title: 'مخزون' },
    { id: '2', requiredPermission: 'finance.read', title: 'مالية' },
    {
      id: '3',
      requiredPermission: 'inventory.read',
      title: 'تنبيه',
      suggestedAction: { permission: 'inventory.adjust', labelKey: 'k', route: '/inventory' },
    },
  ];

  // الرؤية خارج صلاحية المستخدم تُحذف كاملة (لا تسريب عبر العنوان).
  it('يحجب الرؤى خارج صلاحيات المستخدم كاملةً', () => {
    const result = filterInsightsByPermission(insights, ['inventory.read']);
    expect(result.visible).toHaveLength(2);
    expect(result.hiddenCount).toBe(1);
    // الرؤية المالية محجوبة تمامًا.
    expect(result.visible.some((insight) => insight.requiredPermission === 'finance.read')).toBe(false);
  });

  // زر الإجراء يُزال وحده إن غابت صلاحيته مع بقاء الرؤية.
  it('يزيل زر الإجراء دون حجب الرؤية', () => {
    const result = filterInsightsByPermission(insights, ['inventory.read']);
    // الرؤية الثالثة ظاهرة لكن بلا زر إجراء.
    const third = result.visible.find((insight) => insight.id === '3');
    expect(third).toBeDefined();
    expect(third?.suggestedAction).toBeUndefined();
  });

  // امتلاك صلاحية الإجراء يُبقي الزر.
  it('يُبقي زر الإجراء لمن يملك صلاحيته', () => {
    const result = filterInsightsByPermission(insights, ['inventory.read', 'inventory.adjust']);
    const third = result.visible.find((insight) => insight.id === '3');
    expect(third?.suggestedAction).toBeDefined();
  });

  // بلا صلاحيات لا يظهر شيء.
  it('يحجب كل الرؤى عند غياب الصلاحيات', () => {
    const result = filterInsightsByPermission(insights, []);
    expect(result.visible).toHaveLength(0);
    expect(result.hiddenCount).toBe(3);
  });
});
