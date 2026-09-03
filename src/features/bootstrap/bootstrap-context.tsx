/**
 * Bootstrap provider — loads onboarding/store-setup/session state once and
 * exposes session + auth actions. Repositories are injected (mock → API).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { PreferencesRepository } from '@/data/repositories/preferences.repository';
import type { SessionRepository } from '@/data/repositories/session.repository';
import type { BootstrapState, Session } from '@/domain/identity/types';
import type { PendingRegistration } from '@/domain/identity/registration';
import type { IdentifierType } from '@/domain/identity/validation';
import { logger } from '@/core/logging/logger';
import { makeSecurityEntry } from '@/domain/audit';
import { auditRepository } from '@/shared/container';

export interface BootstrapContextValue {
  ready: boolean;
  state: BootstrapState;
  pendingRegistration: PendingRegistration | null;
  completeOnboarding: () => Promise<void>;
  completeStoreSetup: () => Promise<void>;
  /** DEV ONLY — fake session until a real backend replaces the source. */
  devSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  // Auth flow (PHASE 06)
  startAuthRegistration: (identifier: string, type: IdentifierType) => Promise<PendingRegistration>;
  verifyOtp: (code: string) => Promise<boolean>;
  resendOtp: () => Promise<PendingRegistration | null>;
  savePin: (pin: string) => Promise<void>;
  enableBiometric: (enabled: boolean) => Promise<void>;
  finishRegistration: () => Promise<Session>;
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  preferencesRepository: PreferencesRepository;
  sessionRepository: SessionRepository;
}

const INITIAL_STATE: BootstrapState = {
  onboardingCompleted: false,
  storeSetupCompleted: false,
  session: null,
};

export function BootstrapProvider({
  children,
  preferencesRepository,
  sessionRepository,
}: ProviderProps) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<BootstrapState>(INITIAL_STATE);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      preferencesRepository.isOnboardingCompleted(),
      preferencesRepository.isStoreSetupCompleted(),
      sessionRepository.getSession(),
    ])
      .then(([onboardingCompleted, storeSetupCompleted, session]) => {
        if (cancelled) return;
        setState({ onboardingCompleted, storeSetupCompleted, session });
        setReady(true);
      })
      .catch((error: unknown) => {
        logger.error('Bootstrap failed', { error: String(error) });
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preferencesRepository, sessionRepository]);

  const completeOnboarding = useCallback(async () => {
    await preferencesRepository.setOnboardingCompleted();
    setState((s) => ({ ...s, onboardingCompleted: true }));
  }, [preferencesRepository]);

  const completeStoreSetup = useCallback(async () => {
    await preferencesRepository.setStoreSetupCompleted();
    setState((s) => ({ ...s, storeSetupCompleted: true }));
  }, [preferencesRepository]);

  const devSignIn = useCallback(async () => {
    const session = await sessionRepository.signInMock();
    setState((s) => ({ ...s, session }));
  }, [sessionRepository]);

  const signOut = useCallback(async () => {
    // نسجّل الخروج في سجل التدقيق (PHASE 27) قبل مسح الجلسة.
    void auditRepository
      .record(makeSecurityEntry('session_signed_out', 'audit.entry.session_signed_out', 'security'))
      .catch(() => undefined);
    await sessionRepository.signOut();
    setPendingRegistration(null);
    setState((s) => ({ ...s, session: null }));
  }, [sessionRepository]);

  const startAuthRegistration = useCallback(
    async (identifier: string, type: IdentifierType) => {
      const pending = await sessionRepository.startRegistration(identifier, type);
      setPendingRegistration(pending);
      return pending;
    },
    [sessionRepository],
  );

  const verifyOtp = useCallback(
    async (code: string) => sessionRepository.verifyOtp(code),
    [sessionRepository],
  );

  const resendOtp = useCallback(async () => {
    if (!pendingRegistration) return null;
    const fresh = await sessionRepository.startRegistration(
      pendingRegistration.identifier,
      pendingRegistration.identifierType,
    );
    setPendingRegistration(fresh);
    return fresh;
  }, [sessionRepository, pendingRegistration]);

  const savePin = useCallback(
    async (pin: string) => {
      await sessionRepository.setPin(pin);
    },
    [sessionRepository],
  );

  const enableBiometric = useCallback(
    async (enabled: boolean) => {
      await sessionRepository.setBiometricEnabled(enabled);
    },
    [sessionRepository],
  );

  const finishRegistration = useCallback(async () => {
    const session = await sessionRepository.completeRegistration();
    setPendingRegistration(null);
    setState((s) => ({ ...s, session }));
    return session;
  }, [sessionRepository]);

  const value = useMemo<BootstrapContextValue>(
    () => ({
      ready,
      state,
      pendingRegistration,
      completeOnboarding,
      completeStoreSetup,
      devSignIn,
      signOut,
      startAuthRegistration,
      verifyOtp,
      resendOtp,
      savePin,
      enableBiometric,
      finishRegistration,
    }),
    [
      ready,
      state,
      pendingRegistration,
      completeOnboarding,
      completeStoreSetup,
      devSignIn,
      signOut,
      startAuthRegistration,
      verifyOtp,
      resendOtp,
      savePin,
      enableBiometric,
      finishRegistration,
    ],
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapContextValue {
  const ctx = useContext(BootstrapContext);
  if (!ctx) throw new Error('useBootstrap must be used within <BootstrapProvider>');
  return ctx;
}
