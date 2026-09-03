/**
 * مصدر المصاريف المحلي الدائم (PHASE 20).
 * يخزّن المصاريف اليدوية على الجهاز (Offline-First) عبر التفضيلات النصية.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { Expense } from '@/domain/finance/types';

// واجهة تخزين نصية.
export interface ExpenseStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// واجهة المصدر.
export interface ExpensesSource {
  list(): Promise<Expense[]>; // كل المصاريف (الأحدث أولًا).
  save(expense: Expense): Promise<void>; // إضافة مصروف.
}

// قراءة JSON آمنة (تتسامح مع الفساد).
async function read(store: ExpenseStore): Promise<Expense[]> {
  try {
    const raw = await store.getString(STORAGE_KEYS.expenses);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { expenses?: Expense[] };
    return parsed.expenses ?? [];
  } catch (error) {
    logger.warn('Failed to parse expenses', { error: String(error) });
    return [];
  }
}

export class LocalExpensesSource implements ExpensesSource {
  constructor(private readonly store: ExpenseStore) {} // نستقبل المخزن.

  // قائمة المصاريف مرتبة الأحدث أولًا بلحظة الصرف.
  async list(): Promise<Expense[]> {
    const list = await read(this.store);
    return [...list].sort((a, b) => b.spentAt.localeCompare(a.spentAt));
  }

  // إضافة مصروف (يدخل في بداية القائمة).
  async save(expense: Expense): Promise<void> {
    const list = await read(this.store);
    await this.store.setString(STORAGE_KEYS.expenses, JSON.stringify({ expenses: [expense, ...list] }));
  }
}
