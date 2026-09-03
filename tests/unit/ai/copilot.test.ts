/**
 * اختبارات المساعد الذكي Copilot (PHASE 24).
 * تغطي فهم اللغة النقي (NLU): تطبيع العربية، اكتشاف النية/الفترة/المنتج،
 * ومولّد الحقائق النقي: تحويل النية + بيانات حقيقية إلى حقائق منظمة.
 */
import {
  parseCopilotQuery,
  normalizeArabic,
  buildCopilotFacts,
  type CopilotParse,
} from '@/domain/ai';
import type { SalesReport } from '@/domain/reports';
import type { InventoryLevel } from '@/domain/inventory';
import type { Product } from '@/domain/products/types';

// يبني تقرير مبيعات للاختبار بأرقام محددة.
function makeReport(over: Partial<SalesReport> = {}): SalesReport {
  return {
    period: 'today',
    currency: 'YER',
    orderCount: 4,
    paidCount: 3,
    revenue: { amount: 30000, currency: 'YER' },
    tax: { amount: 3000, currency: 'YER' },
    discount: { amount: 500, currency: 'YER' },
    avgOrderValue: { amount: 10000, currency: 'YER' },
    methods: [
      { method: 'cash', count: 2, amount: { amount: 20000, currency: 'YER' }, share: 66.7 },
      { method: 'card', count: 1, amount: { amount: 10000, currency: 'YER' }, share: 33.3 },
    ],
    topProducts: [
      { productId: 'p1' as never, nameAr: 'قهوة', nameEn: 'Coffee', quantity: 5, revenue: { amount: 5000, currency: 'YER' } },
    ],
    series: [],
    growth: 12.5,
    ...over,
  };
}

// منتج للاختبار.
function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: 'p1' as never,
    nameAr: 'شاي أخضر',
    nameEn: 'Green Tea',
    price: { amount: 1500, currency: 'YER' },
    stockStatus: 'in_stock',
  } as unknown as Product;
}

// مستوى مخزون للاختبار.
function makeLevel(nameAr: string, quantity: number, status: InventoryLevel['status']): InventoryLevel {
  return {
    productId: nameAr as never,
    nameAr,
    nameEn: nameAr,
    barcode: '',
    sku: '',
    quantity,
    status,
    unitValue: 1000,
    currency: 'YER',
    stockValue: quantity * 1000,
    categoryId: 'c',
  };
}

describe('normalizeArabic', () => {
  test('unifies alef/ta-marbuta/hamza and strips diacritics', () => {
    expect(normalizeArabic('الإيرادُ')).toBe('الايراد');
    expect(normalizeArabic('مبيعات? اليوم!')).toBe('مبيعات اليوم');
    expect(normalizeArabic('أهلاً')).toBe('اهلا');
  });
});

describe('parseCopilotQuery — intents', () => {
  const cases: Array<[string, CopilotParse['intent']]> = [
    ['كم مبيعات اليوم؟', 'revenue'],
    ['إجمالي المبيعات هذا الأسبوع', 'sales_overview'],
    ['كم عدد الطلبات اليوم', 'orders_count'],
    ['ما متوسط قيمة الطلب؟', 'avg_order'],
    ['ما الأكثر مبيعا هذا الشهر؟', 'top_products'],
    ['كيف دفع العملاء؟ طرق الدفع', 'payment_methods'],
    ['كم الضريبة والخصم؟', 'tax_discount'],
    ['ما المنتجات النافدة؟', 'low_stock'],
    ['بكم سعر الشاي؟', 'product_price'],
    ['ماذا تستطيع أن تفعل؟', 'help'],
    ['السلام عليكم', 'greeting'],
    ['how much did i sell today', 'revenue'],
    ['top products this week', 'top_products'],
  ];
  test.each(cases)('parses "%s" as %s', (q, intent) => {
    expect(parseCopilotQuery(q).intent).toBe(intent);
  });

  test('returns unknown for gibberish', () => {
    expect(parseCopilotQuery('xyzq abc').intent).toBe('unknown');
  });
});

describe('parseCopilotQuery — periods', () => {
  test('detects week/month/all and defaults to today', () => {
    expect(parseCopilotQuery('المبيعات هذا الأسبوع').period).toBe('week');
    expect(parseCopilotQuery('المبيعات هذا الشهر').period).toBe('month');
    expect(parseCopilotQuery('المبيعات كل الفترات').period).toBe('all');
    expect(parseCopilotQuery('المبيعات').period).toBe('today');
  });
});

describe('parseCopilotQuery — product extraction', () => {
  test('extracts a product term from a price question', () => {
    const p = parseCopilotQuery('بكم سعر الشاي الأخضر');
    expect(p.intent).toBe('product_price');
    expect(p.productQuery).toBeTruthy();
  });
});

describe('buildCopilotFacts', () => {
  test('revenue intent surfaces revenue amount', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('كم الإيراد؟'), report: makeReport() });
    expect(facts.kind).toBe('revenue');
    expect(facts.localeDependent.revenue).toBe(30000);
  });

  test('overview kind carries revenue/orders/avg', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('ملخص المبيعات'), report: makeReport() });
    expect(facts.kind).toBe('sales_overview');
    expect(facts.localeDependent.paidCount).toBe(3);
    expect(facts.localeDependent.avgOrder).toBe(10000);
  });

  test('top products maps names and quantities', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('الأكثر مبيعا'), report: makeReport() });
    expect(facts.kind).toBe('top_products');
    expect(facts.topProducts?.[0]?.nameAr).toBe('قهوة');
    expect(facts.topProducts?.[0]?.quantity).toBe(5);
  });

  test('payment methods carry share', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('طرق الدفع'), report: makeReport() });
    expect(facts.kind).toBe('payment_methods');
    expect(facts.methods?.length).toBe(2);
    expect(facts.methods?.[0]?.share).toBe(66.7);
  });

  test('low stock filters only low/out items', () => {
    const inventory = [
      makeLevel('منتج نافد', 0, 'out_of_stock'),
      makeLevel('منتج منخفض', 2, 'low_stock'),
      makeLevel('منتج متوفر', 50, 'in_stock'),
    ];
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('النافد'), inventory });
    expect(facts.kind).toBe('low_stock');
    expect(facts.lowStock?.length).toBe(2);
    expect(facts.lowStock?.[0]?.nameAr).toBe('منتج نافد'); // الأقل أولًا.
  });

  test('low stock with healthy inventory returns all-good', () => {
    const inventory = [makeLevel('متوفر', 50, 'in_stock')];
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('مخزون منخفض'), inventory });
    expect(facts.lowStock?.length).toBe(0);
  });

  test('product price returns matched product', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('بكم سعر الشاي'), products: [makeProduct()] });
    expect(facts.kind).toBe('product_price');
    expect(facts.matchedProduct?.price).toBe(1500);
  });

  test('product price without match returns not_found', () => {
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('بكم سعر شيء غير موجود'), products: [] });
    expect(facts.kind).toBe('product_not_found');
  });

  test('sales intent with zero revenue returns empty_period', () => {
    const report = makeReport({ paidCount: 0, revenue: { amount: 0, currency: 'YER' } });
    const facts = buildCopilotFacts({ parse: parseCopilotQuery('ملخص المبيعات'), report });
    expect(facts.kind).toBe('empty_period');
  });

  test('greeting and help do not require a report', () => {
    expect(buildCopilotFacts({ parse: parseCopilotQuery('مرحبا') }).kind).toBe('greeting');
    expect(buildCopilotFacts({ parse: parseCopilotQuery('ساعدني') }).kind).toBe('help');
  });
});
