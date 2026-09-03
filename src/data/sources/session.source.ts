/**
 * Session data source — boundary over identity storage.
 *
 * `SecureSessionSource` (PHASE 06) persists session / PIN hash / biometric in
 * platform secure storage and simulates OTP issuance/verification locally
 * (no backend yet). `InMemorySessionSource` mirrors the contract for tests.
 * When a real auth API arrives, only this source changes (Section 38).
 */
import * as Crypto from 'expo-crypto';

import { STORAGE_KEYS } from '@/core/config/constants';
import { asId } from '@/core/types/domain';
import { logger } from '@/core/logging/logger';
import {
  isWeakPin,
  normalizePhone,
  PIN_LENGTH,
  type IdentifierType,
} from '@/domain/identity/validation';
import type { PendingRegistration } from '@/domain/identity/registration';
import type { Session, User } from '@/domain/identity/types';
import type { SecureStorage } from '@/security/secure-storage/secure-storage';
// نستمد صلاحيات الكاشير من فهرس أدوار RBAC (مصدر واحد للصلاحيات).
import { collectPermissions, getRoleByCode } from '@/domain/security';

export interface SessionSource {
  getSession(): Promise<Session | null>;
  signOut(): Promise<void>;

  /** Register a session directly (used by the mock/dev entry). */
  signInMock(): Promise<Session>;

  // ── Real auth flow (no backend; OTP simulated) ──
  /** Begin registration/sign-in for an identifier; issues a demo OTP. */
  startRegistration(identifier: string, type: IdentifierType): Promise<PendingRegistration>;
  getPendingRegistration(): Promise<PendingRegistration | null>;
  /** Verify the entered OTP against the issued demo code. */
  verifyOtp(code: string): Promise<boolean>;
  /** Store a hashed PIN for the current registration (throws on weak PIN). */
  setPin(pin: string): Promise<void>;
  hasCredential(): Promise<boolean>;
  setBiometricEnabled(enabled: boolean): Promise<void>;
  getBiometricEnabled(): Promise<boolean>;
  /** Create + persist a session after registration completes. */
  completeRegistration(displayName?: string): Promise<Session>;
}

const nowIso = (): string => new Date().toISOString();
const hoursFromNowIso = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const demoOtp = (): string =>
  String(Math.floor(1000 + Math.random() * 9000));

const buildUser = (identifier: string, type: IdentifierType): User => {
  const phone = type === 'phone' ? normalizePhone(identifier) : undefined;
  const email = type === 'email' ? identifier.trim().toLowerCase() : undefined;
  const label = phone ?? email ?? identifier;
  return {
    id: asId(`user-${Crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`),
    fullName: phone ? phone : email ? email.split('@')[0] ?? label : label,
    phone,
    email,
    roleId: asId('role-cashier'), // default role; real assignment in PHASE 07
    roleCode: 'cashier', // كود الدور في فهرس RBAC (لاشتقاق النطاق).
    roleName: 'كاشير',
    tenantId: asId('tenant-local'), // المستأجر المحلي التجريبي.
    organizationId: asId('org-local'), // المؤسسة.
    branchId: asId('branch-local'), // فرع افتراضي (يُحدد فعليًا من سياق المستأجر).
    storeId: asId('store-local'), // المتجر (يُحدد من مبدّل المتجر).
  };
};

// صلاحيات الكاشير تُشتق الآن من فهرس الأدوار الـ100 (دور 'cashier') بدل تكرارها.
const cashierRole = getRoleByCode('cashier');
const cashierPermissions = cashierRole ? collectPermissions([cashierRole]) : [];

class BaseSessionSource implements SessionSource {
  protected session: Session | null = null;
  protected pending: PendingRegistration | null = null;
  protected pinHash: string | null = null;
  protected biometricEnabled = false;
  protected registeredUser: User | null = null;

  async getSession(): Promise<Session | null> {
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
  }

  async signInMock(): Promise<Session> {
    this.session = {
      token: `mock-token-${Date.now()}`,
      issuedAt: nowIso(),
      expiresAt: hoursFromNowIso(12),
      permissions: [...cashierPermissions],
      user: {
        id: asId('user-mock-cashier-01'),
        fullName: 'ماجد (تجريبي)',
        phone: '+967 7XX XXX XXX',
        roleId: asId('role-cashier'),
        roleName: 'كاشير',
        tenantId: asId('tenant-mock'),
        organizationId: asId('org-mock'),
        branchId: asId('branch-mock'),
        storeId: asId('store-mock'),
      },
    };
    return this.session;
  }

  async startRegistration(identifier: string, type: IdentifierType): Promise<PendingRegistration> {
    const issuedOtp = demoOtp();
    this.pending = {
      identifier,
      identifierType: type,
      issuedOtp,
      issuedAt: nowIso(),
    };
    return this.pending;
  }

  async getPendingRegistration(): Promise<PendingRegistration | null> {
    return this.pending;
  }

  async verifyOtp(code: string): Promise<boolean> {
    if (!this.pending) return false;
    const ok = code.trim() === this.pending.issuedOtp;
    return ok;
  }

  async setPin(pin: string): Promise<void> {
    if (pin.length !== PIN_LENGTH || isWeakPin(pin)) {
      throw new Error('PIN_MUST_BE_4_STRONG_DIGITS');
    }
    this.pinHash = await this.hash(pin);
  }

  async hasCredential(): Promise<boolean> {
    return this.registeredUser !== null && this.pinHash !== null;
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    this.biometricEnabled = enabled;
  }

  async getBiometricEnabled(): Promise<boolean> {
    return this.biometricEnabled;
  }

  async completeRegistration(): Promise<Session> {
    if (!this.pending) throw new Error('NO_PENDING_REGISTRATION');
    if (!this.pinHash) throw new Error('PIN_NOT_SET');
    this.registeredUser = buildUser(this.pending.identifier, this.pending.identifierType);
    this.session = {
      token: `local-token-${Crypto.randomUUID?.() ?? Date.now()}`,
      issuedAt: nowIso(),
      expiresAt: hoursFromNowIso(720),
      permissions: [...cashierPermissions],
      user: this.registeredUser,
    };
    this.pending = null;
    return this.session;
  }

  protected async hash(pin: string): Promise<string> {
    // Subclasses provide salted SHA-256; in-memory tests use a light hash.
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `salt:${pin}`);
  }
}

/** In-memory source for tests/dev. */
export class InMemorySessionSource extends BaseSessionSource {}

/** Secure-storage-backed source used by the real app. */
export class SecureSessionSource extends BaseSessionSource {
  private salt: string | null = null;

  constructor(private readonly secure: SecureStorage) {
    super();
  }

  private async getSalt(): Promise<string> {
    if (this.salt) return this.salt;
    const existing = await this.secure.get(STORAGE_KEYS.pinSalt);
    if (existing) {
      this.salt = existing;
      return existing;
    }
    const generated = Crypto.randomUUID();
    this.salt = generated;
    await this.secure.set(STORAGE_KEYS.pinSalt, generated);
    return generated;
  }

  protected override async hash(pin: string): Promise<string> {
    const salt = await this.getSalt();
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
  }

  override async getSession(): Promise<Session | null> {
    const raw = await this.secure.get(STORAGE_KEYS.session);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch (error) {
      logger.warn('Corrupt session in secure storage', { error: String(error) });
      return null;
    }
  }

  override async signOut(): Promise<void> {
    await this.secure.remove(STORAGE_KEYS.session);
    this.session = null;
  }

  override async signInMock(): Promise<Session> {
    const session = await super.signInMock();
    await this.secure.set(STORAGE_KEYS.session, JSON.stringify(session));
    return session;
  }

  override async setPin(pin: string): Promise<void> {
    await super.setPin(pin);
    if (this.pinHash) await this.secure.set(STORAGE_KEYS.pinHash, this.pinHash);
  }

  override async setBiometricEnabled(enabled: boolean): Promise<void> {
    await super.setBiometricEnabled(enabled);
    await this.secure.set(STORAGE_KEYS.biometricEnabled, enabled ? 'true' : 'false');
  }

  override async getBiometricEnabled(): Promise<boolean> {
    const v = await this.secure.get(STORAGE_KEYS.biometricEnabled);
    return v === 'true';
  }

  override async completeRegistration(): Promise<Session> {
    const session = await super.completeRegistration();
    await this.secure.set(STORAGE_KEYS.session, JSON.stringify(session));
    return session;
  }

  async restoreCredential(): Promise<{ pinHash: string | null; biometric: boolean }> {
    const [pinHash, biometric] = await Promise.all([
      this.secure.get(STORAGE_KEYS.pinHash),
      this.getBiometricEnabled(),
    ]);
    this.pinHash = pinHash;
    return { pinHash, biometric };
  }

  /** Verify an entered PIN against the stored hash (returning unlock). */
  async verifyPin(pin: string): Promise<Session | null> {
    const { pinHash } = await this.restoreCredential();
    if (!pinHash) return null;
    const candidate = await this.hash(pin);
    if (candidate !== pinHash) return null;
    const session = await this.getSession();
    if (session) this.session = session;
    return session;
  }
}
