/**
 * منطق الولاء النقي (PHASE 19).
 * حساب النقاط من الإنفاق، اشتقاق شريحة العميل (Tier)، وتسجيل عملية شراء
 * على ملف العميل دون تكرار. دوال خالصة بلا تخزين — قابلة للاختبار.
 */
import { money, roundMoney, type Money } from '@/core/money/money';
import { asId, type ID } from '@/core/types/domain';
import type { Customer, CustomerPurchase, LoyaltyProgramConfig, LoyaltyTier } from './types';

// إعداد البرنامج الافتراضي: نقطة واحدة لكل 1000 وحدة عملة (مناسب للريال اليمني).
export const DEFAULT_LOYALTY: LoyaltyProgramConfig = {
  pointsPerCurrency: 1,
  currencyDivisor: 1000,
};

// عتبات الشريحة حسب الإنفاق التراكمي (بوحدة العملة).
export const TIER_THRESHOLDS: { tier: LoyaltyTier; minSpent: number }[] = [
  { tier: 'platinum', minSpent: 1_000_000 }, // بلاتيني: مليون فأكثر.
  { tier: 'gold', minSpent: 250_000 }, // ذهبي: ربع مليون فأكثر.
  { tier: 'silver', minSpent: 50_000 }, // فضي: خمسين ألف فأكثر.
  { tier: 'bronze', minSpent: 0 }, // برونزي: الافتراضي.
];

// ترتيب الشرائح من الأدنى للأعلى.
export const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

// عدد النقاط المكتسبة من مبلغ إنفاق (الصرف دائمًا موجب، ولا كسور نقاط).
export function pointsForAmount(amount: number, config: LoyaltyProgramConfig = DEFAULT_LOYALTY): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const points = (amount / config.currencyDivisor) * config.pointsPerCurrency;
  return Math.floor(points);
}

// يشتق الشريحة من إجمالي الإنفاق.
export function tierForSpent(totalSpentAmount: number): LoyaltyTier {
  const matched = TIER_THRESHOLDS.find((entry) => totalSpentAmount >= entry.minSpent);
  return matched?.tier ?? 'bronze';
}

// هل الشريحة الجديدة أعلى من الحالية؟ (للترقية فقط دون إنزال).
export function isTierUpgrade(from: LoyaltyTier, to: LoyaltyTier): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

// وسائط تسجيل عملية شراء.
export interface RecordPurchaseArgs {
  customer: Customer; // العميل.
  orderId: ID; // معرف الطلب.
  orderNumber: string; // رقم الطلب.
  total: Money; // إجمالي الطلب (المدفوع).
  at: string; // لحظة الشراء.
  config?: LoyaltyProgramConfig; // إعداد الولاء.
}

// يسجّل عملية شراء على العميل ويعيد نسخة محدّثة (يمنع تكرار نفس الطلب).
// يزيد الإنفاق، عدد الطلبات، النقاط، ويرقّي الشريحة عند تجاوز العتبة.
export function recordPurchase(args: RecordPurchaseArgs): Customer {
  const { customer, orderId, orderNumber, total, at } = args;
  const config = args.config ?? DEFAULT_LOYALTY;

  // منع التكرار: إن كان الطلب مُسجّلًا بالفعل نُعيد العميل كما هو.
  const already = customer.purchases.some((p) => String(p.orderId) === String(orderId));
  if (already) return customer;

  const earned = pointsForAmount(total.amount, config);
  const newSpentAmount = roundMoney(customer.totalSpent.amount + total.amount);
  const newTotalSpent = money(newSpentAmount, customer.totalSpent.currency);
  const newTier = tierForSpent(newSpentAmount);

  const purchase: CustomerPurchase = { orderId, orderNumber, total, at };

  return {
    ...customer,
    totalSpent: newTotalSpent,
    orderCount: customer.orderCount + 1,
    pointsBalance: customer.pointsBalance + earned,
    totalPointsEarned: customer.totalPointsEarned + earned,
    tier: newTier,
    purchases: [purchase, ...customer.purchases],
    lastVisitAt: at,
    updatedAt: at,
  };
}

// ملخص الولاء لشاشة العميل (نقاط/شريحة/متبقٍّ للترقية).
export function loyaltySummary(customer: Customer): {
  points: number;
  tier: LoyaltyTier;
  spent: number;
  nextTier: LoyaltyTier | null;
  toNextTier: number; // المبلغ المتبقّي للترقية (0 إن كان في الأعلى).
} {
  const currentIndex = TIER_ORDER.indexOf(customer.tier);
  const nextTier = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1]! : null;
  const nextThreshold = nextTier ? TIER_THRESHOLDS.find((e) => e.tier === nextTier)?.minSpent ?? 0 : 0;
  const toNextTier = nextTier ? Math.max(0, roundMoney(nextThreshold - customer.totalSpent.amount)) : 0;
  return {
    points: customer.pointsBalance,
    tier: customer.tier,
    spent: customer.totalSpent.amount,
    nextTier,
    toNextTier,
  };
}

// ينشئ معرف ملاحظة (يُستخدم من المستودع).
export function newNoteId(): ID {
  return asId(`note-${Date.now()}`);
}
