import { FLAG_KEYS, STORAGE_KEYS } from '@/core/config/constants';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';
import { InMemorySessionSource } from '@/data/sources/session.source';
import { AppPreferencesRepository } from '@/data/repositories/preferences.repository';
import { AppSessionRepository } from '@/data/repositories/session.repository';

describe('preferences repository', () => {
  it('defaults flags to false and persists updates', async () => {
    const repo = new AppPreferencesRepository(new InMemoryPreferencesSource());
    await expect(repo.isOnboardingCompleted()).resolves.toBe(false);
    await expect(repo.isStoreSetupCompleted()).resolves.toBe(false);

    await repo.setOnboardingCompleted();
    await repo.setStoreSetupCompleted();

    await expect(repo.isOnboardingCompleted()).resolves.toBe(true);
    await expect(repo.isStoreSetupCompleted()).resolves.toBe(true);
  });

  it('honors initial source values', async () => {
    const repo = new AppPreferencesRepository(
      new InMemoryPreferencesSource({ [FLAG_KEYS.onboardingCompleted]: true }),
    );
    await expect(repo.isOnboardingCompleted()).resolves.toBe(true);
  });

  it('persists and reads locale and theme preferences', async () => {
    const source = new InMemoryPreferencesSource({ [STORAGE_KEYS.locale]: 'en' });
    const repo = new AppPreferencesRepository(source);

    await expect(repo.getLocale()).resolves.toBe('en');
    await repo.setLocale('ar');
    await expect(repo.getLocale()).resolves.toBe('ar');

    await expect(repo.getThemePreference()).resolves.toBeNull();
    await repo.setThemePreference('dark');
    await expect(repo.getThemePreference()).resolves.toBe('dark');
  });
});

describe('session repository', () => {
  it('starts signed out, creates a mock cashier session, and signs out', async () => {
    const repo = new AppSessionRepository(new InMemorySessionSource());

    await expect(repo.getSession()).resolves.toBeNull();

    const session = await repo.signInMock();
    expect(session.user.roleName).toBe('كاشير');
    expect(session.permissions).toContain('pos.sale.create');
    expect(session.permissions).not.toContain('reports.view');
    await expect(repo.getSession()).resolves.toEqual(session);

    await repo.signOut();
    await expect(repo.getSession()).resolves.toBeNull();
  });
});
