/**
 * Core domain primitives shared across all bounded contexts.
 * PHASE 01 — Mobile Foundation.
 *
 * These types encode the multi-tenant SaaS model (Section 16) and the
 * canonical async UI states (Section 49 — Error System).
 */

/** Nominal/branded type — makes primitive identifiers type-safe at compile time. */
export type Brand<T, B> = T & { readonly __brand: B };

/** Globally unique entity identifier. */
export type ID = Brand<string, 'ID'>;

/** ISO-8601 date-time string, e.g. `2026-08-28T10:30:00.000Z`. */
export type ISODateString = string;

/** Cast a raw string into a branded ID at system boundaries. */
export const asId = (value: string): ID => value as ID;

/**
 * Multi-tenant scoping context (Section 16).
 * Every business entity can be linked to tenant / organization / branch / store.
 */
export interface ScopeContext {
  tenantId?: ID;
  organizationId?: ID;
  branchId?: ID;
  storeId?: ID;
}

export interface TenantScoped {
  tenantId: ID;
  organizationId?: ID;
  branchId?: ID;
  storeId?: ID;
}

export interface Auditable {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy?: ID;
  updatedBy?: ID;
}

/** Base persistence shape for every business entity in the system. */
export interface BaseEntity extends TenantScoped, Auditable {
  id: ID;
}

/**
 * Canonical async UI states (Section 49).
 * Every feature screen MUST render one of these states — never a white screen.
 */
export type DataStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty' | 'offline';

export interface AsyncState<T> {
  status: DataStatus;
  data: T | null;
  error: string | null;
}

export const initialAsyncState = <T,>(): AsyncState<T> => ({
  status: 'idle',
  data: null,
  error: null,
});

export const loadingState = <T,>(previous?: T | null): AsyncState<T> => ({
  status: 'loading',
  data: previous ?? null,
  error: null,
});

export const successState = <T,>(data: T): AsyncState<T> => ({
  status: data == null ? 'empty' : 'success',
  data,
  error: null,
});

export const errorState = <T,>(error: string, previous?: T | null): AsyncState<T> => ({
  status: 'error',
  data: previous ?? null,
  error,
});

export const offlineState = <T,>(previous?: T | null): AsyncState<T> => ({
  status: 'offline',
  data: previous ?? null,
  error: null,
});
