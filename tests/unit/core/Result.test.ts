import { err, mapResult, ok, unwrapOr, wrap, wrapAsync } from '@/core/result/Result';
import { ValidationError, toAppError } from '@/core/errors/AppError';

describe('Result', () => {
  it('creates ok results', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('creates error results', () => {
    const error = new ValidationError('bad input');
    const result = err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('wraps synchronous throwing functions', () => {
    const success = wrap(() => 1 + 1);
    const failure = wrap(() => {
      throw new ValidationError('nope');
    });

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error).toBeInstanceOf(ValidationError);
  });

  it('wraps async throwing functions', async () => {
    const success = await wrapAsync(async () => 'done');
    const failure = await wrapAsync(async () => {
      throw new Error('boom');
    });

    expect(success.ok).toBe(true);
    const normalized = toAppError(new Error('boom'));
    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error.code).toBe(normalized.code);
  });

  it('maps over success values', () => {
    const mapped = mapResult(ok(2), (n) => n * 10);
    if (mapped.ok) expect(mapped.value).toBe(20);

    const skipped = mapResult(err(new ValidationError('x')), () => 'never');
    expect(skipped.ok).toBe(false);
  });

  it('unwraps with fallback', () => {
    expect(unwrapOr(ok('real'), 'fallback')).toBe('real');
    expect(unwrapOr(err(new ValidationError('x')), 'fallback')).toBe('fallback');
  });
});
