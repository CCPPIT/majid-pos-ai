/**
 * مستودع المالية والمحاسبة (PHASE 20).
 * يشتق القيود المالية من مصادر حقيقية: طلبات البيع المدفوعة (إيراد + ضريبة)،
 * أوامر الشراء المستلَمة (تكلفة + ضريبة)، والمصاريف اليدوية. لا يخزّن قيودًا
 * مشتقة؛ كل شيء يُحسب من المصادر الأصلية حتى تبقى الأرقام متسقة دائمًا.
 * المال كله عبر core/money ودوال المجال النقية.
 */
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import { logger } from '@/core/logging/logger';
import {
  createExpense,
  entriesFromExpenses,
  entriesFromOrders,
  entriesFromPurchaseOrders,
  filterEntries,
  rangeForPeriod,
  summarize,
  validateExpenseDraft,
  type DateRange,
  type Expense,
  type ExpenseDraft,
  type FinanceEntry,
  type FinancePeriod,
  type FinanceSummary,
} from '@/domain/finance';
import type { OrdersRepository } from './orders.repository';
import type { ProcurementRepository } from './procurement.repository';
import type { ExpensesSource } from '../sources/expenses.source';

// سياق المنفّذ (الهرمية + العملة).
export interface FinanceActorContext {
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  userId?: ID; // المنفّذ.
  currency: string; // العملة.
}

// نطاق التحميل (هرمية المتجر/الفرع).
export interface FinanceScope {
  storeId?: ID; // المتجر.
  branchId?: ID; // الفرع.
}

// واجهة المستودع.
export interface FinanceRepository {
  getReport(
    period: FinancePeriod,
    scope: FinanceScope,
    ctx?: { currency: string },
  ): Promise<{ summary: FinanceSummary; entries: FinanceEntry[] }>;
  listExpenses(): Promise<Expense[]>;
  addExpense(draft: ExpenseDraft, ctx: FinanceActorContext): Promise<Expense>;
}

export class AppFinanceRepository implements FinanceRepository {
  constructor(
    private readonly expensesSource: ExpensesSource, // مصدر المصاريف.
    private readonly ordersRepo: OrdersRepository, // مستودع طلبات البيع.
    private readonly procurementRepo: ProcurementRepository, // مستودع المشتريات.
  ) {}

  // يجمع كل القيود من المصادر الأصلية.
  private async allEntries(scope: FinanceScope, currency: string): Promise<FinanceEntry[]> {
    const [orders, purchaseOrders, expenses] = await Promise.all([
      this.ordersRepo.listOrders({ storeId: scope.storeId, branchId: scope.branchId }),
      this.procurementRepo.listPurchaseOrders(),
      this.expensesSource.list(),
    ]);

    // قيود المبيعات (المدفوعة) + ضريبتها.
    const saleEntries = entriesFromOrders(orders, currency);
    // نربط طريقة الدفع من الدفعات لتحديد النقدي من غيره (تبسيط: الافتراضي نقدي).
    // قيود المشتريات (المستلَمة) + ضريبتها.
    const purchaseEntries = entriesFromPurchaseOrders(purchaseOrders, currency);
    // قيود المصاريف اليدوية.
    const expenseEntries = entriesFromExpenses(expenses);

    return [...saleEntries, ...purchaseEntries, ...expenseEntries];
  }

  // تقرير مالي لفترة: قيود + ملخص محاسبي.
  async getReport(
    period: FinancePeriod,
    scope: FinanceScope,
    ctx?: { currency: string },
  ): Promise<{ summary: FinanceSummary; entries: FinanceEntry[] }> {
    const currency = ctx?.currency ?? 'YER';
    const all = await this.allEntries(scope, currency);
    const range: DateRange = rangeForPeriod(period);
    const entries = filterEntries(all, range);
    const summary = summarize(entries, currency);
    return { summary, entries };
  }

  // قائمة المصاريف اليدوية.
  async listExpenses(): Promise<Expense[]> {
    return this.expensesSource.list();
  }

  // إضافة مصروف يدوي (تحقق في طبقة البيانات أيضًا).
  async addExpense(draft: ExpenseDraft, ctx: FinanceActorContext): Promise<Expense> {
    const validation = validateExpenseDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid expense');
    }
    const expense = createExpense(draft, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      storeId: ctx.storeId,
      userId: ctx.userId,
      currency: ctx.currency,
    });
    await this.expensesSource.save(expense);
    logger.info('Expense added', { id: String(expense.id), amount: expense.amount.amount });
    return expense;
  }
}
