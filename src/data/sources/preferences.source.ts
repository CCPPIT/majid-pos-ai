/**
 * Preferences source — non-sensitive flags/values persisted on device.
 * Uses AsyncStorage today; the interface stays identical when swapped for a
 * synced/preferences API later (Section 38).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/core/logging/logger';

export interface PreferencesSource {
  getFlag(key: string): Promise<boolean>;
  setFlag(key: string, value: boolean): Promise<void>;
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

export class AsyncStoragePreferencesSource implements PreferencesSource {
  async getFlag(key: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw === 'true';
    } catch (error) {
      logger.warn('Failed to read preference flag', { key, error: String(error) });
      return false;
    }
  }

  async setFlag(key: string, value: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value ? 'true' : 'false');
    } catch (error) {
      logger.error('Failed to write preference flag', { key, error: String(error) });
      throw error;
    }
  }

  async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      logger.warn('Failed to read preference string', { key, error: String(error) });
      return null;
    }
  }

  async setString(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logger.error('Failed to write preference string', { key, error: String(error) });
      throw error;
    }
  }
}

/** In-memory source for tests (no native modules). */
export class InMemoryPreferencesSource implements PreferencesSource {
  private store = new Map<string, string>();

  constructor(initial?: Record<string, string | boolean>) {
    if (initial) {
      Object.entries(initial).forEach(([k, v]) =>
        this.store.set(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : v),
      );
    }
  }

  async getFlag(key: string): Promise<boolean> {
    return this.store.get(key) === 'true';
  }

  async setFlag(key: string, value: boolean): Promise<void> {
    this.store.set(key, value ? 'true' : 'false');
  }

  async getString(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  async setString(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}
