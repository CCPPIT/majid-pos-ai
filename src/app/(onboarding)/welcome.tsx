/**
 * Onboarding (Section 18) — 8 animated slides.
 * Completing (Get started or Skip) persists the onboarding flag and continues
 * to sign-in. Theme/language toggles live on the flow header.
 */
import { useRouter } from 'expo-router';

import { useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeOnboarding } = useBootstrap();
  const { toggle } = useTheme();
  const { locale, switchLocale } = useTranslation();

  const handleComplete = async () => {
    await completeOnboarding();
    router.replace('/(auth)/sign-in');
  };

  return (
    <OnboardingFlow
      onComplete={handleComplete}
      onThemeToggle={toggle}
      onLanguageToggle={() => void switchLocale(locale === 'ar' ? 'en' : 'ar')}
    />
  );
}
