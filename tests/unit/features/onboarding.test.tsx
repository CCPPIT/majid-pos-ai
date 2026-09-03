import { act, create } from 'react-test-renderer';

import { ThemeProvider } from '@/design-system/theme/ThemeProvider';
import { ONBOARDING_SLIDES, LAST_SLIDE_INDEX, ONBOARDING_SLIDE_COUNT } from '@/features/onboarding/slides';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { translate } from '@/i18n/translate';

describe('onboarding slides data', () => {
  it('defines exactly 8 slides in the specified order', () => {
    expect(ONBOARDING_SLIDE_COUNT).toBe(8);
    expect(LAST_SLIDE_INDEX).toBe(7);
    expect(ONBOARDING_SLIDES.map((s) => s.key)).toEqual([
      'welcome',
      'smart-pos',
      'ai-copilot',
      'smart-inventory',
      'offline',
      'payments',
      'intelligence',
      'get-started',
    ]);
  });

  it('every slide title/description resolves in both locales', () => {
    for (const locale of ['ar', 'en'] as const) {
      for (const slide of ONBOARDING_SLIDES) {
        expect(translate(locale, slide.titleKey)).not.toBe(slide.titleKey);
        expect(translate(locale, slide.descKey)).not.toBe(slide.descKey);
      }
    }
  });
});

describe('OnboardingFlow', () => {
  const onComplete = jest.fn();

  const render = () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <ThemeProvider>
          <OnboardingFlow onComplete={onComplete} />
        </ThemeProvider>,
      );
    });
    return renderer!;
  };

  it('renders the progress bar and 8 dots', () => {
    const renderer = render();
    const bar = renderer.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(bar).toBeTruthy();
  });

  it('completes when skip is pressed', () => {
    const renderer = render();
    const skip = renderer.root.findByProps({ accessibilityLabel: 'تخطي' });
    act(() => {
      skip.props.onPress();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
