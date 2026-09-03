/**
 * Onboarding slides (Section 18) — the 8 screens.
 * Content is referenced by i18n key; presentation (icon/accent) is static.
 */
import type { Tone } from '@/design-system/tokens/colors';

export interface OnboardingSlide {
  key:
    | 'welcome'
    | 'smart-pos'
    | 'ai-copilot'
    | 'smart-inventory'
    | 'offline'
    | 'payments'
    | 'intelligence'
    | 'get-started';
  icon: string;
  tone: Tone;
  titleKey: string;
  descKey: string;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: 'welcome',
    icon: 'sparkles',
    tone: 'primary',
    titleKey: 'onboarding.title',
    descKey: 'onboarding.description',
  },
  {
    key: 'smart-pos',
    icon: 'cart',
    tone: 'info',
    titleKey: 'onboarding.smartPos.title',
    descKey: 'onboarding.smartPos.desc',
  },
  {
    key: 'ai-copilot',
    icon: 'chatbubbles',
    tone: 'primary',
    titleKey: 'onboarding.aiCopilot.title',
    descKey: 'onboarding.aiCopilot.desc',
  },
  {
    key: 'smart-inventory',
    icon: 'cube',
    tone: 'success',
    titleKey: 'onboarding.smartInventory.title',
    descKey: 'onboarding.smartInventory.desc',
  },
  {
    key: 'offline',
    icon: 'cloud-offline',
    tone: 'warning',
    titleKey: 'onboarding.offline.title',
    descKey: 'onboarding.offline.desc',
  },
  {
    key: 'payments',
    icon: 'wallet',
    tone: 'success',
    titleKey: 'onboarding.payments.title',
    descKey: 'onboarding.payments.desc',
  },
  {
    key: 'intelligence',
    icon: 'bar-chart',
    tone: 'info',
    titleKey: 'onboarding.intelligence.title',
    descKey: 'onboarding.intelligence.desc',
  },
  {
    key: 'get-started',
    icon: 'rocket',
    tone: 'primary',
    titleKey: 'onboarding.getStarted.title',
    descKey: 'onboarding.getStarted.desc',
  },
];

export const ONBOARDING_SLIDE_COUNT = ONBOARDING_SLIDES.length;
export const LAST_SLIDE_INDEX = ONBOARDING_SLIDE_COUNT - 1;
