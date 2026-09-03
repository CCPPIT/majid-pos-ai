/**
 * Structured application error hierarchy.
 *
 * The domain layer never throws raw `Error`: it throws (or returns, via Result)
 * typed AppError subclasses. The UI layer maps them to localized messages and
 * to the canonical Loading / Success / Error / Empty / Offline states.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'UNKNOWN';

export interface AppErrorOptions {
  /** Machine-readable context, safe for logging and audit trails. */
  details?: Record<string, unknown>;
  /** Whether the failed action can be retried (drives the Retry UI). */
  retryable?: boolean;
  cause?: unknown;
}

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retryable: boolean;

  protected constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.details = options?.details ? Object.freeze({ ...options.details }) : undefined;
    this.retryable = options?.retryable ?? false;
  }
}

/** Invalid input — price, quantity, discount, tax, payment, forms (Section 57). */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly fields?: Readonly<Record<string, string>>;

  constructor(message = 'Validation failed', fields?: Record<string, string>) {
    super(message, { details: fields ? { fields } : undefined });
    this.fields = fields ? Object.freeze({ ...fields }) : undefined;
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;

  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? `: ${id}` : ''}`, { details: { resource, id } });
  }
}

/** Raised when a user/role lacks a permission (RBAC — Sections 14/52). */
export class PermissionDeniedError extends AppError {
  readonly code = 'PERMISSION_DENIED' as const;

  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : 'Permission denied', {
      details: { permission },
    });
  }
}

export class AuthenticationRequiredError extends AppError {
  readonly code = 'AUTHENTICATION_REQUIRED' as const;

  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class NetworkError extends AppError {
  readonly code = 'NETWORK_ERROR' as const;

  constructor(message = 'Network request failed', cause?: unknown) {
    super(message, { retryable: true, cause });
  }
}

/** Device is offline — action should be queued locally (Section 37). */
export class OfflineError extends AppError {
  readonly code = 'OFFLINE' as const;

  constructor(message = 'Device is currently offline') {
    super(message, { retryable: true, details: { offline: true } });
  }
}

/** Data sync conflict between local mutation queue and server state. */
export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;

  constructor(message = 'Data conflict detected', details?: Record<string, unknown>) {
    super(message, { retryable: true, details });
  }
}

/** A business rule was violated (e.g. refund exceeds sale total). */
export class BusinessRuleViolationError extends AppError {
  readonly code = 'BUSINESS_RULE_VIOLATION' as const;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { details });
  }
}

/** Normalize any thrown value into a typed AppError. */
export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new BusinessRuleViolationError(error.message, { originalName: error.name });
  }
  return new BusinessRuleViolationError('Unknown error', { error: String(error) });
};
