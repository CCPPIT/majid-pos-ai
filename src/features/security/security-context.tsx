/**
 * مزوّد الأمان وحالة القفل (PHASE 26).
 * يستمع لانتقالات التطبيق (مقدمة/خلفية)، ويطبّق سياسة القفل التلقائي النقية
 * من المجال: عند العودة للمقدمة بعد تجاوز المهلة (أو فورًا حسب الإعداد) يُقفل
 * التطبيق بشاشة تغطّي المحتوى. الفتح بـ PIN أو البصمة عبر مستودع الأمان.
 * المحتوى يبقى مركّبًا تحته (حالة محفوظة) لكن شاشة القفل تحجبه كاملةً.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { shouldLockOnForeground } from '@/domain/security-lock';
import type { SecuritySettings } from '@/domain/security-lock';
import { makeSecurityEntry, type AuditActor } from '@/domain/audit';
import { auditRepository } from '@/shared/container';
import { logger } from '@/core/logging/logger';
import type { SecurityRepository } from '@/data/repositories/security.repository';

// المنفّذ الافتراضي لأحداث الأمان (الجهاز نفسه؛ لا جلسة مميّزة في هذه الطبقة).
const DEVICE_ACTOR: AuditActor = { id: 'device', label: 'device' };

// ما يعرضه المزوّد.
interface SecurityContextValue {
  locked: boolean; // هل التطبيق مقفل حاليًا؟
  settings: SecuritySettings | null; // إعدادات الأمان.
  hasCredential: boolean; // هل يوجد PIN؟
  lock: () => void; // قفل يدوي.
  saveSettings: (settings: SecuritySettings) => Promise<void>; // حفظ الإعدادات.
  unlockWithPin: (pin: string) => Promise<boolean>; // فتح بـ PIN.
  unlockWithBiometric: (promptMessage: string) => Promise<boolean>; // فتح بالبصمة.
  reloadSettings: () => Promise<void>; // إعادة تحميل الإعدادات.
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function SecurityProvider({ repository, children }: { repository: SecurityRepository; children: React.ReactNode }) {
  const [locked, setLocked] = useState(false); // حالة القفل.
  const [settings, setSettings] = useState<SecuritySettings | null>(null); // الإعدادات.
  const [hasCredential, setHasCredential] = useState(false); // وجود PIN.
  const lastBackground = useRef<number | null>(null); // لحظة آخر خلفية.

  // تحميل الإعدادات وبيانات الاعتماد.
  const reloadSettings = useCallback(async () => {
    try {
      const [s, cred] = await Promise.all([repository.getSettings(), repository.hasCredential()]);
      setSettings(s);
      setHasCredential(cred);
    } catch (error) {
      logger.warn('Security settings load failed', { error: String(error) });
    }
  }, [repository]);

  // يسجّل حدث القفل في سجل التدقيق (يُستدعى من القفل اليدوي والتلقائي).
  const recordLockAudit = useCallback(() => {
    void auditRepository
      .record(makeSecurityEntry('app_locked', 'audit.entry.app_locked', 'security', DEVICE_ACTOR))
      .catch(() => undefined);
  }, []);

  // قفل يدوي.
  const lock = useCallback(() => {
    setHasCredential((cred) => {
      if (cred) {
        setLocked(true);
        recordLockAudit();
      }
      return cred;
    });
  }, [recordLockAudit]);

  // حفظ الإعدادات ثم تحديث الحالة.
  const saveSettings = useCallback(
    async (next: SecuritySettings): Promise<void> => {
      await repository.saveSettings(next);
      setSettings(next);
      // نسجّل تغيير إعدادات الأمان في سجل التدقيق.
      void auditRepository
        .record(makeSecurityEntry('security_settings_changed', 'audit.entry.security_settings_changed', 'security', DEVICE_ACTOR))
        .catch(() => undefined);
    },
    [repository],
  );

  // فتح بـ PIN (يسجّل النجاح في سجل التدقيق).
  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const result = await repository.unlockWithPin(pin);
      if (result.ok) {
        setLocked(false);
        lastBackground.current = null;
        void auditRepository
          .record(makeSecurityEntry('app_unlocked', 'audit.entry.app_unlocked', 'security', DEVICE_ACTOR, { method: 'pin' }))
          .catch(() => undefined);
        return true;
      }
      return false;
    },
    [repository],
  );

  // فتح بالبصمة (يسجّل النجاح في سجل التدقيق).
  const unlockWithBiometric = useCallback(
    async (promptMessage: string): Promise<boolean> => {
      const result = await repository.unlockWithBiometric(promptMessage);
      if (result.ok) {
        setLocked(false);
        lastBackground.current = null;
        void auditRepository
          .record(makeSecurityEntry('app_unlocked', 'audit.entry.app_unlocked', 'security', DEVICE_ACTOR, { method: 'biometric' }))
          .catch(() => undefined);
        return true;
      }
      return false;
    },
    [repository],
  );

  // تحميل أولي للإعدادات.
  useEffect(() => {
    Promise.resolve().then(() => reloadSettings()).catch(() => undefined);
  }, [reloadSettings]);

  // مستمع حالة التطبيق (قفل تلقائي).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        // ذهاب للخلفية: نسجّل اللحظة ونقفل فورًا إن كان الإعداد فوريًا.
        lastBackground.current = Date.now();
        if (settings?.autoLockEnabled && settings.lockTimeout === 'immediate' && hasCredential) {
          setLocked(true);
          recordLockAudit();
        }
      } else if (next === 'active') {
        // عودة للمقدمة: نطبّق قرار القفل النقي من المجال.
        if (!settings || !hasCredential) return;
        const shouldLock = shouldLockOnForeground({
          settings,
          hasCredential,
          lastBackgroundAt: lastBackground.current,
          now: Date.now(),
        });
        if (shouldLock) {
          setLocked(true);
          recordLockAudit();
        }
      }
    });
    return () => subscription.remove();
  }, [settings, hasCredential, recordLockAudit]);

  const value = useMemo<SecurityContextValue>(
    () => ({ locked, settings, hasCredential, lock, saveSettings, unlockWithPin, unlockWithBiometric, reloadSettings }),
    [locked, settings, hasCredential, lock, saveSettings, unlockWithPin, unlockWithBiometric, reloadSettings],
  );

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

// خطاف الوصول لسياق الأمان (قيم آمنة خارج المزوّد).
export function useSecurity(): SecurityContextValue {
  const ctx = useContext(SecurityContext);
  if (!ctx) {
    return {
      locked: false,
      settings: null,
      hasCredential: false,
      lock: () => undefined,
      saveSettings: async () => undefined,
      unlockWithPin: async () => false,
      unlockWithBiometric: async () => false,
      reloadSettings: async () => undefined,
    };
  }
  return ctx;
}
