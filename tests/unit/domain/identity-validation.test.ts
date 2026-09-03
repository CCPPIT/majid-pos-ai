import {
  detectIdentifier,
  isWeakPin,
  isValidOtp,
  isValidPin,
  isValidPhone,
  normalizePhone,
} from '@/domain/identity/validation';

describe('identifier validation', () => {
  it('detects Yemeni phone numbers', () => {
    expect(isValidPhone('777123456')).toBe(true);
    expect(isValidPhone('+967777123456')).toBe(true);
    expect(isValidPhone('0777123456')).toBe(true);
    expect(detectIdentifier('777123456')).toBe('phone');
  });

  it('detects emails', () => {
    expect(detectIdentifier('majid@example.com')).toBe('email');
    expect(detectIdentifier('a.b+tag@store.ye')).toBe('email');
  });

  it('rejects invalid identifiers', () => {
    expect(detectIdentifier('abc')).toBe('unknown');
    expect(detectIdentifier('12')).toBe('unknown');
  });

  it('normalizes Yemeni numbers to E.164-ish +967', () => {
    expect(normalizePhone('0777123456')).toBe('+967777123456');
    expect(normalizePhone('777123456')).toBe('+967777123456');
  });
});

describe('OTP and PIN', () => {
  it('validates 4-digit OTP', () => {
    expect(isValidOtp('1234')).toBe(true);
    expect(isValidOtp('12')).toBe(false);
    expect(isValidOtp('12a4')).toBe(false);
  });

  it('validates 4-digit PIN', () => {
    expect(isValidPin('2048')).toBe(true);
    expect(isValidPin('204')).toBe(false);
  });

  it('flags weak PINs (repeats / sequences)', () => {
    expect(isWeakPin('0000')).toBe(true);
    expect(isWeakPin('1111')).toBe(true);
    expect(isWeakPin('1234')).toBe(true);
    expect(isWeakPin('4321')).toBe(true);
    expect(isWeakPin('2048')).toBe(false);
  });
});
