import { decideBootstrapRoute } from '@/features/bootstrap/use-bootstrap';
import type { BootstrapState } from '@/domain/identity/types';

const base: BootstrapState = {
  onboardingCompleted: false,
  storeSetupCompleted: false,
  session: null,
};

const session = { token: 't', permissions: [], user: {} } as never;

describe('decideBootstrapRoute', () => {
  it('routes fresh users to onboarding', () => {
    expect(decideBootstrapRoute(base)).toBe('/(onboarding)/welcome');
  });

  it('routes onboarded-but-unauthenticated users to sign-in', () => {
    expect(decideBootstrapRoute({ ...base, onboardingCompleted: true })).toBe('/(auth)/sign-in');
  });

  it('routes authenticated users without a store to store setup', () => {
    expect(
      decideBootstrapRoute({ ...base, onboardingCompleted: true, session }),
    ).toBe('/(app)/store-setup');
  });

  it('routes fully-set-up users to the main tabs', () => {
    expect(
      decideBootstrapRoute({
        ...base,
        onboardingCompleted: true,
        storeSetupCompleted: true,
        session,
      }),
    ).toBe('/(app)/(tabs)');
  });
});
