/**
 * فهم لغة المساعد (NLU) النقي (PHASE 24).
 * يحلّل نص السؤال بالعربية/الإنجليزية إلى نية + فترة + كلمة منتج.
 * منطق قواعدي على الجهاز (تطابق كلمات مفتاحية) — صادق وقابل للاختبار،
 * ويُستبدل لاحقًا بنموذج سحابي خلف نفس الواجهة دون لمس الواجهة.
 */
import type { CopilotIntent, CopilotParse, CopilotPeriod } from './types';

// مجموعة الكلمات المفتاحية لكل نية (عربية ثم إنجليزية).
const INTENT_KEYWORDS: { intent: CopilotIntent; ar: string[]; en: string[] }[] = [
  // الأكثر مبيعًا (يُفحص قبل المبيعات العامة لتفادي التداخل).
  { intent: 'top_products', ar: ['الاكثر مبيعا', 'الأكثر مبيعا', 'الاكثر مبيعاً', 'أكثر المنتجات', 'افضل المنتجات', 'أفضل المنتجات', 'المنتجات الاكثر', 'الرائج'], en: ['best selling', 'top products', 'top sellers', 'most sold', 'popular products', 'bestsellers', 'best-selling'] },
  // طرق الدفع.
  { intent: 'payment_methods', ar: ['طرق الدفع', 'طريقة الدفع', 'الدفع كاش', 'كاش وكردت', 'توزيع الدفع', 'الدفع بالبطاقة', 'الدفع نقدا', 'نقدا وبطاقة'], en: ['payment methods', 'payment method', 'cash vs card', 'pay by card', 'payment breakdown', 'how paid'] },
  // الضريبة والخصم.
  { intent: 'tax_discount', ar: ['الضريبة', 'الضريبه', 'الخصم', 'الخصومات', 'ضريبة القيمة', 'كم الخصم'], en: ['tax', 'discount', 'vat', 'how much discount'] },
  // متوسط قيمة الطلب (صيغ قبل/بعد التطبيع: تاء مربوطة→هاء).
  { intent: 'avg_order', ar: ['متوسط الطلب', 'متوسط قيمه الطلب', 'متوسط قيمة الطلب', 'متوسط الفاتوره', 'متوسط الفاتورة', 'متوسط البيع', 'متوسط قيمه الفاتوره'], en: ['average order', 'avg order', 'average basket', 'average sale', 'average ticket', 'mean order'] },
  // عدد الطلبات (قبل الإيراد العام؛ كلمات العدد).
  { intent: 'orders_count', ar: ['عدد الطلبات', 'كم طلب', 'عدد الفواتير', 'كم فاتورة', 'عدد المبيعات', 'كم عملية بيع', 'عدد العمليات'], en: ['number of orders', 'how many orders', 'orders count', 'how many sales', 'number of sales', 'count orders', 'transactions count'] },
  // ملخص المبيعات العام (مبيعات+إجمالي/ملخص/تقرير فقط، فلا يبتلع كم/إيراد).
  { intent: 'sales_overview', ar: ['ملخص المبيعات', 'تقرير المبيعات', 'إجمالي المبيعات', 'اجمالي المبيعات', 'أداء المبيعات', 'كيف المبيعات', 'حركة البيع', 'ملخص البيع'], en: ['sales report', 'sales overview', 'sales summary', 'how are sales', 'business today', 'sales performance', 'overall sales'] },
  // الإيراد فقط.
  { intent: 'revenue', ar: ['الإيراد', 'الايراد', 'المبيعات فلوس', 'كم ربحت', 'كم بعت', 'قيمة المبيعات', 'الدخل', 'كم المبيعات', 'المبيعات اليوم', 'مبيعات اليوم', 'كم مبيعات'], en: ['revenue', 'how much did i sell', 'sales amount', 'how much sales', 'income', 'earnings', 'takings'] },
  // المخزون المنخفض/النافد.
  { intent: 'low_stock', ar: ['مخزون منخفض', 'المخزون المنخفض', 'نافد', 'النافد', 'قارب على النفاد', 'اعادة الطلب', 'إعادة الطلب', 'نفاد المخزون', 'المخزون قليل', 'كم باقي', 'الرصيد'], en: ['low stock', 'out of stock', 'reorder', 'running low', 'need restock', 'stock levels', 'inventory low', 'almost sold out'] },
  // سعر منتج.
  { intent: 'product_price', ar: ['سعر', 'بكم', 'ثمن', 'قيمة المنتج', 'سعر المنتج'], en: ['price of', 'how much is', 'what is the price', 'cost of', 'price for'] },
  // المساعدة.
  { intent: 'help', ar: ['ماذا تستطيع', 'ماذا يمكنك', 'مساعدة', 'ساعدني', 'كيف أسألك', 'ما قدراتك', 'وش تسوي'], en: ['what can you do', 'help', 'how do i use you', 'your abilities', 'what do you know', 'capabilities'] },
  // الترحيب.
  { intent: 'greeting', ar: ['مرحبا', 'السلام عليكم', 'اهلا', 'أهلا', 'هاي', 'صباح الخير', 'مساء الخير'], en: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'assalamu'] },
];

// كلمات دالة على الفترة الزمنية.
const PERIOD_KEYWORDS: { period: CopilotPeriod; ar: string[]; en: string[] }[] = [
  // كل الأوقات.
  { period: 'all', ar: ['كل الفترات', 'كل الوقت', 'من البداية', 'إجمالي كل', 'اجمالي كل', 'على الإطلاق', 'كل الأيام'], en: ['all time', 'overall', 'everything', 'since start', 'total all', 'lifetime'] },
  // الشهر.
  { period: 'month', ar: ['الشهر', 'هذا الشهر', 'شهر', '30 يوم', 'ثلاثين يوم'], en: ['this month', 'month', 'monthly', '30 days', 'past month', 'last month'] },
  // الأسبوع (قبل اليوم لتفادي تداخل "اليوم").
  { period: 'week', ar: ['الأسبوع', 'الاسبوع', 'هذا الأسبوع', 'اسبوع', 'أسبوع', '7 أيام', 'سبعة أيام'], en: ['this week', 'week', 'weekly', '7 days', 'past week', 'last week'] },
  // اليوم.
  { period: 'today', ar: ['اليوم', 'النهارده', 'النهاردة', 'اليوم ده', 'هذا اليوم'], en: ['today', 'tonight', 'this day'] },
];

// أدوات/كلمات عربية نستبعدها من استخراج اسم المنتج.
const STOP_WORDS = new Set([
  'سعر', 'بكم', 'ثمن', 'كم', 'من', 'في', 'على', 'عن', 'ال', 'اليوم', 'الشهر', 'الأسبوع', 'الاسبوع', 'أسبوع', 'اسبوع', 'منتج', 'المنتج', 'عندي', 'أريد', 'اريد', 'هل', 'ما', 'ماذا', 'وش', 'كم', 'بكام', 'بكم', 'لدي', 'اين', 'أين',
  'price', 'of', 'the', 'how', 'much', 'is', 'for', 'product', 'item', 'today', 'this', 'week', 'month', 'please', 'tell', 'me', 'what', 'cost',
]);

// يطبّع النص العربي/الإنجليزي للمطابقة (توحيد التشكيل/التاء/الألف).
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase() // أحرف صغيرة.
    .replace(/[ً-ٰٟ]/g, '') // إزالة التشكيل.
    .replace(/[أإآ]/g, 'ا') // توحيد الألف.
    .replace(/ى/g, 'ي') // توحيد الألف المقصورة.
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة.
    .replace(/ؤ/g, 'و') // توحيد الهمزة على واو.
    .replace(/ئ/g, 'ي') // توحيد الهمزة على ياء.
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // إزالة الرموز (أرقام ورسائل تبقى).
    .replace(/\s+/g, ' ') // طيّ المسافات.
    .trim();
}

// يستخرج الفترة الزمنية من النص المطبّع (اليوم افتراضًا).
function detectPeriod(text: string): CopilotPeriod {
  for (const { period, ar, en } of PERIOD_KEYWORDS) {
    if (ar.some((k) => text.includes(k)) || en.some((k) => text.includes(k))) {
      return period;
    }
  }
  return 'today';
}

// يستخرج كلمة منتج محتملة من سؤال سعر (أطول كلمة مهمة).
function extractProduct(text: string): string | undefined {
  const tokens = text.split(' ').filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  if (tokens.length === 0) return undefined;
  // أطول كلمة هي الأرجح اسم منتج (الأسماء العربية أطول من الأدوات).
  const candidate = tokens.reduce((a, b) => (b.length > a.length ? b : a));
  return candidate.length >= 2 ? candidate : undefined;
}

// يحلّل سؤال المستخدم إلى نية + فترة + (منتج).
export function parseCopilotQuery(raw: string): CopilotParse {
  const text = normalizeArabic(raw);
  if (!text) {
    return { intent: 'unknown', period: 'today', confidence: 0 };
  }

  let best: { intent: CopilotIntent; confidence: number } | null = null;
  for (const { intent, ar, en } of INTENT_KEYWORDS) {
    const hitAr = ar.find((k) => text.includes(k));
    const hitEn = en.find((k) => text.includes(k));
    const hit = hitAr ?? hitEn;
    if (hit) {
      // الثقة أعلى كلما طالت العبارة المطابقة (دقة أكبر).
      const confidence = Math.min(1, 0.6 + hit.length / 40);
      if (!best || confidence > best.confidence) best = { intent, confidence };
    }
  }

  const period = detectPeriod(text);
  const intent: CopilotIntent = best?.intent ?? 'unknown';

  return {
    intent,
    period,
    productQuery: intent === 'product_price' ? extractProduct(text) : undefined,
    confidence: best?.confidence ?? 0.15,
  };
}

// أسئلة مقترحة للبدء (تُترجَم لاحقًا في الواجهة عبر مفاتيح).
export const SUGGESTION_KEYS = [
  'copilot.suggest.todaySales',
  'copilot.suggest.topProducts',
  'copilot.suggest.lowStock',
  'copilot.suggest.paymentMethods',
] as const;
