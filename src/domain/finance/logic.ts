/**
 * منطق المالية النقي (PHASE 20).
 * يشتق القيود المالية من أحداث حقيقية (طلبات مدفوعة، أوامر شراء مستلَمة،
 * مصاريف يدوية)، يفلترها بفترة زمنية، ويحسب ملخصًا محاسبيًا (إيراد/تكلفة/
 * مصاريف/ربح) بمال حقيقي عبر core/money. دوال خالصة — قابلة للاختبار.
 */
import { money, type Money } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId, type ID } from '@/core/types/domain';
import type { SaleOrder } from '@/domain/sales/types';
import type { PurchaseOrder } from '@/domain/procurement/types';
import type {
  DateRange,
  Expense,
  ExpenseCategory,
  ExpenseDraft,
  FinanceEntry,
  FinanceEntryType,
  FinanceSummary,
} from './types';

// حساب المبيعات: يُعترف بالإيراد للطلبات المدفوعة فقط.
export function entriesFromOrders(orders: SaleOrder[], currency: string): FinanceEntry[] {
  const entries: FinanceEntry[] = [];
  for (const order of orders) {
    if (order.paymentStatus !== 'paid') continue; // المبيعات غير المدفوعة لا تُعترف.
    // قيد الإيراد (الإجمالي المحصّل).
    entries.push({
      id: `sale-${String(order.id)}`,
      type: 'sale',
      direction: 'in',
      account: 'finance.account.sales',
      amount: money(order.total.amount, currency),
      reference: order.orderNumber,
      at: order.createdAt,
    });
    // قيد ضريبة محصّلة (وعاء ضريبي منفصل).
    if (order.taxAmount.amount > 0) {
      entries.push({
        id: `sale-tax-${String(order.id)}`,
        type: 'sale_tax',
        direction: 'in',
        account: 'finance.account.taxCollected',
        amount: money(order.taxAmount.amount, currency),
        reference: order.orderNumber,
        at: order.createdAt,
      });
    }
  }
  return entries;
}

// حساب المشتريات: تُعترف التكلفة للأوامر المستلَمة بالكامل فعلًا.
export function entriesFromPurchaseOrders(poList: PurchaseOrder[], currency: string): FinanceEntry[] {
  const entries: FinanceEntry[] = [];
  for (const po of poList) {
    if (po.status !== 'received') continue; // المستلَمة فقط تُكلف.
    const at = po.receivedAt ?? po.updatedAt;
    // قيد تكلفة المشتريات (قبل الضريبة).
    entries.push({
      id: `purchase-${String(po.id)}`,
      type: 'purchase',
      direction: 'out',
      account: 'finance.account.purchases',
      amount: money(po.subtotal.amount, currency),
      reference: po.poNumber,
      at,
    });
    // قيد ضريبة المشتريات.
    if (po.tax.amount > 0) {
      entries.push({
        id: `purchase-tax-${String(po.id)}`,
        type: 'purchase_tax',
        direction: 'out',
        account: 'finance.account.taxPaid',
        amount: money(po.tax.amount, currency),
        reference: po.poNumber,
        at,
      });
    }
  }
  return entries;
}

// قيود المصاريف اليدوية.
export function entriesFromExpenses(expenses: Expense[]): FinanceEntry[] {
  return expenses.map((e) => ({
    id: `expense-${String(e.id)}`,
    type: 'expense' as FinanceEntryType,
    direction: 'out' as const,
    account: `finance.expenseCategory.${e.category}`,
    amount: money(e.amount.amount, e.amount.currency),
    method: e.method,
    reference: e.note,
    at: e.spentAt,
  }));
}

// هل لحظة ISO ضمن المدى الزمني؟
export function withinRange(at: string, range: DateRange): boolean {
  const t = new Date(at).getTime();
  if (range.from && t < new Date(range.from).getTime()) return false;
  if (range.to && t > new Date(range.to).getTime()) return false;
  return true;
}

// يفلتر القيود بفترة زمنية ثم يرتبها الأحدث أولًا.
export function filterEntries(entries: FinanceEntry[], range: DateRange): FinanceEntry[] {
  return entries
    .filter((e) => withinRange(e.at, range))
    .sort((a, b) => b.at.localeCompare(a.at));
}

// يحسب نطاقًا زمنيًا من فترة محددة (اليوم/الأسبوع/الشهر/الكل).
export function rangeForPeriod(period: string, now: Date = new Date()): DateRange {
  if (period === 'all') return {};
  const end = now.getTime();
  let start: number;
  if (period === 'today') {
    // بداية اليوم الحالي منتصف الليل.
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    start = d.getTime();
  } else if (period === 'week') {
    start = end - 7 * 24 * 60 * 60 * 1000; // آخر 7 أيام.
  } else {
    // الشهر: آخر 30 يومًا.
    start = end - 30 * 24 * 60 * 60 * 1000;
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

// يجمع القيود في ملخص مالي محاسبي.
export function summarize(entries: FinanceEntry[], currency: string): FinanceSummary {
  // مراكم المبالغ (أرقام تُحوَّل إلى Money في النهاية لتجنّب كائنات وسيطة).
  let sumRevenue = 0;
  let sumTaxCollected = 0;
  let sumPurchases = 0;
  let sumTaxPaid = 0;
  let sumExpenses = 0;
  let sumCashIn = 0;
  let sumCashOut = 0;

  for (const e of entries) {
    switch (e.type) {
      case 'sale':
        sumRevenue += e.amount.amount;
        if (!e.method || e.method === 'cash') sumCashIn += e.amount.amount; // البيع النقدي.
        break;
      case 'sale_tax':
        sumTaxCollected += e.amount.amount;
        break;
      case 'purchase':
        sumPurchases += e.amount.amount;
        sumCashOut += e.amount.amount; // مشتريات تُدفع نقدًا (تبسيط صادق).
        break;
      case 'purchase_tax':
        sumTaxPaid += e.amount.amount;
        sumCashOut += e.amount.amount;
        break;
      case 'expense':
        sumExpenses += e.amount.amount;
        if (!e.method || e.method === 'cash') sumCashOut += e.amount.amount;
        break;
    }
  }

  // مجمل الربح = الإيراد − تكلفة البضاعة.
  const grossProfitAmount = sumRevenue - sumPurchases;
  // صافي الربح = مجمل الربح − المصاريف.
  const netProfitAmount = grossProfitAmount - sumExpenses;

  return {
    revenue: money(sumRevenue, currency),
    taxCollected: money(sumTaxCollected, currency),
    purchasesCost: money(sumPurchases, currency),
    taxPaid: money(sumTaxPaid, currency),
    expenses: money(sumExpenses, currency),
    grossProfit: money(grossProfitAmount, currency),
    netProfit: money(netProfitAmount, currency),
    transactionCount: entries.length,
    cashIn: money(sumCashIn, currency),
    cashOut: money(sumCashOut, currency),
  };
}

// تجميع القيود حسب النوع (لرسم توزيع مبسّط).
export function groupByAccount(entries: FinanceEntry[], currency: string): { account: string; total: Money; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const cur = map.get(e.account) ?? { total: 0, count: 0 };
    cur.total += e.amount.amount;
    cur.count += 1;
    map.set(e.account, cur);
  }
  return Array.from(map.entries())
    .map(([account, v]) => ({ account, total: money(v.total, currency), count: v.count }))
    .sort((a, b) => b.total.amount - a.total.amount);
}

// ── المصروف اليدوي ──────────────────────────────────────────────────────────

// تحقق نموذج المصروف.
export function validateExpenseDraft(draft: ExpenseDraft): { valid: boolean; errorKey?: string } {
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, errorKey: 'finance.error.amountInvalid' };
  }
  if (!draft.note.trim()) {
    return { valid: false, errorKey: 'finance.error.noteRequired' };
  }
  return { valid: true };
}

// يبني كيان مصروف من النموذج.
export function createExpense(
  draft: ExpenseDraft,
  ctx: { tenantId: ID; organizationId?: ID; branchId?: ID; storeId?: ID; userId?: ID; currency: string; category?: ExpenseCategory },
  now: string = new Date().toISOString(),
): Expense {
  const validation = validateExpenseDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid expense');
  return {
    id: asId(`expense-${Date.now()}`),
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    storeId: ctx.storeId,
    category: draft.category,
    note: draft.note.trim(),
    amount: money(Number(draft.amount), ctx.currency),
    method: draft.method || 'cash',
    spentAt: now,
    createdBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
}
