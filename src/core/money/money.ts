/**
 * Money value object — real monetary arithmetic for POS / Finance domains.
 *
 * All cart, checkout, tax, discount and payment calculations (Section 56)
 * MUST go through this module — never use raw floating-point addition on
 * money in feature code.
 */
import { ValidationError } from '../errors/AppError';

/** ISO-4217 currency code, e.g. 'YER', 'SAR', 'USD'. */
export type CurrencyCode = string;

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** Round to 2 decimal places using EPSILON-safe rounding. */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const money = (amount: number, currency: CurrencyCode): Money => {
  if (!Number.isFinite(amount)) {
    throw new ValidationError('Money amount must be a finite number', {
      amount: String(amount),
    });
  }
  return { amount: roundMoney(amount), currency };
};

const assertSameCurrency = (a: Money, b: Money): void => {
  if (a.currency !== b.currency) {
    throw new ValidationError(`Currency mismatch: ${a.currency} vs ${b.currency}`, {
      from: a.currency,
      to: b.currency,
    });
  }
};

export const addMoney = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
};

export const subtractMoney = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
};

/** Multiply a unit price by a quantity (line totals). */
export const multiplyMoney = (unitPrice: Money, quantity: number): Money => {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new ValidationError('Quantity must be a non-negative finite number', {
      quantity: String(quantity),
    });
  }
  return money(unitPrice.amount * quantity, unitPrice.currency);
};

export const sumMoney = (items: readonly Money[], currency: CurrencyCode): Money =>
  items.reduce<Money>((acc, item) => addMoney(acc, item), money(0, currency));

/**
 * Apply a percentage rate.
 * Tax 15%  -> ratePercent = 15
 * Discount 10% -> ratePercent = 10
 */
export const percentageOf = (base: Money, ratePercent: number): Money => {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new ValidationError('Percentage rate must be between 0 and 100', {
      rate: String(ratePercent),
    });
  }
  return money(base.amount * (ratePercent / 100), base.currency);
};

/** Convert to minor units (fils / halala / cents) for payment gateways. */
export const toMinorUnits = (m: Money): number =>
  Math.round((m.amount + Number.EPSILON) * 100);

export const isZero = (m: Money): boolean => m.amount === 0;
export const isNegative = (m: Money): boolean => m.amount < 0;
