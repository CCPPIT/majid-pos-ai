/**
 * عقد الفاتورة (Sale) — PHASE 32 · أقسام 06 · 17 · 33 · 78.
 *
 * مثال مرجعي للتطوّر الآمن:
 *   Sale V1 (totalAmount: number خام) ← ترحيل حتمي ← Sale V2 (total: Money منظم).
 *
 * لماذا؟ تحويل total من رقم إلى كائن Money كسرٌ (قسم 16)، لذا يُرفع
 * MAJOR ويُوفَّر مسار ترحيل ومحوّل، فتبقى البيانات القديمة (المخزّنة
 * محليًا/غير المتصلة) مقروءة. الاختبار V1 Fixture → V2 Fixture حتمي.
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const SALE_CONTRACT_NAME = contractName('sales', 'Sale');
// النسخة القديمة (للترحيل).
export const SALE_V1 = '1.0.0';
// النسخة الحالية.
export const SALE_V2 = domainContractVersion('sales');

// مخطط المبلغ المنظّم (Money) المُضاف في V2.
export const moneyValueSchema = z.object({
  amount: z.number().finite().nonnegative(), // القيمة.
  currency: z.string().trim().length(3), // العملة.
});

// نوع المبلغ المنظّم.
export type MoneyValue = z.infer<typeof moneyValueSchema>;

// ── Sale V1: الشكل القديم (الإجمالي رقم خام بعملة منفصلة) ──
export const saleV1Schema = z.object({
  id: z.string().min(1), // المعرّف.
  saleNumber: z.string().min(1), // الرقم البشري.
  totalAmount: z.number().finite().nonnegative(), // الإجمالي الخام (قديم).
  currency: z.string().trim().length(3), // العملة (حقل منفصل قديم).
  customerName: z.string().optional(), // اسم العميل.
});

// نوع فاتورة V1.
export type SaleV1 = z.infer<typeof saleV1Schema>;

// ── Sale V2: الشكل الحالي (الإجمالي كائن Money) ──
export const saleV2Schema = z.object({
  id: z.string().min(1), // المعرّف.
  saleNumber: z.string().min(1), // الرقم البشري.
  total: moneyValueSchema, // الإجمالي منظّمًا (جديد — كاسر).
  customerName: z.string().optional(), // اسم العميل (متوافق).
  // حقل اختياري جديد: إضافة متوافقة لا تكسر (قسم 26).
  customerNote: z.string().trim().max(500).optional(),
});

// نوع فاتورة V2.
export type SaleV2 = z.infer<typeof saleV2Schema>;

// اسم الحدث ونسخته (قسم 33 — الأحداث مُنسَّخة).
export const SALE_COMPLETED_EVENT = 'sale.completed' as const;
export const SALE_COMPLETED_V1 = '1.0.0' as const;
export const SALE_COMPLETED_V2 = '2.0.0' as const;

/**
 * محوّل/ترحيل Sale V1 → V2 (قسم 17 و18 و78).
 * دالة خالصة حتمية: نفس المدخل ينتج نفس المخرج دائمًا.
 */
export const migrateSaleV1ToV2 = (v1: SaleV1): SaleV2 =>
  Object.freeze({
    id: v1.id, // المعرّف يبقى ثابتًا.
    saleNumber: v1.saleNumber, // الرقم البشري يبقى.
    // نحوّل الرقم الخام والعملة المنفصلة إلى كائن Money موحّد.
    total: { amount: v1.totalAmount, currency: v1.currency },
    customerName: v1.customerName, // اسم العميل ينتقل كما هو.
    // customerNote غير موجود في V1 فيبقى غائبًا (اختياري في V2).
  });

// عقد مستودع المبيعات المُنسَّخ (قسم 35).
export interface SaleRepositoryContract {
  // يجلب فاتورة بمعرّفها (تُعاد بالنسخة الحالية دائمًا).
  getById(id: string): Promise<import('../core').ContractResult<SaleV2>>;
}
