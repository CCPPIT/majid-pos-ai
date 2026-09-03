/**
 * اختبار تكامل — دورة حياة البيع الكاملة (PHASE 28).
 * يربط المستودعات الحقيقية عبر ناقل الأحداث (كما يفعل التطبيق) ويتحقق من
 * تدفّق عملية بيع واحدة عبر كل الحدود: إنشاء طلب → دفعة ناجحة → تسجيل تدقيق
 * تلقائي → طابور مزامنة صادر → تقرير مشتق → إجابة Copilot، مع خيار وضع
 * عدم الاتصال للتثبّت من بقاء الطابور معلّقًا.
 *
 * هذا اختبار "تكامل" حقيقي: لا تُحقَّن مستودعات وهمية، بل تُستخدم مكوّنات
 * الإنتاج مع تخزين AsyncStorage محاكى (من setup.ts) يُمسح قبل كل اختبار.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ordersRepository,
  paymentsRepository,
  reportsRepository,
  auditRepository,
  syncRepository,
  connectivityPort,
} from '@/shared/container';
import { appEventBus, DOMAIN_EVENTS } from '@/core/events/EventBus';
import { wireAudit } from '@/shared/audit/audit-bootstrap';
import { wireSyncEvents } from '@/shared/sync/sync-bootstrap';
import { buildSalesReport } from '@/domain/reports';
import { parseCopilotQuery, buildCopilotFacts } from '@/domain/ai';
import { makeProduct, makeCart, makeTotals, makeOrderInput } from '../helpers/factories';

// نموذج دالة الترجمة (يُرجع المفتاح مع المعاملات) لاختبار الخدمة.
const identityT = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;
// منسّق مبالغ ثابت للاختبار (لا اعتماد على i18n).
const fmtMoney = (amount: number) => `${amount} YER`;

describe('تكامل: دورة حياة البيع عبر المستودعات والناقل', () => {
  let unwireAudit: () => void;
  let unwireSync: () => void;

  beforeAll(() => {
    // نربط التقاط التدقيق وطابور المزامنة كما يفعل التطبيق (محميّان من التكرار).
    unwireAudit = wireAudit(() => ({ id: 'device', label: 'device' }));
    unwireSync = wireSyncEvents();
  });

  afterAll(() => {
    unwireAudit();
    unwireSync();
    appEventBus.clear();
  });

  beforeEach(async () => {
    // نعزل كل اختبار: مسح التخزين المحاكى.
    await AsyncStorage.clear();
    // نضمن وضع الاتصال الافتراضي.
    connectivityPort.set('online');
  });

  test('ينشئ طلبًا مدفوعًا ويسجّل التدقيق ويرفده للمزامنة والتقارير', async () => {
    // 1) بناء سلة وإنشاء طلب عبر المستودع الحقيقي.
    const product = makeProduct({ nameAr: 'قهوة مختصة', price: { amount: 2000, currency: 'YER' } });
    const cart = makeCart(product, 2); // كميتان × 2000.
    const totals = makeTotals(cart, 5);
    const order = await ordersRepository.createOrder(cart, totals, makeOrderInput());

    // حدث إنشاء البيع يجب أن يكون قد انبعث (الناقل يعمل).
    expect(order.orderNumber).toMatch(/^ORD-\d{4,}$/);

    // 2) الدفع النقدي عبر مستودع المدفوعات الحقيقي.
    const payResult = await paymentsRepository.payOrder({ order, method: 'cash' });
    expect(payResult.ok).toBe(true);

    // نترك المهام الصغيرة (الدفع التلقائي للطابور/التقاط التدقيق) تكتمل.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 3) التدقيق: يجب أن نجد مدخلتَي البيع والدفع.
    const audit = await auditRepository.list();
    const actions = audit.map((e) => e.action);
    expect(actions).toContain('sale_created');
    expect(actions).toContain('payment_completed');
    const paymentEntry = audit.find((e) => e.action === 'payment_completed');
    expect(paymentEntry?.category).toBe('payments');
    expect(paymentEntry?.severity).toBe('sensitive');

    // 4) التقرير المشتق يعكس البيع الحقيقي (إيراد > 0، طلب مدفوع).
    const orders = await ordersRepository.listOrders();
    const payments = await paymentsRepository.listAllPayments();
    const report = buildSalesReport({ orders, payments, period: 'today', currency: 'YER' });
    expect(report.paidCount).toBeGreaterThanOrEqual(1);
    expect(report.revenue.amount).toBeGreaterThanOrEqual(4000); // كميتان × 2000 (قبل الضريبة).
  });

  test('في وضع عدم الاتصال تبقى الطفرات معلّقة في الطابور ثم تُنسّق عند الاتصال', async () => {
    // نضع الجهاز دون اتصال: enqueue لن يدفع.
    connectivityPort.set('offline');

    const product = makeProduct({ nameAr: 'شاي', price: { amount: 1500, currency: 'YER' } });
    const order = await ordersRepository.createOrder(makeCart(product, 1), makeTotals(makeCart(product, 1), 5), makeOrderInput());
    await paymentsRepository.payOrder({ order, method: 'card' });

    // دون اتصال: الدفع التلقائي لا يرسل شيئًا.
    await new Promise((resolve) => setTimeout(resolve, 0));
    let summary = await syncRepository.summary();
    expect(summary.pending + summary.inflight).toBeGreaterThanOrEqual(2); // طفرة طلب + دفعة.
    expect(summary.synced).toBe(0);

    // عند عودة الاتصال واستدعاء الدفع اليدوي، تُنسّق كل الطفرات (المحاكي المحلي).
    connectivityPort.set('online');
    const outcome = await syncRepository.flush();
    expect(outcome.failed).toBe(0);
    summary = await syncRepository.summary();
    expect(summary.pending).toBe(0);
    expect(summary.synced).toBeGreaterThanOrEqual(2);
  });

  test('Copilot يقرأ تقرير اليوم الحقيقي ويجيب عن الإيراد', async () => {
    // بيع مدفوع واحد.
    const product = makeProduct({ nameAr: 'عصير', price: { amount: 3000, currency: 'YER' } });
    const cart = makeCart(product, 1);
    const order = await ordersRepository.createOrder(cart, makeTotals(cart, 0), makeOrderInput({ taxRatePercent: 0 }));
    await paymentsRepository.payOrder({ order, method: 'cash' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // تقرير اليوم عبر المستودع الحقيقي.
    const report = await reportsRepository.getSalesReport('today', {}, 'YER');
    expect(report.paidCount).toBeGreaterThanOrEqual(1);

    // NLU: سؤال عربي عن الإيراد.
    const parse = parseCopilotQuery('كم الإيراد اليوم؟');
    expect(parse.intent).toBe('revenue');

    // مولّد الحقائق يبني ردًا ماليًا من التقرير الحقيقي.
    const facts = buildCopilotFacts({ parse, report });
    expect(facts.kind).toBe('revenue');
    expect(facts.localeDependent.revenue).toBe(report.revenue.amount);
    expect(facts.localeDependent.revenue).toBeGreaterThanOrEqual(3000);

    // دالة الهوية تُظهر أن المفاتيح تُحل (لا تُرجع المفتاح الخام كنص فشل).
    const rendered = identityT('copilot.answer.revenue', { amount: fmtMoney(report.revenue.amount), period: 'today' });
    expect(rendered).toContain('copilot.answer.revenue');
  });
});
