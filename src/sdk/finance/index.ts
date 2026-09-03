/**
 * مجال المالية — PHASE 31 · قسم 24.
 * القيود المالية سجل غير قابل للتعديل: التصحيح يكون بقيد عكسي لا بحذف.
 */
import type {
  AccountId,
  AsyncResult,
  AuditableFields,
  CurrencyCode,
  DateRange,
  ISODateTime,
  Money,
  PaginatedResult,
  QueryOptions,
  TenantScopedFields,
  TransactionId,
} from '@/sdk/core';

// نوع الحساب المحاسبي.
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

// نوع الحركة المالية.
export type TransactionKind = 'sale' | 'refund' | 'expense' | 'income' | 'transfer' | 'adjustment';

// حساب مالي.
export interface Account extends TenantScopedFields, AuditableFields {
  readonly id: AccountId; // المعرّف.
  readonly nameAr: string; // الاسم بالعربية.
  readonly nameEn: string; // الاسم بالإنجليزية.
  readonly type: AccountType; // نوعه.
  readonly balance: Money; // رصيده.
  readonly currency: CurrencyCode; // عملته.
  readonly active: boolean; // نشط؟
}

// حركة مالية (قيد).
export interface FinancialTransaction extends TenantScopedFields, AuditableFields {
  readonly id: TransactionId; // المعرّف.
  readonly accountId: AccountId; // الحساب.
  readonly kind: TransactionKind; // نوعها.
  readonly amount: Money; // مبلغها.
  readonly descriptionKey: string; // وصفها.
  readonly reference?: string; // مرجعها (رقم فاتورة).
  readonly occurredAt: ISODateTime; // لحظتها.
  readonly reversedBy?: TransactionId; // القيد العكسي الذي ألغاها.
}

// ملخص مالي لفترة.
export interface FinancialSummary {
  readonly revenue: Money; // الإيرادات.
  readonly expenses: Money; // المصروفات.
  readonly netProfit: Money; // صافي الربح.
  readonly refunds: Money; // المرتجعات.
  readonly transactionCount: number; // عدد الحركات.
  readonly currency: CurrencyCode; // العملة.
  readonly range: DateRange; // الفترة.
}

// استعلام الحركات المالية.
export interface TransactionQuery extends QueryOptions {
  readonly accountId?: AccountId; // حساب محدد.
  readonly kind?: TransactionKind; // نوع محدد.
  readonly dateRange?: DateRange; // فترة.
}

// مستودع المالية.
export interface FinanceRepository {
  // يسرد الحسابات.
  listAccounts(query?: QueryOptions): AsyncResult<PaginatedResult<Account>>;
  // يجلب حسابًا.
  getAccount(id: AccountId): AsyncResult<Account>;
  // يسرد الحركات.
  listTransactions(query?: TransactionQuery): AsyncResult<PaginatedResult<FinancialTransaction>>;
  // يسجّل حركة جديدة (لا تُعدَّل بعدها).
  recordTransaction(transaction: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'>): AsyncResult<FinancialTransaction>;
  // يعكس حركة بقيد مضاد (التصحيح الوحيد المسموح).
  reverseTransaction(id: TransactionId, reasonKey: string): AsyncResult<FinancialTransaction>;
  // يبني ملخصًا ماليًا لفترة.
  getSummary(range: DateRange): AsyncResult<FinancialSummary>;
}

// يحسب صافي الربح من الإيراد والمصروف (دالة نقية).
export const netProfit = (revenue: number, expenses: number): number =>
  // الفرق قد يكون سالبًا (خسارة) وهذا صحيح محاسبيًا.
  revenue - expenses;

// هل الحركة معكوسة (مُلغاة بقيد مضاد)؟
export const isReversed = (transaction: FinancialTransaction): boolean =>
  transaction.reversedBy !== undefined;
