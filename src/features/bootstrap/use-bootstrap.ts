/**
 * Bootstrap routing decision — PURE logic (unit-tested, no React).
 *
 * Flow (Section 17):
 *   Launch → Bootstrap → Onboarding? → Authentication? → Store Setup? → Main App
 */
import type { BootstrapState } from '@/domain/identity/types';

export type BootstrapRoute =
  | 'loading'
  | '/(onboarding)/welcome'
  | '/(auth)/sign-in'
  | '/(app)/store-setup'
  | '/(app)/(tabs)';

export const decideBootstrapRoute = (state: BootstrapState): BootstrapRoute => {
  if (!state.onboardingCompleted) return '/(onboarding)/welcome';
  if (!state.session) return '/(auth)/sign-in';
  if (!state.storeSetupCompleted) return '/(app)/store-setup';
  return '/(app)/(tabs)';
};
