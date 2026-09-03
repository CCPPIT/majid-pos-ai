/**
 * Typed in-process domain event bus (Section 55).
 *
 * Domains communicate through events (SaleCreated, PaymentCompleted,
 * StockUpdated ...) instead of importing each other directly. This keeps
 * bounded contexts decoupled and makes future API/backend integration and
 * cross-domain sync (offline queue) straightforward.
 *
 * Payloads are typed as `unknown` in Phase 01; each bounded context will
 * define its own event payload types when implemented.
 */

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly occurredAt: string;
  readonly eventId: string;
}

export type EventHandler<TPayload> = (event: DomainEvent<string, TPayload>) => void;

/** Canonical cross-domain event names (Section 55). */
export const DOMAIN_EVENTS = {
  SALE_CREATED: 'sale.created',
  PAYMENT_COMPLETED: 'payment.completed',
  STOCK_UPDATED: 'stock.updated',
  PRODUCT_CREATED: 'product.created',
  CUSTOMER_CREATED: 'customer.created',
  PURCHASE_ORDER_CREATED: 'purchase-order.created',
  EXPENSE_CREATED: 'expense.created',
  EMPLOYEE_CREATED: 'employee.created',
  /** Offline-sync lifecycle (Section 37). */
  SYNC_QUEUED: 'sync.queued',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',
  CONNECTIVITY_CHANGED: 'connectivity.changed',
  /** Audit trail (PHASE 27). */
  AUDIT_RECORDED: 'audit.recorded',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/**
 * Application event map. Event payload contracts are declared here as each
 * domain is implemented. Today all payloads are `unknown` (handlers validate).
 * Mapped type (not interface) so it satisfies `Record<string, unknown>`.
 */
export type AppEventMap = {
  [K in DomainEventName]: unknown;
};

const createEventId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class EventBus<TEvents extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set<EventHandler<unknown>>();
    set.add(handler as EventHandler<unknown>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  /** Subscribe once — handler is removed after the first event. */
  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const wrapper: EventHandler<TEvents[K]> = (e) => {
      this.off(event, wrapper);
      handler(e);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const domainEvent: DomainEvent<string, TEvents[K]> = {
      type: event as string,
      payload,
      occurredAt: new Date().toISOString(),
      eventId: createEventId(),
    };
    for (const handler of this.handlers.get(event) ?? []) {
      handler(domainEvent as DomainEvent<string, unknown>);
    }
  }

  /** Remove all listeners (used on logout / teardown). */
  clear(): void {
    this.handlers.clear();
  }
}

/** App-wide singleton bus. */
export const appEventBus = new EventBus<AppEventMap>();
