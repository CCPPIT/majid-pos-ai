/**
 * Result type — explicit, type-safe error handling for the domain layer.
 *
 * Use cases / repositories return `Result<T>` instead of throwing, so the UI
 * is forced to handle both success and failure (no uncaught crashes, no
 * white screens — Section 49).
 */
import { toAppError, type AppError } from '../errors/AppError';

export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Run a synchronous throwing function and capture the result. */
export const wrap = <T>(fn: () => T): Result<T> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(toAppError(error));
  }
};

/** Run an async throwing function and capture the result. */
export const wrapAsync = async <T>(fn: () => Promise<T>): Promise<Result<T>> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(toAppError(error));
  }
};

export const mapResult = <T, U>(result: Result<T>, map: (value: T) => U): Result<U> =>
  result.ok ? ok(map(result.value)) : result;

export const unwrapOr = <T>(result: Result<T>, fallback: T): T =>
  result.ok ? result.value : fallback;
