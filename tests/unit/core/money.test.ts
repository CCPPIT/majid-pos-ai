import {
  addMoney,
  isZero,
  money,
  multiplyMoney,
  percentageOf,
  roundMoney,
  subtractMoney,
  sumMoney,
  toMinorUnits,
} from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';

describe('money', () => {
  it('rounds float artifacts to 2 decimal places', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it('creates normalized money values', () => {
    expect(money(10.999, 'YER')).toEqual({ amount: 11, currency: 'YER' });
  });

  it('rejects non-finite amounts', () => {
    expect(() => money(Number.NaN, 'YER')).toThrow(ValidationError);
    expect(() => money(Number.POSITIVE_INFINITY, 'YER')).toThrow(ValidationError);
  });

  it('adds and subtracts same-currency money', () => {
    const a = money(100.5, 'YER');
    const b = money(49.5, 'YER');
    expect(addMoney(a, b).amount).toBe(150);
    expect(subtractMoney(a, b).amount).toBe(51);
  });

  it('refuses cross-currency arithmetic', () => {
    expect(() => addMoney(money(1, 'YER'), money(1, 'USD'))).toThrow(ValidationError);
    expect(() => subtractMoney(money(1, 'YER'), money(1, 'SAR'))).toThrow(ValidationError);
  });

  it('multiplies price by quantity', () => {
    const price = money(19.99, 'YER');
    expect(multiplyMoney(price, 3).amount).toBe(59.97);
  });

  it('rejects invalid quantities', () => {
    expect(() => multiplyMoney(money(5, 'YER'), -1)).toThrow(ValidationError);
    expect(() => multiplyMoney(money(5, 'YER'), Number.NaN)).toThrow(ValidationError);
  });

  it('sums a list of money', () => {
    const total = sumMoney(
      [money(10, 'YER'), money(20.5, 'YER'), money(4.25, 'YER')],
      'YER',
    );
    expect(total.amount).toBe(34.75);
  });

  it('calculates tax / discount percentages', () => {
    const base = money(200, 'YER');
    expect(percentageOf(base, 15).amount).toBe(30); // 15% tax
    expect(percentageOf(base, 10).amount).toBe(20); // 10% discount
  });

  it('rejects out-of-range percentages', () => {
    expect(() => percentageOf(money(100, 'YER'), -5)).toThrow(ValidationError);
    expect(() => percentageOf(money(100, 'YER'), 101)).toThrow(ValidationError);
  });

  it('converts to minor units', () => {
    expect(toMinorUnits(money(19.99, 'USD'))).toBe(1999);
  });

  it('detects zero', () => {
    expect(isZero(money(0, 'YER'))).toBe(true);
  });
});
