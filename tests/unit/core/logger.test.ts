import { redact } from '@/core/logging/logger';

describe('logger redaction', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      username: 'majid',
      password: 'secret123',
      session: {
        token: 'abc',
        pin: '1234',
        user: { cardNumber: '4111111111111111', cvv: '999', name: 'Ali' },
      },
      nestedList: [{ otp: '0000' }, { ok: true }],
    };

    const safe = redact(input);

    expect(safe.password).toBe('[REDACTED]');
    expect(safe.session.token).toBe('[REDACTED]');
    expect(safe.session.pin).toBe('[REDACTED]');
    expect(safe.session.user.cardNumber).toBe('[REDACTED]');
    expect(safe.session.user.cvv).toBe('[REDACTED]');
    expect(safe.session.user.name).toBe('Ali');
    expect(safe.username).toBe('majid');
    expect(safe.nestedList[0]!.otp).toBe('[REDACTED]');
    expect(safe.nestedList[1]!.ok).toBe(true);
  });
});
