/**
 * Session repository — boundary between identity data source and the app.
 * Passes through the real auth flow (PHASE 06). Consumers (screens,
 * bootstrap) use this interface; swapping the source for a real auth API
 * later touches no screen code.
 */
import type { Session } from '@/domain/identity/types';
import type { PendingRegistration } from '@/domain/identity/registration';
import type { IdentifierType } from '@/domain/identity/validation';
import type { SessionSource } from '../sources/session.source';

export interface SessionRepository {
  getSession(): Promise<Session | null>;
  signInMock(): Promise<Session>;
  signOut(): Promise<void>;

  startRegistration(identifier: string, type: IdentifierType): Promise<PendingRegistration>;
  getPendingRegistration(): Promise<PendingRegistration | null>;
  verifyOtp(code: string): Promise<boolean>;
  setPin(pin: string): Promise<void>;
  hasCredential(): Promise<boolean>;
  setBiometricEnabled(enabled: boolean): Promise<void>;
  getBiometricEnabled(): Promise<boolean>;
  completeRegistration(): Promise<Session>;
  verifyPin?(pin: string): Promise<Session | null>;
}

export class AppSessionRepository implements SessionRepository {
  constructor(private readonly source: SessionSource) {}

  getSession(): Promise<Session | null> {
    return this.source.getSession();
  }

  signInMock(): Promise<Session> {
    return this.source.signInMock();
  }

  signOut(): Promise<void> {
    return this.source.signOut();
  }

  startRegistration(identifier: string, type: IdentifierType): Promise<PendingRegistration> {
    return this.source.startRegistration(identifier, type);
  }

  getPendingRegistration(): Promise<PendingRegistration | null> {
    return this.source.getPendingRegistration();
  }

  verifyOtp(code: string): Promise<boolean> {
    return this.source.verifyOtp(code);
  }

  setPin(pin: string): Promise<void> {
    return this.source.setPin(pin);
  }

  hasCredential(): Promise<boolean> {
    return this.source.hasCredential();
  }

  setBiometricEnabled(enabled: boolean): Promise<void> {
    return this.source.setBiometricEnabled(enabled);
  }

  getBiometricEnabled(): Promise<boolean> {
    return this.source.getBiometricEnabled();
  }

  completeRegistration(): Promise<Session> {
    return this.source.completeRegistration();
  }

  // التحقق من PIN مقابل البصمة المخزّنة (PHASE 26 فتح القفل) — متاح في المصدر الآمن فقط.
  verifyPin(pin: string): Promise<Session | null> {
    const source = this.source as SessionSource & { verifyPin?: (p: string) => Promise<Session | null> };
    if (typeof source.verifyPin === 'function') {
      return source.verifyPin(pin);
    }
    // المصادر غير الآمنة (اختبارات/ذاكرة) لا تدعم فتح القفل.
    return Promise.resolve(null);
  }
}
