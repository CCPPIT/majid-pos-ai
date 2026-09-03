/**
 * أنواع مجال المالية والمحاسبة (PHASE 20).
 * نموذج محاسبي بسيط صادق: القيود تُشتق من أحداث حقيقية موجودة
 * (مبيعات مدفوعة، أوامر شراء مستلَمة) بالإضافة إلى مصاريف يدوية.
 * كل المبالغ Money حقيقية عبر core/money — الواجهة لا تحسب شيئًا.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { Money } from '@/core/money/money';

// اتجاه القيد المالي (داخل/خارج/معلومة).
export type EntryDirection = 'in' | 'out' | 'info';

// نوع القيد المالي.
export type FinanceEntryType =
  | 'sale' // إيراد بيع (داخل).
  | 'sale_tax' // ضريبة محصّلة من المبيعات (داخل، تُفصل للوعاء الضريبي).
  | 'purchase' // تكلفة مشتريات مستلَمة (خارج).
  | 'purchase_tax' // ضريبة مدفوعة على المشتريات (خارج/قابلة للخصم).
  | 'expense'; // مصروف يدوي (خارج).

// تصنيف المصروف اليدوي.
export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'marketing' | 'maintenance' | 'other';

// قيد مالي مشتق أو يدوي (سجل موحّد للعرض).
export interface FinanceEntry {
  id: string; // معرف القيد.
  type: FinanceEntryType; // النوع.
  direction: EntryDirection; // الاتجاه.
  account: string; // اسم/رمز الحساب (مفتاح i18n للحساب).
  amount: Money; // المبلغ.
  method?: string; // طريقة الدفع (إن وُجدت).
  reference: string; // المرجع (رقم طلب/أمر شراء/مصروف).
  at: ISODateString; // لحظة القيد.
}

// مصروف يدوي (يُخزَّن على الجهاز).
export interface Expense extends Auditable {
  id: ID; // معرف المصروف.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  category: ExpenseCategory; // التصنيف.
  note: string; // ملاحظة/وصف.
  amount: Money; // المبلغ.
  method: string; // طريقة الدفع (cash/card/…).
  spentAt: ISODateString; // لحظة الصرف.
  createdBy?: ID; // المنفّذ.
}

// نموذج إدخال مصروف.
export interface ExpenseDraft {
  category: ExpenseCategory; // التصنيف.
  note: string; // الوصف.
  amount: string; // المبلغ كنص.
  method: string; // طريقة الدفع.
}

// نطاق التقرير الزمني.
export type FinancePeriod = 'today' | 'week' | 'month' | 'all';

// ملخص مالي لفترة.
export interface FinanceSummary {
  revenue: Money; // إيرادات المبيعات (صافي المبيعات المدفوعة).
  taxCollected: Money; // ضريبة محصّلة.
  purchasesCost: Money; // تكلفة المشتريات المستلَمة.
  taxPaid: Money; // ضريبة على المشتريات.
  expenses: Money; // المصاريف اليدوية.
  grossProfit: Money; // الإيراد − تكلفة البضاعة.
  netProfit: Money; // الإيراد − التكلفة − المصاريف.
  transactionCount: number; // عدد القيود.
  cashIn: Money; // المقبوضات النقدية.
  cashOut: Money; // المدفوعات النقدية.
}

// مدى التقرير (من/إلى) بلحظات ISO.
export interface DateRange {
  from?: ISODateString; // بداية الفترة.
  to?: ISODateString; // نهاية الفترة.
}

// سياق المنفّذ.
export interface FinanceContext {
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  userId?: ID; // المنفّذ.
  currency: string; // العملة.
}
