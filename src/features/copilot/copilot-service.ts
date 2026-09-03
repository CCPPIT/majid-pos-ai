/**
 * خدمة المساعد الذكي (Copilot) — طبقة التنسيق (PHASE 24).
 * تجمع البيانات الحقيقية (تقرير المبيعات/المخزون/المنتجات) ثم تبني الحقائق
 * النقية من المجال وتُرجِمها إلى نص وبطاقات للمستخدم. منطق الفهم والأرقام في
 * المجال؛ هذا الملف للتنسيق فقط (i18n + عملة)، فلا توجد حسابات مالية هنا.
 */
import {
  parseCopilotQuery,
  buildCopilotFacts,
  type CopilotFacts,
  type CopilotCard,
  type CopilotMessage,
} from '@/domain/ai';
import { reportsRepository, inventoryRepository, productsRepository } from '@/shared/container';
import { logger } from '@/core/logging/logger';
import type { ReportPeriod } from '@/domain/reports';

// دوال التنسيق التي يحقنها مزوّد اللغة (تفادي استيراد الواجهة هنا).
export interface CopilotFormatter {
  t: (key: string, params?: Record<string, string | number>) => string; // ترجمة.
  currency: string; // عملة العرض.
  fmtMoney: (amount: number, currency?: string) => string; // مبلغ منسّق.
  fmtNumber: (value: number) => string; // رقم منسّق.
  fmtPercent: (value: number) => string; // نسبة منسّقة.
}

// يولّد معرّف رسالة.
function messageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// يلتقط اسم المنتج باللغة المناسبة.
function productName(p: { nameAr: string; nameEn: string }, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? p.nameAr : p.nameEn || p.nameAr;
}

// يترجم الحقائق النقية إلى نص + بطاقات للمستخدم.
function renderFacts(facts: CopilotFacts, f: CopilotFormatter, locale: 'ar' | 'en'): { text: string; cards: CopilotCard[] } {
  const d = facts.localeDependent;
  // علامة النمو (أعلى/أسنان).
  const growthTxt = d.growth !== undefined ? f.fmtPercent(Math.abs(d.growth)) : '';
  const growthUp = (d.growth ?? 0) >= 0;

  switch (facts.kind) {
    case 'greeting':
      return { text: f.t('copilot.greeting'), cards: [] };

    case 'help':
      return { text: f.t('copilot.helpBody'), cards: [] };

    case 'empty_period':
      return { text: f.t('copilot.emptyPeriod', { period: f.t(`copilot.period.${facts.period}`) }), cards: [] };

    case 'product_not_found':
      return { text: f.t('copilot.productNotFound'), cards: [] };

    case 'product_price': {
      const p = facts.matchedProduct!;
      return {
        text: f.t('copilot.productPrice', {
          name: locale === 'ar' ? p.nameAr : p.nameEn || p.nameAr,
          price: f.fmtMoney(p.price, p.currency),
        }),
        cards: [{ key: 'price', title: productName(p, locale), value: f.fmtMoney(p.price, p.currency), tone: 'neutral' }],
      };
    }

    case 'low_stock': {
      const low = facts.lowStock ?? [];
      if (low.length === 0) return { text: f.t('copilot.lowStockAllGood'), cards: [] };
      const cards: CopilotCard[] = low.slice(0, 6).map((item) => ({
        key: item.nameAr,
        title: productName(item, locale),
        value: f.fmtNumber(item.quantity),
        tone: item.quantity <= 0 ? 'bad' : 'warn',
        meta: f.t(item.quantity <= 0 ? 'copilot.status.out' : 'copilot.status.low'),
      }));
      return { text: f.t('copilot.lowStock', { count: low.length }), cards };
    }

    case 'revenue':
      return {
        text: f.t('copilot.answer.revenue', {
          amount: f.fmtMoney(d.revenue ?? 0),
          period: f.t(`copilot.period.${facts.period}`),
        }),
        cards: [{ key: 'rev', title: f.t('copilot.card.revenue'), value: f.fmtMoney(d.revenue ?? 0), tone: 'good' }],
      };

    case 'orders_count':
      return {
        text: f.t('copilot.answer.orders', {
          count: f.fmtNumber(d.paidCount ?? 0),
          period: f.t(`copilot.period.${facts.period}`),
        }),
        cards: [{ key: 'orders', title: f.t('copilot.card.paidOrders'), value: f.fmtNumber(d.paidCount ?? 0), tone: 'neutral' }],
      };

    case 'avg_order':
      return {
        text: f.t('copilot.answer.avgOrder', {
          amount: f.fmtMoney(d.avgOrder ?? 0),
          period: f.t(`copilot.period.${facts.period}`),
        }),
        cards: [{ key: 'aov', title: f.t('copilot.card.avgOrder'), value: f.fmtMoney(d.avgOrder ?? 0), tone: 'neutral' }],
      };

    case 'tax_discount':
      return {
        text: f.t('copilot.answer.taxDiscount', {
          tax: f.fmtMoney(d.tax ?? 0),
          discount: f.fmtMoney(d.discount ?? 0),
          period: f.t(`copilot.period.${facts.period}`),
        }),
        cards: [
          { key: 'tax', title: f.t('copilot.card.tax'), value: f.fmtMoney(d.tax ?? 0), tone: 'neutral' },
          { key: 'disc', title: f.t('copilot.card.discount'), value: f.fmtMoney(d.discount ?? 0), tone: 'warn' },
        ],
      };

    case 'top_products': {
      const tops = facts.topProducts ?? [];
      const cards: CopilotCard[] = tops.slice(0, 5).map((p, i) => ({
        key: p.nameAr,
        title: `${i + 1}. ${productName(p, locale)}`,
        value: f.fmtNumber(p.quantity),
        meta: f.fmtMoney(p.revenue),
        tone: 'good' as const,
      }));
      return { text: f.t('copilot.answer.topProducts', { period: f.t(`copilot.period.${facts.period}`) }), cards };
    }

    case 'payment_methods': {
      const methods = facts.methods ?? [];
      const cards: CopilotCard[] = methods.map((m) => ({
        key: m.method,
        title: f.t(`pay.method${cap(m.method)}`),
        value: f.fmtMoney(m.amount),
        meta: `${f.fmtPercent(m.share)} · ${f.fmtNumber(m.count)}`,
        tone: 'neutral' as const,
      }));
      return { text: f.t('copilot.answer.methods', { period: f.t(`copilot.period.${facts.period}`) }), cards };
    }

    case 'sales_overview':
    default: {
      const cards: CopilotCard[] = [
        { key: 'rev', title: f.t('copilot.card.revenue'), value: f.fmtMoney(d.revenue ?? 0), tone: 'good', meta: growthTxt ? `${growthUp ? '▲' : '▼'} ${growthTxt}` : undefined },
        { key: 'orders', title: f.t('copilot.card.paidOrders'), value: f.fmtNumber(d.paidCount ?? 0), tone: 'neutral' },
        { key: 'aov', title: f.t('copilot.card.avgOrder'), value: f.fmtMoney(d.avgOrder ?? 0), tone: 'neutral' },
      ];
      return { text: f.t('copilot.answer.overview', { period: f.t(`copilot.period.${facts.period}`) }), cards };
    }
  }
}

// يرفع أول حرف (لتحويل cash→Cash في مفاتيح طرق الدفع).
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// نقطة الدخول: يحلّل السؤال ويجمع البيانات ويبني رد المساعد.
export async function answerCopilot(rawQuestion: string, f: CopilotFormatter, locale: 'ar' | 'en'): Promise<CopilotMessage> {
  const parse = parseCopilotQuery(rawQuestion);

  try {
    // نجمع البيانات حسب النية (لا قمار؛ طلبات انتقائية).
    let report;
    let inventory;
    let products;

    if (parse.intent === 'low_stock') {
      const levels = await inventoryRepository.listLevels();
      inventory = levels;
    } else if (parse.intent === 'product_price') {
      const res = await productsRepository.searchProducts({ search: parse.productQuery ?? rawQuestion, limit: 5 });
      products = res.products;
    } else if (parse.intent !== 'greeting' && parse.intent !== 'help') {
      report = await reportsRepository.getSalesReport(parse.period as ReportPeriod, {}, f.currency);
    }

    const facts = buildCopilotFacts({ parse, report, inventory, products });
    const { text, cards } = renderFacts(facts, f, locale);

    return {
      id: messageId(),
      role: 'assistant',
      text,
      intent: parse.intent,
      period: parse.period,
      cards,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    // فشل جمع البيانات: رد صادق لا يكسر المحادثة.
    logger.error('Copilot answer failed', { error: String(error) });
    return {
      id: messageId(),
      role: 'assistant',
      text: f.t('copilot.error'),
      intent: 'unknown',
      period: parse.period,
      cards: [],
      createdAt: new Date().toISOString(),
    };
  }
}
