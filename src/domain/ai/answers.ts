/**
 * مولّد حقائق المساعد النقي (PHASE 24).
 * يأخذ النية المُحلّلة + بيانات المتجر الحقيقية (تقرير المبيعات/مستويات
 * المخزون/المنتجات) وينتج "حقائق" منظمة: نص بيانات خام + بطاقات أرقام.
 * لا ترجمة ولا تخزين هنا — الترجمة والتنسيق تتم في طبقة الميزة عبر المُنسّق.
 * كل الأرقام المالية تُقرأ من تقرير المبيعات المبني عبر core/money (لا حساب هنا).
 */
import type { SalesReport } from '@/domain/reports';
import type { InventoryLevel } from '@/domain/inventory';
import type { Product } from '@/domain/products/types';
import type { CopilotCard, CopilotIntent, CopilotParse } from './types';

// صنف إجابة (يختار النص المُترجَم المناسب في الواجهة).
export type CopilotAnswerKind =
  | 'greeting'
  | 'help'
  | 'sales_overview'
  | 'revenue'
  | 'orders_count'
  | 'avg_order'
  | 'top_products'
  | 'payment_methods'
  | 'tax_discount'
  | 'low_stock'
  | 'product_price'
  | 'product_not_found'
  | 'empty_period'
  | 'unknown';

// بيانات المتجر المجمّعة التي يحقنها المستودع/الميزة.
export interface CopilotFactsInput {
  parse: CopilotParse; // نتيجة التحليل.
  report?: SalesReport; // تقرير المبيعات للفترة (إن وُجد).
  inventory?: InventoryLevel[]; // مستويات المخزون (نية المخزون).
  products?: Product[]; // منتجات مطابقة (نية السعر).
}

// الحقائق المنظمة الناتجة (جاهزة للترجمة/العرض).
export interface CopilotFacts {
  kind: CopilotAnswerKind; // الصنف.
  period: string; // الفترة ('today'…).
  localeDependent: {
    // قيم خام تُنسّق/تُترجم في الواجهة.
    revenue?: number;
    tax?: number;
    discount?: number;
    avgOrder?: number;
    orderCount?: number;
    paidCount?: number;
    growth?: number;
    currency: string;
  };
  topProducts?: { nameAr: string; nameEn: string; quantity: number; revenue: number }[];
  methods?: { method: string; count: number; amount: number; share: number }[];
  lowStock?: { nameAr: string; nameEn: string; quantity: number; status: string }[];
  matchedProduct?: { nameAr: string; nameEn: string; price: number; currency: string };
  cards: CopilotCard[]; // بطاقات مُسبّكة التسمية (تُستبدل نصوصها بالترجمة إن لزم).
}

// هل الفترة بلا أي مبيعات؟
function isEmpty(report?: SalesReport): boolean {
  return !report || report.paidCount === 0 || report.revenue.amount === 0;
}

// يبني الحقائق من المدخلات (نقي تمامًا).
export function buildCopilotFacts(input: CopilotFactsInput): CopilotFacts {
  const { parse, report, inventory = [], products = [] } = input;
  const currency = report?.currency ?? products[0]?.price.currency ?? 'YER';

  // القيم المشتركة الخام.
  const base = {
    revenue: report?.revenue.amount,
    tax: report?.tax.amount,
    discount: report?.discount.amount,
    avgOrder: report?.avgOrderValue.amount,
    orderCount: report?.orderCount,
    paidCount: report?.paidCount,
    growth: report?.growth,
    currency,
  };

  // ترحيب.
  if (parse.intent === 'greeting') {
    return { kind: 'greeting', period: parse.period, localeDependent: { currency }, cards: [] };
  }
  // المساعدة.
  if (parse.intent === 'help') {
    return { kind: 'help', period: parse.period, localeDependent: { currency }, cards: [] };
  }

  // سعر منتج (لا يعتمد على تقرير).
  if (parse.intent === 'product_price') {
    const product = products[0];
    if (!product) {
      return { kind: 'product_not_found', period: parse.period, localeDependent: { currency }, cards: [] };
    }
    return {
      kind: 'product_price',
      period: parse.period,
      localeDependent: { currency },
      matchedProduct: { nameAr: product.nameAr, nameEn: product.nameEn, price: product.price.amount, currency: product.price.currency },
      cards: [],
    };
  }

  // المخزون المنخفض/النافد (لا يعتمد على تقرير).
  if (parse.intent === 'low_stock') {
    const low = inventory
      .filter((l) => l.status === 'low_stock' || l.status === 'out_of_stock' || l.quantity <= 0)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10)
      .map((l) => ({ nameAr: l.nameAr, nameEn: l.nameEn, quantity: l.quantity, status: String(l.status) }));
    return {
      kind: 'low_stock',
      period: parse.period,
      localeDependent: { currency },
      lowStock: low,
      cards: [],
    };
  }

  // بقية النيات تعتمد على تقرير المبيعات.
  if (!report) {
    return { kind: 'empty_period', period: parse.period, localeDependent: { currency }, cards: [] };
  }

  // النيات المالية تعتبر الفترة فارغة إن لم يكن هناك إيراد.
  const needsSales: CopilotIntent[] = ['sales_overview', 'revenue', 'orders_count', 'avg_order', 'top_products', 'payment_methods', 'tax_discount'];
  if (needsSales.includes(parse.intent) && isEmpty(report)) {
    return { kind: 'empty_period', period: parse.period, localeDependent: base, cards: [] };
  }

  switch (parse.intent) {
    case 'revenue':
      return { kind: 'revenue', period: parse.period, localeDependent: base, cards: [] };
    case 'orders_count':
      return { kind: 'orders_count', period: parse.period, localeDependent: base, cards: [] };
    case 'avg_order':
      return { kind: 'avg_order', period: parse.period, localeDependent: base, cards: [] };
    case 'tax_discount':
      return { kind: 'tax_discount', period: parse.period, localeDependent: base, cards: [] };
    case 'top_products':
      return {
        kind: 'top_products',
        period: parse.period,
        localeDependent: base,
        topProducts: report.topProducts.map((p) => ({ nameAr: p.nameAr, nameEn: p.nameEn, quantity: p.quantity, revenue: p.revenue.amount })),
        cards: [],
      };
    case 'payment_methods':
      return {
        kind: 'payment_methods',
        period: parse.period,
        localeDependent: base,
        methods: report.methods.map((m) => ({ method: m.method, count: m.count, amount: m.amount.amount, share: m.share })),
        cards: [],
      };
    case 'sales_overview':
    default:
      return { kind: 'sales_overview', period: parse.period, localeDependent: base, cards: [] };
  }
}
