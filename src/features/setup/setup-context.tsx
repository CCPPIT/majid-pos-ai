/**
 * مزود سياق الإعداد (Setup Context) — PHASE 09.
 * يغلّف مستودع الإعداد ويعرّض دالة الإتمام للمعالج.
 * المستودع يُحقن مرة واحدة في جذر التطبيق (Composition Root).
 */
import {
  createContext, // لإنشاء السياق.
  useCallback, // لتثبيت الدوال.
  useContext, // للقراءة من السياق.
  useMemo, // لحساب القيم المشتقة.
  type ReactNode, // نوع الأبناء.
} from 'react';

import { logger } from '@/core/logging/logger';
import type { BuiltTenancy } from '@/domain/setup/builder';
import type { StoreSetupProfile } from '@/domain/setup/types';
import type { SetupRepository } from '@/data/repositories/setup.repository';

// القيم التي يوفّرها السياق.
export interface SetupContextValue {
  // يحفظ ملف الإعداد المكتمل ويعيد الهرمية المبنية.
  submitProfile: (profile: StoreSetupProfile) => Promise<BuiltTenancy>;
}

// السياق نفسه (null خارج المزود).
const SetupContext = createContext<SetupContextValue | null>(null);

interface ProviderProps {
  children: ReactNode; // الشجرة.
  repository: SetupRepository; // مستودع الإعداد المحقون.
}

export function SetupProvider({ children, repository }: ProviderProps) {
  // دالة الإتمام: تحفظ الملف وتبني الهرمية.
  const submitProfile = useCallback(
    async (profile: StoreSetupProfile): Promise<BuiltTenancy> => {
      const built = await repository.submitProfile(profile); // حفظ + بناء.
      logger.info('Store setup completed', { store: String(built.activeStoreId) });
      return built;
    },
    [repository],
  );

  // نجمّع قيم السياق.
  const value = useMemo<SetupContextValue>(() => ({ submitProfile }), [submitProfile]);

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

// خطاف القراءة من السياق.
export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error('useSetup must be used within <SetupProvider>');
  return ctx;
}
