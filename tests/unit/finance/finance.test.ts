/**
 * اختبارات مجال ومستودع المالية (PHASE 20).
 * تغطي: اشتقاق القيود من المبيعات (المدفوعة فقط) والمشتريات (المستلَمة فقط)،
 * حساب الملخص المحاسبي (إيراد/تكلفة/مصاريف/ربح)، فلترة الفترة الزمنية،
 * تحقق المصروف، وتجميع المستودع للقيود من مصادر حقيقية.
 */
import {
  entriesFromOrders,
  entriesFromPurchaseOrders,
  entriesFromExpenses,
  summarize,
  filterEntries,
  rangeForPeriod,
  validateExpenseDraft,
  createExpense,
  type ExpenseDraft,
} from '@/domain/finance';
import { money } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId } from '@/core/types/domain';
import type { SaleOrder } from '@/domain/sales/types';
import type { PurchaseOrder } from '@/domain/procurement/types';
import type { Expense } from '@/domain/finance/types';

// يبني طلب بيع للاختبار.
function makeOrder(over: Partial<SaleOrder>): SaleOrder {
  return {
    id: asId('o'),
    orderNumber: 'ORD-0001',
    lines: [],
    subtotal: money(1000, 'YER'),
    discount: money(0, 'YER'),
    taxAmount: money(150, 'YER'),
    total: money(1150, 'YER'),
    taxRatePercent: 15,
    discountPercent: 0,
    status: 'paid',
    paymentStatus: 'paid',
    customer: { type: 'walk_in', name: 'زبون' },
    cashierName: 'كاشير',
    currency: 'YER',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...over,
  };
}

// يبني أمر شراء للاختبار.
function makePO(over: Partial<PurchaseOrder>): PurchaseOrder {
  return {
    id: asId('p'),
    poNumber: 'PO-0001',
    tenantId: asId('t'),
    supplierId: asId('s'),
    supplierNameAr: 'مورّد',
    supplierNameEn: 'Supplier',
    status: 'received',
    lines: [],
    currency: 'YER',
    subtotal: money(600, 'YER'),
    taxRate: 0,
    tax: money(0, 'YER'),
    total: money(600, 'YER'),
    createdAt: '2026-05-02T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z',
    receivedAt: '2026-05-02T12:00:00.000Z',
    ...over,
  };
}

describe('finance entry derivation (PHASE 20)', () => {
  test('only paid orders produce revenue entries', () => {
    const paid = makeOrder({ id: asId('a'), paymentStatus: 'paid', status: 'paid' });
    const unpaid = makeOrder({ id: asId('b'), orderNumber: 'ORD-0002', paymentStatus: 'unpaid', status: 'pending_payment' });
    const entries = entriesFromOrders([paid, unpaid], 'YER');
    // بيع + ضريبة بيع للطلب المدفوع فقط.
    expect(entries.filter((e) => e.type === 'sale')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'sale_tax')).toHaveLength(1);
  });

  test('only received purchase orders produce cost entries', () => {
    const received = makePO({ id: asId('a'), status: 'received' });
    const draft = makePO({ id: asId('b'), status: 'approved' });
    const entries = entriesFromPurchaseOrders([received, draft], 'YER');
    expect(entries.filter((e) => e.type === 'purchase')).toHaveLength(1);
  });
});

describe('finance summary (PHASE 20)', () => {
  test('computes revenue, cost, expenses and profit', () => {
    const orders = [
      makeOrder({ id: asId('a'), total: money(1150, 'YER'), taxAmount: money(150, 'YER') }),
    ];
    const pos = [makePO({ id: asId('p'), subtotal: money(600, 'YER'), tax: money(0, 'YER') })];
    const expense: Expense = createExpense(
      { category: 'rent', note: 'إيجار', amount: '200', method: 'cash' },
      { tenantId: asId('t'), currency: 'YER' },
    );

    const entries = [
      ...entriesFromOrders(orders, 'YER'),
      ...entriesFromPurchaseOrders(pos, 'YER'),
      ...entriesFromExpenses([expense]),
    ];

    const s = summarize(entries, 'YER');
    expect(s.revenue.amount).toBe(1150); // الإيراد.
    expect(s.taxCollected.amount).toBe(150); // الضريبة المحصّلة.
    expect(s.purchasesCost.amount).toBe(600); // التكلفة.
    expect(s.expenses.amount).toBe(200); // المصروف.
    // مجمل الربح = 1150 − 600 = 550.
    expect(s.grossProfit.amount).toBe(550);
    // صافي الربح = 550 − 200 = 350.
    expect(s.netProfit.amount).toBe(350);
    expect(s.transactionCount).toBe(4); // بيع + ضريبة + شراء + مصروف.
  });
});

describe('finance period filter (PHASE 20)', () => {
  test('all-period range includes everything', () => {
    const range = rangeForPeriod('all');
    expect(range.from).toBeUndefined();
    expect(range.to).toBeUndefined();
  });

  test('filters entries outside the date range', () => {
    const entries = [
      { id: '1', at: '2026-01-01T00:00:00.000Z' },
      { id: '2', at: '2026-06-01T00:00:00.000Z' },
    ] as unknown as Parameters<typeof filterEntries>[0];
    const range = { from: '2026-05-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z' };
    const filtered = filterEntries(entries, range);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });
});

describe('expense validation (PHASE 20)', () => {
  test('rejects zero amount and missing note', () => {
    expect(validateExpenseDraft({ category: 'rent', note: 'x', amount: '0', method: 'cash' }).valid).toBe(false);
    expect(validateExpenseDraft({ category: 'rent', note: '', amount: '100', method: 'cash' }).valid).toBe(false);
  });

  test('accepts a valid expense and builds an entity', () => {
    const draft: ExpenseDraft = { category: 'utilities', note: 'فاتورة كهرباء', amount: '150.5', method: 'cash' };
    expect(validateExpenseDraft(draft).valid).toBe(true);
    const e = createExpense(draft, { tenantId: asId('t'), currency: 'YER' });
    expect(e.amount.amount).toBe(150.5);
    expect(e.category).toBe('utilities');
  });

  test('invalid expense draft throws on build', () => {
    expect(() =>
      createExpense({ category: 'other', note: '', amount: '-5', method: 'cash' }, { tenantId: asId('t'), currency: 'YER' }),
    ).toThrow(ValidationError);
  });
});

// ── اختبار تجميع المستودع من مصادر حقيقية ──────────────────────────────────
import { LocalExpensesSource } from '@/data/sources/expenses.source';
import { AppFinanceRepository } from '@/data/repositories/finance.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import type { OrdersRepository } from '@/data/repositories/orders.repository';
import type { ProcurementRepository } from '@/data/repositories/procurement.repository';

describe('finance repository aggregation (PHASE 20)', () => {
  test('report aggregates orders, POs and expenses', async () => {
    const prefs = new InMemoryPreferencesSource();
    const expensesSource = new LocalExpensesSource({
      getString: (k) => prefs.getString(k),
      setString: (k, v) => prefs.setString(k, v),
    });

    // مستودعا طلبات/مشتريات وهميان يعيدان بيانات ثابتة.
    const ordersRepo: Pick<OrdersRepository, 'listOrders'> = {
      listOrders: async () => [makeOrder({ id: asId('sale-1'), total: money(1000, 'YER'), taxAmount: money(0, 'YER') })],
    };
    const procurementRepo: Pick<ProcurementRepository, 'listPurchaseOrders'> = {
      listPurchaseOrders: async () => [],
    };

    const repo = new AppFinanceRepository(
      expensesSource,
      ordersRepo as OrdersRepository,
      procurementRepo as ProcurementRepository,
    );

    await repo.addExpense(
      { category: 'rent', note: 'إيجار', amount: '100', method: 'cash' },
      { tenantId: asId('t'), currency: 'YER' },
    );

    const report = await repo.getReport('all', {}, { currency: 'YER' });
    expect(report.summary.revenue.amount).toBe(1000);
    expect(report.summary.expenses.amount).toBe(100);
    // صافي الربح = 1000 (إيراد) − 0 (تكلفة) − 100 (مصروف) = 900.
    expect(report.summary.netProfit.amount).toBe(900);
    expect(report.entries.length).toBe(2); // بيع + مصروف.
  });
});
