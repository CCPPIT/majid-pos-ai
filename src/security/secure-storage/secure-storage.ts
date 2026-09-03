/**
 * Secure storage wrapper (Section 47).
 * Sensitive data (session, PIN hash, biometric flag) uses the platform
 * keystore/keychain via expo-secure-store. Non-secure contexts (web/tests)
 * degrade to an in-memory fallback so flows never crash.
 */
import * as SecureStore from 'expo-secure-store';

import { logger } from '@/core/logging/logger';

export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class ExpoSecureStorage implements SecureStorage {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, {
        requireAuthentication: false,
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (error) {
      logger.warn('Secure storage read failed', { key, error: String(error) });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (error) {
      logger.error('Secure storage write failed', { key, error: String(error) });
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.warn('Secure storage remove failed', { key, error: String(error) });
    }
  }
}

/** In-memory secure storage (tests / unsupported platforms). */
export class InMemorySecureStorage implements SecureStorage {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
}
