import { DOMAIN_EVENTS, EventBus } from '@/core/events/EventBus';

interface TestEvents extends Record<string, unknown> {
  'sale.created': { total: number };
  'sync.failed': { reason: string };
}

describe('EventBus', () => {
  it('delivers events to subscribed handlers', () => {
    const bus = new EventBus<TestEvents>();
    const handler = jest.fn();

    bus.on(DOMAIN_EVENTS.SALE_CREATED as unknown as 'sale.created', handler);
    bus.emit('sale.created', { total: 1500 });

    expect(handler).toHaveBeenCalledTimes(1);
    const [event] = handler.mock.calls[0];
    expect(event.payload).toEqual({ total: 1500 });
    expect(event.type).toBe('sale.created');
    expect(typeof event.eventId).toBe('string');
    expect(typeof event.occurredAt).toBe('string');
  });

  it('unsubscribes via the returned function', () => {
    const bus = new EventBus<TestEvents>();
    const handler = jest.fn();

    const unsubscribe = bus.on('sale.created', handler);
    unsubscribe();
    bus.emit('sale.created', { total: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports once subscriptions', () => {
    const bus = new EventBus<TestEvents>();
    const handler = jest.fn();

    bus.once('sync.failed', handler);
    bus.emit('sync.failed', { reason: 'offline' });
    bus.emit('sync.failed', { reason: 'conflict' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates handlers by event name', () => {
    const bus = new EventBus<TestEvents>();
    const saleHandler = jest.fn();
    const syncHandler = jest.fn();

    bus.on('sale.created', saleHandler);
    bus.on('sync.failed', syncHandler);
    bus.emit('sale.created', { total: 99 });

    expect(saleHandler).toHaveBeenCalledTimes(1);
    expect(syncHandler).not.toHaveBeenCalled();
  });

  it('clears all listeners', () => {
    const bus = new EventBus<TestEvents>();
    const handler = jest.fn();

    bus.on('sale.created', handler);
    bus.clear();
    bus.emit('sale.created', { total: 1 });

    expect(handler).not.toHaveBeenCalled();
  });
});
