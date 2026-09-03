/**
 * حسابات الدفع — PHASE 31 · قسم 19.
 * دوال نقية لحساب الباقي والتحقق من كفاية المبالغ وتوزيع الدفع المقسّم.
 */
import { money, sumMoney, zeroMoney, type CurrencyCode, type Money } from '@/sdk/core';
import type { PaymentMethod, PaymentSplit } from '../contracts/payment-contracts';

// تسامح مقداره نصف قرش لتفادي مشاكل الفاصلة العائمة في المقارنات.
export const AMOUNT_TOLERANCE = 0.005;

// يحسب الباقي للعميل (المُسلَّم − المستحق، ولا يقل عن صفر).
export const calculateChange = (due: Money, tendered: Money): Money =>
  // الفرق الموجب فقط؛ النقص يُعالَج كخطأ لا كباقٍ سالب.
  money(Math.max(0, tendered.amount - due.amount), due.currency);

// هل المبلغ المُسلَّم يكفي المستحق؟
export const isSufficient = (due: Money, tendered: Money): boolean =>
  // مع تسامح الفاصلة العائمة.
  tendered.amount + AMOUNT_TOLERANCE >= due.amount;

// مجموع أجزاء الدفع المقسّم.
export const splitsTotal = (splits: readonly PaymentSplit[], currency: CurrencyCode): Money =>
  // نجمع مبالغ الأجزاء بعملة واحدة.
  sumMoney(
    splits.map((split) => split.amount),
    currency,
  );

// هل مجموع الأجزاء يطابق المستحق تمامًا؟
export const splitsCoverTotal = (splits: readonly PaymentSplit[], due: Money): boolean => {
  // مجموع الأجزاء.
  const total = splitsTotal(splits, due.currency);
  // المطابقة ضمن التسامح (لا زيادة ولا نقصان).
  return Math.abs(total.amount - due.amount) <= AMOUNT_TOLERANCE;
};

// المبلغ الناقص لإتمام الدفع المقسّم (صفر عند الاكتمال).
export const splitsShortfall = (splits: readonly PaymentSplit[], due: Money): Money => {
  // مجموع ما دُفع.
  const total = splitsTotal(splits, due.currency);
  // الفارق الموجب فقط.
  return money(Math.max(0, due.amount - total.amount), due.currency);
};

// هل تتطلب الطريقة مبلغًا مُسلَّمًا (نقدًا فقط)؟
export const requiresTendered = (method: PaymentMethod): boolean => method === 'cash';

// هل تتطلب الطريقة مزوّد دفع خارجيًا؟
export const requiresProvider = (method: PaymentMethod): boolean =>
  // النقد والآجل يُعالَجان محليًا؛ الباقي يمر عبر مزوّد.
  method === 'card' || method === 'wallet' || method === 'transfer';

// يقترح فئات نقدية سريعة أكبر من المستحق (أزرار الدفع السريع في الواجهة).
export const suggestQuickCash = (due: Money, denominations: readonly number[]): readonly Money[] => {
  // نرشّح الفئات التي تغطي المستحق ونرتّبها تصاعديًا.
  const covering = denominations
    .filter((value) => value >= due.amount)
    .sort((a, b) => a - b)
    .slice(0, 4);
  // المبلغ المضبوط أولًا ثم الفئات المقترحة.
  return [money(due.amount, due.currency), ...covering.map((value) => money(value, due.currency))];
};

// يبني جزء دفع واحد (مساعد لبناء الدفع المقسّم).
export const paymentSplit = (method: PaymentMethod, amount: number, currency: CurrencyCode, reference?: string): PaymentSplit => ({
  method,
  amount: money(amount, currency),
  reference,
});

// مبلغ صفري بعملة محددة (اختصار للاستخدام في بناء الدفعات).
export const zeroAmount = (currency: CurrencyCode): Money => zeroMoney(currency);
