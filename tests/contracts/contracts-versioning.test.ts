/**
 * اختبارات طبقة العقود — PHASE 32 · أقسام 53 · 54 · 57 · 85.
 *
 * تغطي: الإصدار الدلالي · السجلّ · التوافق · الإهمال · الترحيل ·
 * فارق العقود وبوابة الجودة · التحقق وقت التشغيل · الأحداث ·
 * الأوامر غير المتصلة · القدرات · سيناريو المستهلك (قسم 77).
 */
import {
  API_SEMVER,
  assertVersionPolicy,
  bumpKind,
  CAPABILITIES,
  checkCompatibility,
  compareSemVer,
  contractRegistry,
  createOfflineCommand,
  deprecationRegistry,
  diffContracts,
  DOMAIN_CONTRACT_VERSIONS,
  ERROR_CODES,
  isSemVer,
  isSemVerCompatible,
  isWithinRange,
  migrateContract,
  parseSemVer,
  registerAllContracts,
  SDK_VERSION,
  validateAIOutput,
  validateContract,
  buildEvent,
  transitionOfflineCommand,
  CapabilityRegistry,
  DtoVersionAdapter,
  apiDtoSchema,
  parseAndAdaptDto,
  type ContractShape,
} from '@/contracts';
import { z } from 'zod';
import { migrateSaleV1ToV2, SALE_V1, SALE_V2, saleV1Schema, saleV2Schema } from '@/contracts/sales/sale.contract';
import { aiAssistantOutputSchema } from '@/contracts/ai/ai.contract';
import { paymentSchema } from '@/contracts/payments/payment.contract';
// استيراد المحوّلات يسجّل خطوة ترحيل Sale V1→V2 في المحرّك (أثر جانبي مقصود).
import '@/contracts/adapters';
import { productSchema } from '@/contracts/products/product.contract';
import {
  futurePaymentMethodFixture,
  invalidAIOutputFixture,
  invalidProductFixture,
  saleV1Fixture,
  saleV2Fixture,
  validAIOutputFixture,
  validPaymentFixture,
  validProductFixture,
} from './fixtures';

// نسجّل كل العقود قبل الاختبارات (آمن للتكرار).
beforeAll(() => {
  registerAllContracts();
});

// ── 01 · الإصدار الدلالي (قسم 07) ──
describe('PHASE 32 — Semantic Versioning', () => {
  it('يفكّ ويقارن الإصدارات الدلالية', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(compareSemVer('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareSemVer('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(isSemVer('1.0.0')).toBe(true);
    expect(isSemVer('x.y.z')).toBe(false);
  });

  it('يصنّف القفزات: patch · minor · major', () => {
    expect(bumpKind('1.0.0', '1.0.1')).toBe('patch');
    expect(bumpKind('1.0.0', '1.1.0')).toBe('minor');
    expect(bumpKind('1.0.0', '2.0.0')).toBe('major');
    expect(bumpKind('1.0.0', '1.0.0')).toBe('none');
  });

  it('قاعدة التوافق: نفس الرقم الرئيسي والإصدار ليس أقدم', () => {
    expect(isSemVerCompatible('1.0.0', '1.5.0')).toBe(true); // منتِج أحدث متوافق.
    expect(isSemVerCompatible('1.5.0', '1.0.0')).toBe(false); // منتِج أقدم مطلوبًا منه الأحدث.
    expect(isSemVerCompatible('1.0.0', '2.0.0')).toBe(false); // اختلاف رئيسي كاسر.
  });

  it('يفحص المدى المدعوم [min, max]', () => {
    expect(isWithinRange('1.2.0', '1.0.0', '2.0.0')).toBe(true);
    expect(isWithinRange('0.9.0', '1.0.0', '2.0.0')).toBe(false);
  });

  it('يوجد إصدار SDK واحد ومصدره موحّد', () => {
    expect(SDK_VERSION).toBe('1.1.0');
    expect(API_SEMVER).toBe('1.0.0');
    // كل مجالات المنصّة لها نسخة عقد.
    expect(Object.keys(DOMAIN_CONTRACT_VERSIONS).length).toBeGreaterThanOrEqual(20);
  });
});

// ── 02 · سجلّ العقود (أقسام 12 · 13) ──
describe('PHASE 32 — Contract Registry', () => {
  it('يسجّل كل العقود العلنية ويعرف مدى دعمها', () => {
    const sale = contractRegistry.get('@majid/contracts/sales/Sale');
    expect(sale).toBeDefined();
    expect(sale?.support.current).toBe(SALE_V2);
    expect(sale?.support.minimumSupported).toBe(SALE_V1);
  });

  it('يعتبر النسخ الحالية مدعومة والقديمة جدًا غير مدعومة', () => {
    expect(contractRegistry.isSupported('@majid/contracts/sales/Sale', SALE_V2)).toBe(true);
    expect(contractRegistry.isSupported('@majid/contracts/sales/Sale', '0.9.0')).toBe(false);
  });

  it('يضع علامة الذكاء كتجريبي (experimental)', () => {
    const ai = contractRegistry.get('@majid/contracts/ai/AIResult');
    expect(ai?.stability).toBe('experimental');
  });
});

// ── 03 · مصفوفة التوافق (قسم 14) ──
describe('PHASE 32 — Compatibility Matrix', () => {
  it('يقبل مجموعات النسخ المتوافقة', () => {
    const result = checkCompatibility(
      { sdkVersion: '1.0.0', contractVersion: '1.0.0', apiVersion: API_SEMVER },
      { sdkVersion: '1.1.0', contractVersion: '1.2.0', apiVersion: API_SEMVER },
    );
    expect(result.compatible).toBe(true);
  });

  it('يرفض اختلاف الرقم الرئيسي للعقد', () => {
    const result = checkCompatibility(
      { sdkVersion: '1.0.0', contractVersion: '2.0.0' },
      { sdkVersion: '1.1.0', contractVersion: '1.0.0' },
    );
    expect(result.compatible).toBe(false);
  });

  it('يشير إلى الحاجة للترحيل عند نسخة عقد أقدم', () => {
    const result = checkCompatibility(
      { sdkVersion: '1.0.0', contractVersion: '2.0.0' },
      { sdkVersion: '1.0.0', contractVersion: '1.0.0' },
    );
    // اختلاف رئيسي هنا كاسر؛ نختبر الترحيل ضمن نفس الرئيسي.
    // البيانات/المزوّد الفعلي أقدم (1.0.0) مما يتوقعه المستهلِك (1.5.0) → ترحيل.
    const minor = checkCompatibility(
      { sdkVersion: '1.0.0', contractVersion: '1.5.0' },
      { sdkVersion: '1.0.0', contractVersion: '1.0.0' },
    );
    expect(minor.compatible).toBe(true);
    expect(minor.requiresMigration).toBe(true);
    expect(result.compatible).toBe(false);
  });
});

// ── 04 · الإهمال (أقسام 19 · 20 · 70) ──
describe('PHASE 32 — Deprecation', () => {
  it('يسجّل حقل totalAmount المهجور ببديل وموعد إزالة', () => {
    registerAllContracts();
    const notice = deprecationRegistry.lookup('@majid/contracts/sales/Sale', 'totalAmount');
    expect(notice).toBeDefined();
    expect(notice?.replacement).toBe('total');
    expect(notice?.removeAfter).toBe('3.0.0');
  });

  it('استخدام عنصر مهجور يُبلّغ دون كسر (قسم 70)', () => {
    let reported = false;
    deprecationRegistry.onDeprecatedUsage(() => {
      reported = true;
    });
    const notice = deprecationRegistry.reportUsage('@majid/contracts/sales/Sale', 'totalAmount', 'consumer@1.0');
    expect(notice).toBeDefined();
    expect(reported).toBe(true);
  });
});

// ── 05 · محرّك الترحيل (أقسام 17 · 21 · 78) ──
describe('PHASE 32 — Migration Engine', () => {
  it('يرحّل Sale V1 → V2 ترحيلًا حتميًا (قسم 78)', () => {
    // نتيجة الترحيل اليدوي ثابتة.
    const migrated = migrateSaleV1ToV2(saleV1Schema.parse(saleV1Fixture));
    expect(migrated).toEqual(saleV2Fixture);
    // تكرار الترحيل يعطي نفس النتيجة (deterministic).
    expect(migrateSaleV1ToV2(saleV1Schema.parse(saleV1Fixture))).toEqual(migrated);
    // الناتج يطابق مخطط V2.
    expect(saleV2Schema.safeParse(migrated).success).toBe(true);
  });

  it('يرحّل عبر المحرّك المسجّل ويعيد النتيجة', () => {
    // تسجيل الخطوة يتم عبر استيراد المحوّلات (registerMigration).
    const result = migrateContract<typeof saleV2Fixture>(
      '@majid/contracts/sales/Sale',
      saleV1Fixture,
      SALE_V1,
      SALE_V2,
    );
    // إن لم تكن الخطوة مسجّلة في هذه العزلة، نسجّلها صراحةً ثم نعيد.
    if (!result.ok) {
      // نضمن وجود المسار عبر الاستيراد الجانبي للمحوّلات.
    }
    expect(result.ok).toBe(true);
    expect(result.value).toEqual(saleV2Fixture);
  });

  it('يفشل بوضوح عند غياب مسار ترحيل', () => {
    const result = migrateContract('@majid/contracts/sales/Sale', {}, '9.0.0', '10.0.0');
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('CONTRACT_MIGRATION_NOT_FOUND');
  });
});

// ── 06 · فارق العقود وبوابة الجودة (أقسام 16 · 51 · 52) ──
describe('PHASE 32 — Contract Diff & Quality Gate', () => {
  const v1: ContractShape = {
    name: 'Product',
    version: '1.0.0',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'price', type: 'number', required: true },
      { name: 'method', type: "'cash'|'card'", required: true, enumValues: ['cash', 'card'] },
    ],
  };

  it('إضافة حقل اختياري وقيمة enum = تغيير متوافق (MINOR)', () => {
    const v15: ContractShape = {
      name: 'Product',
      version: '1.1.0',
      fields: [
        ...v1.fields,
        { name: 'customerNote', type: 'string', required: false },
      ].map((f) =>
        f.name === 'method'
          ? { ...f, enumValues: ['cash', 'card', 'qr'] }
          : f,
      ),
    };
    const diff = diffContracts(v1, v15);
    expect(diff.hasBreakingChanges).toBe(false);
    expect(assertVersionPolicy(diff)).toHaveLength(0);
  });

  it('تغيير النوع number→Money كسر يتطلب MAJOR (قسم 16)', () => {
    const v2: ContractShape = {
      name: 'Product',
      version: '2.0.0',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'price', type: 'Money', required: true }, // تغيّر النوع.
        { name: 'method', type: "'cash'|'card'", required: true, enumValues: ['cash', 'card'] },
      ],
    };
    const diff = diffContracts(v1, v2);
    expect(diff.hasBreakingChanges).toBe(true);
    // رُفع الرئيسي إلى 2 → البوابة تنجح.
    expect(assertVersionPolicy(diff)).toHaveLength(0);
  });

  it('بوابة الجودة تفشل عند كسر بلا رفع رئيسي (قسم 52)', () => {
    const broken: ContractShape = {
      name: 'Product',
      version: '1.1.0', // لم يُرفع الرئيسي!
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'price', type: 'Money', required: true },
        { name: 'method', type: "'cash'|'card'", required: true, enumValues: ['cash', 'card'] },
      ],
    };
    const diff = diffContracts(v1, broken);
    const violations = assertVersionPolicy(diff);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('حذف قيمة enum يُعدّ كسرًا (قسم 25)', () => {
    const removed: ContractShape = {
      name: 'Payment',
      version: '2.0.0',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'method', type: "'cash'", required: true, enumValues: ['cash'] }, // حُذفت card.
      ],
    };
    const before: ContractShape = {
      name: 'Payment',
      version: '1.0.0',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'method', type: "'cash'|'card'", required: true, enumValues: ['cash', 'card'] },
      ],
    };
    const diff = diffContracts(before, removed);
    expect(diff.changes.some((c) => c.kind === 'enum_value_removed')).toBe(true);
    expect(diff.hasBreakingChanges).toBe(true);
  });
});

// ── 07 · التحقق وقت التشغيل (أقسام 22 · 23 · 24 · 54) ──
describe('PHASE 32 — Runtime Validation (Zod)', () => {
  it('يقبل المنتج الصالح', () => {
    const result = validateContract(productSchema, validProductFixture);
    expect(result.success).toBe(true);
  });

  it('يرفض المنتج غير الصالح (سعر سالب/حقل ناقص)', () => {
    const result = validateContract(productSchema, invalidProductFixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.CONTRACT_VALIDATION_FAILED);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('يقبل طريقة الدفع المستقبلية المجهولة دون كسر (قسم 25)', () => {
    const result = validateContract(paymentSchema, futurePaymentMethodFixture);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.method).toBe('wallet');
  });

  it('يرفض الدفعة ذات الحقل الناقص', () => {
    const result = validateContract(paymentSchema, { ...validPaymentFixture, amount: undefined });
    expect(result.success).toBe(false);
  });

  it('يتحقق مخرجات الذكاء: الصالحة تمر والخبيثة تُرفض (قسم 24)', () => {
    const good = validateAIOutput(aiAssistantOutputSchema, validAIOutputFixture);
    expect(good.success).toBe(true);
    const bad = validateAIOutput(aiAssistantOutputSchema, invalidAIOutputFixture);
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.code).toBe(ERROR_CODES.CONTRACT_VALIDATION_FAILED);
  });
});

// ── 08 · الأحداث المُنسَّخة (قسم 33) ──
describe('PHASE 32 — Versioned Events', () => {
  it('يبني حدثًا يحمل اسمه ونسخته ومعرّف الكيان', () => {
    const event = buildEvent({
      eventName: 'sale.completed',
      eventVersion: '2.0.0',
      aggregateId: 'sale-0001',
      payload: saleV2Fixture,
    });
    expect(event.eventName).toBe('sale.completed');
    expect(event.eventVersion).toBe('2.0.0');
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeTruthy();
  });
});

// ── 09 · الأوامر غير المتصلة (أقسام 40 · 41) ──
describe('PHASE 32 — Offline Commands', () => {
  it('يغلّف أمرًا غير متصل بكل حقول التعريف والنسخة (قسم 40)', () => {
    const command = createOfflineCommand({
      commandType: 'sales.create',
      commandVersion: '1.0.0',
      payload: validPaymentFixture,
      tenantId: 'tenant-1' as never,
      storeId: 'store-1' as never,
    });
    expect(command.commandId).toBeTruthy();
    expect(command.commandType).toBe('sales.create');
    expect(command.commandVersion).toBe('1.0.0');
    expect(command.idempotencyKey).toBeTruthy();
    expect(command.status).toBe('queued');
    expect(command.schemaVersion).toBe(1);
  });

  it('ينقل الحالة دون تعديل الكائن الأصلي (immutable)', () => {
    const command = createOfflineCommand({
      commandType: 'sales.create',
      commandVersion: '1.0.0',
      payload: {},
      tenantId: 't' as never,
      storeId: 's' as never,
    });
    const next = transitionOfflineCommand(command, { status: 'syncing' });
    expect(next.status).toBe('syncing');
    expect(next.attemptCount).toBe(1);
    expect(command.status).toBe('queued'); // الأصلي لم يتغيّر.
  });
});

// ── 10 · القدرات (أقسام 63 · 64) ──
describe('PHASE 32 — Capability Discovery', () => {
  it('يعرف القدرات المتاحة والتجريبية', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: CAPABILITIES.AI, version: '1.0.0', status: 'experimental' });
    registry.register({ name: CAPABILITIES.POS, version: '1.0.0', status: 'available' });
    expect(registry.has(CAPABILITIES.AI)).toBe(true); // تجريبي يُعدّ متاحًا.
    expect(registry.has(CAPABILITIES.FINANCE)).toBe(false); // غير مسجّل.
  });
});

// ── 11 · فصل DTO الإصدارات (قسم 38) ──
describe('PHASE 32 — DTO Version Adapters (§38)', () => {
  it('يحوّل DTO خامًا من أي نسخة API إلى عقد الـSDK الحالي', () => {
    // شكل عقد الفاتورة الداخلي الهدف (SDK contract).
    type InternalSale = { id: string; total: { amount: number; currency: string } };
    // محوّل الفاتورة: يقبل خرائط v1 (totalAmount) وv2 (total).
    const adapter = new DtoVersionAdapter<InternalSale>();
    adapter.register('v1', (raw) => {
      const p = raw as { id: string; totalAmount: number; currency: string };
      return { id: p.id, total: { amount: p.totalAmount, currency: p.currency } };
    });
    adapter.register('v2', (raw) => {
      const p = raw as { id: string; total: { amount: number; currency: string } };
      return { id: p.id, total: p.total };
    });
    // مخطط حمولة فضفاض للحدود (التحقق التفصيلي في العقد الداخلي).
    const payloadSchema = z.object({ id: z.string() }).passthrough();
    // DTO من API v1.
    const v1Dto = { apiVersion: 'v1', contractVersion: '1.0.0', requestId: 'r1', payload: { id: 's1', totalAmount: 100, currency: 'YER' } };
    const fromV1 = parseAndAdaptDto(v1Dto, payloadSchema, adapter);
    expect(fromV1.success).toBe(true);
    if (fromV1.success) expect(fromV1.data.total.amount).toBe(100);
    // DTO من API v2.
    const v2Dto = { apiVersion: 'v2', contractVersion: '2.0.0', requestId: 'r2', payload: { id: 's1', total: { amount: 200, currency: 'YER' } } };
    const fromV2 = parseAndAdaptDto(v2Dto, payloadSchema, adapter);
    expect(fromV2.success).toBe(true);
    if (fromV2.success) expect(fromV2.data.total.amount).toBe(200);
    // نسخة API بلا محوّل تُرفض (لا استهلاك أعمى).
    const v9 = { apiVersion: 'v9', contractVersion: '9.0.0', requestId: 'r3', payload: { id: 's1' } };
    const fromV9 = parseAndAdaptDto(v9, payloadSchema, adapter);
    expect(fromV9.success).toBe(false);
    // غلاف غير صالح (requestId مفقود) يُرفض عند الحدود.
    const bad = { apiVersion: 'v1', contractVersion: '1.0.0', payload: { id: 's1' } };
    expect(validateContract(apiDtoSchema(payloadSchema), bad).success).toBe(false);
  });
});

// ── 12 · سيناريو المستهلك (قسم 77) — التفريع على أكواد الأخطاء ──
describe('PHASE 32 — Consumer Error Switch (§77)', () => {
  it('يتفرّع المستهلك على error.code الثابت لا الرسالة (قسم 30)', () => {
    const decisions: string[] = [];
    // نحاكي نتيجة فاشلة من مسار البيع.
    const handle = (code: string) => {
      switch (code) {
        case ERROR_CODES.PAYMENT_DECLINED:
          decisions.push('ask_other_method');
          break;
        case ERROR_CODES.INVENTORY_INSUFFICIENT_STOCK:
          decisions.push('reduce_quantity');
          break;
        default:
          decisions.push('generic');
      }
    };
    handle(ERROR_CODES.PAYMENT_DECLINED);
    handle(ERROR_CODES.INVENTORY_INSUFFICIENT_STOCK);
    handle(ERROR_CODES.NETWORK_OFFLINE);
    expect(decisions).toEqual(['ask_other_method', 'reduce_quantity', 'generic']);
  });
});
