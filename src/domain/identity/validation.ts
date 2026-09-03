/**
 * Identity domain — validation rules (Section 57).
 * Pure, testable validation for identifiers, OTP and PIN. No UI, no storage.
 */
import { ValidationError } from '@/core/errors/AppError';

/** Yemen phone numbers: +967 then 9 digits (mobile starts 7), or local 7/9-digit. */
const YE_PHONE = /^(?:\+?967?0?|0)?7\d{8}$/;
/** International-ish phone: optional + then 7–15 digits. */
const INTL_PHONE = /^\+?[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_DIGITS = /^\d{4}$/;
const PIN_DIGITS = /^\d{4}$/;

export const OTP_LENGTH = 4;
export const PIN_LENGTH = 4;

export type IdentifierType = 'phone' | 'email' | 'unknown';

export const detectIdentifier = (value: string): IdentifierType => {
  const trimmed = value.trim();
  if (EMAIL.test(trimmed)) return 'email';
  if (YE_PHONE.test(trimmed.replace(/[\s-]/g, '')) || INTL_PHONE.test(trimmed.replace(/[\s-]/g, ''))) {
    return 'phone';
  }
  return 'unknown';
};

export const isValidPhone = (value: string): boolean => {
  const digits = value.trim().replace(/[\s-]/g, '');
  return YE_PHONE.test(digits) || INTL_PHONE.test(digits);
};

export const isValidEmail = (value: string): boolean => EMAIL.test(value.trim());

export const isValidIdentifier = (value: string): boolean => detectIdentifier(value) !== 'unknown';

export const isValidOtp = (code: string): boolean => OTP_DIGITS.test(code.trim());

export const isValidPin = (pin: string): boolean => PIN_DIGITS.test(pin);

/** A PIN must not be trivially sequential/repeated (light client-side rule). */
export const isWeakPin = (pin: string): boolean => {
  if (!PIN_DIGITS.test(pin)) return true;
  if (/^(\d)\1{3}$/.test(pin)) return true; // 0000, 1111…
  const ascending = '0123456789';
  const descending = '9876543210';
  return ascending.includes(pin) || descending.includes(pin); // 1234, 4321…
};

/** Normalize a phone identifier to E.164-ish storage form. */
export const normalizePhone = (value: string): string => {
  const digits = value.trim().replace(/[\s-]/g, '').replace(/^0+/, '');
  if (digits.startsWith('967')) return `+${digits}`;
  return `+967${digits}`;
};

/** Assertion form that throws a typed ValidationError (for use-cases). */
export const assertIdentifier = (value: string): IdentifierType => {
  const type = detectIdentifier(value);
  if (type === 'unknown') {
    throw new ValidationError('ENTER_VALID_PHONE_OR_EMAIL', {
      identifier: value,
    });
  }
  return type;
};
