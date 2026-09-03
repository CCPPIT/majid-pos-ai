import { InMemorySecureStorage } from '@/security/secure-storage/secure-storage';
import { SecureSessionSource } from '@/data/sources/session.source';

describe('registration auth flow (secure source)', () => {
  it('runs identifier → OTP → PIN → biometric → session', async () => {
    const secure = new InMemorySecureStorage();
    const source = new SecureSessionSource(secure);

    expect(await source.getSession()).toBeNull();

    const pending = await source.startRegistration('777123456', 'phone');
    expect(pending.issuedOtp).toMatch(/^\d{4}$/);
    expect(await source.getPendingRegistration()).not.toBeNull();

    // Correct issued OTP passes.
    expect(await source.verifyOtp(pending.issuedOtp)).toBe(true);

    await source.setPin('2048');

    await source.setBiometricEnabled(true);
    await expect(source.getBiometricEnabled()).resolves.toBe(true);

    const session = await source.completeRegistration();
    expect(session.user.phone).toBe('+967777123456');
    expect(session.permissions).toContain('pos.sale.create');
    await expect(source.hasCredential()).resolves.toBe(true);

    // A new source over the SAME secure storage restores the session (persisted).
    const reloaded = new SecureSessionSource(secure);
    expect(await reloaded.getSession()).not.toBeNull();
    expect((await reloaded.getSession())?.user.phone).toBe('+967777123456');
  });

  it('rejects weak PINs', async () => {
    const source = new SecureSessionSource(new InMemorySecureStorage());
    await source.startRegistration('a@b.com', 'email');
    await expect(source.setPin('1234')).rejects.toThrow();
  });

  it('wrong OTP returns false', async () => {
    const source = new SecureSessionSource(new InMemorySecureStorage());
    const pending = await source.startRegistration('777123456', 'phone');
    const wrong = pending.issuedOtp === '0000' ? '1111' : '0000';
    await expect(source.verifyOtp(wrong)).resolves.toBe(false);
  });

  it('verifyPin unlocks with the correct PIN across a restored source', async () => {
    const secure = new InMemorySecureStorage();
    const source = new SecureSessionSource(secure);
    await source.startRegistration('777123456', 'phone');
    await source.setPin('2048');
    await source.completeRegistration();

    const restored = new SecureSessionSource(secure);
    expect(await restored.verifyPin('2048')).not.toBeNull();
    expect(await restored.verifyPin('0000')).toBeNull();
  });

  it('signs out and clears the persisted session', async () => {
    const secure = new InMemorySecureStorage();
    const source = new SecureSessionSource(secure);
    await source.startRegistration('777123456', 'phone');
    await source.setPin('2048');
    await source.completeRegistration();
    await source.signOut();

    expect(await source.getSession()).toBeNull();
    expect(await new SecureSessionSource(secure).getSession()).toBeNull();
  });
});
