/**
 * اختبارات سياسة القفل التلقائي وسلامة الجهاز (PHASE 26).
 * تغطي المنطق النقي: قرار القفل حسب المهلة/الإعداد/بيانات الاعتماد، وتقرير
 * ثقة الجهاز من حقائق المنصة، ودمج الإعدادات المحفوظة مع الافتراضية.
 */
import {
  DEFAULT_SECURITY_SETTINGS,
  timeoutMs,
  shouldLockOnForeground,
  buildDeviceReport,
  normalizeSettings,
} from '@/domain/security-lock';
import type { SecuritySettings } from '@/domain/security-lock';

const MIN = 60 * 1000; // دقيقة بالميلي ثانية.
const now = 1_000_000_000_000; // لحظة مرجعية ثابتة.

// إعدادات بمسار معين.
function settings(over: Partial<SecuritySettings> = {}): SecuritySettings {
  return { ...DEFAULT_SECURITY_SETTINGS, ...over };
}

describe('timeoutMs', () => {
  test('immediate is zero and minutes scale correctly', () => {
    expect(timeoutMs('immediate')).toBe(0);
    expect(timeoutMs(1)).toBe(MIN);
    expect(timeoutMs(15)).toBe(15 * MIN);
    expect(timeoutMs(60)).toBe(60 * MIN);
  });
});

describe('shouldLockOnForeground', () => {
  test('does not lock without a credential', () => {
    const lock = shouldLockOnForeground({
      settings: settings(), hasCredential: false, lastBackgroundAt: now - 10 * MIN, now,
    });
    expect(lock).toBe(false);
  });

  test('does not lock when auto-lock disabled', () => {
    const lock = shouldLockOnForeground({
      settings: settings({ autoLockEnabled: false }), hasCredential: true, lastBackgroundAt: now - 10 * MIN, now,
    });
    expect(lock).toBe(false);
  });

  test('does not lock if never backgrounded', () => {
    const lock = shouldLockOnForeground({
      settings: settings(), hasCredential: true, lastBackgroundAt: null, now,
    });
    expect(lock).toBe(false);
  });

  test('immediate locks on any backgrounding', () => {
    const lock = shouldLockOnForeground({
      settings: settings({ lockTimeout: 'immediate' }), hasCredential: true, lastBackgroundAt: now - 1, now,
    });
    expect(lock).toBe(true);
  });

  test('locks after timeout elapses', () => {
    const lock = shouldLockOnForeground({
      settings: settings({ lockTimeout: 5 }), hasCredential: true, lastBackgroundAt: now - 6 * MIN, now,
    });
    expect(lock).toBe(true);
  });

  test('stays unlocked within timeout window', () => {
    const lock = shouldLockOnForeground({
      settings: settings({ lockTimeout: 5 }), hasCredential: true, lastBackgroundAt: now - 2 * MIN, now,
    });
    expect(lock).toBe(false);
  });
});

describe('buildDeviceReport', () => {
  test('real device with enrolled biometric → high, no warnings', () => {
    const r = buildDeviceReport({ isDevice: true, hasBiometricHardware: true, biometricEnrolled: true, biometricKind: 'fingerprint' });
    expect(r.trustLevel).toBe('high');
    expect(r.warnings).toHaveLength(0);
  });

  test('real device with hardware but no enrollment → medium with warning', () => {
    const r = buildDeviceReport({ isDevice: true, hasBiometricHardware: true, biometricEnrolled: false, biometricKind: 'none' });
    expect(r.trustLevel).toBe('medium');
    expect(r.warnings).toContain('security.deviceWarningNoEnroll');
  });

  test('real device with no biometric hardware → medium', () => {
    const r = buildDeviceReport({ isDevice: true, hasBiometricHardware: false, biometricEnrolled: false, biometricKind: 'none' });
    expect(r.trustLevel).toBe('medium');
    expect(r.warnings).toContain('security.deviceWarningNoHardware');
  });

  test('emulator/non-device → low', () => {
    const r = buildDeviceReport({ isDevice: false, hasBiometricHardware: false, biometricEnrolled: false, biometricKind: 'none' });
    expect(r.trustLevel).toBe('low');
    expect(r.warnings).toContain('security.deviceWarningEmulator');
  });
});

describe('normalizeSettings', () => {
  test('null returns defaults', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SECURITY_SETTINGS);
  });

  test('partial settings are filled with defaults', () => {
    const s = normalizeSettings({ autoLockEnabled: false });
    expect(s.autoLockEnabled).toBe(false);
    expect(s.lockTimeout).toBe(DEFAULT_SECURITY_SETTINGS.lockTimeout);
    expect(s.biometricUnlockEnabled).toBe(DEFAULT_SECURITY_SETTINGS.biometricUnlockEnabled);
  });
});
