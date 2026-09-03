/**
 * Pending account registration — carried between auth screens before a
 * session exists (identifier → OTP → PIN). Held in memory/session source,
 * never in plain prefs; no secrets here (PIN hash lives in Secure Storage).
 */
import type { IdentifierType } from './validation';

export interface PendingRegistration {
  identifier: string;
  identifierType: IdentifierType;
  /** The demo OTP issued (PHASE 06 — no backend; real OTP arrives with auth API). */
  issuedOtp: string;
  /** ISO timestamp the code was issued (resend/expiry logic). */
  issuedAt: string;
}
