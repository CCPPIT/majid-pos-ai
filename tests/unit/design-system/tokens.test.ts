import { darkColors, lightColors, toneColors } from '@/design-system/tokens/colors';
import { fontSize, textVariants } from '@/design-system/tokens/typography';
import { radius, spacing, touch } from '@/design-system/tokens/spacing';
import { shadow } from '@/design-system/tokens/shadows';

describe('design tokens', () => {
  it('provides complete dark and light palettes with the same keys', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(darkColors.background).toBe('#0B0F14');
    expect(lightColors.background).toBe('#EEF2F7');
  });

  it('resolves tone color pairs for both palettes', () => {
    expect(toneColors(darkColors, 'danger').strong).toBe(darkColors.danger);
    expect(toneColors(lightColors, 'success').soft).toBe(lightColors.successSoft);
    expect(toneColors(lightColors, 'primary').strong).toBe(lightColors.primary);
  });

  it('uses a 4pt spacing scale and accessible touch targets', () => {
    expect(spacing.lg).toBe(16);
    expect(spacing['2xl']).toBe(24);
    expect(touch.minTarget).toBeGreaterThanOrEqual(44);
    expect(touch.minTargetLarge).toBeGreaterThanOrEqual(touch.minTarget);
    expect(radius.full).toBe(999);
  });

  it('exposes a consistent text variant scale', () => {
    expect(textVariants.heading.fontSize).toBe(fontSize.xl);
    expect(textVariants.metric.fontWeight).toBe('800');
    for (const variant of Object.values(textVariants)) {
      expect(variant.lineHeight).toBeGreaterThanOrEqual(variant.fontSize);
    }
  });

  it('returns elevation shadows including the brand glow', () => {
    const glow = shadow(darkColors, 'glow');
    expect(glow.elevation).toBeGreaterThan(0);
    expect(glow.shadowColor).toBe(darkColors.glow);
    expect(shadow(darkColors, 'none').elevation).toBe(0);
  });
});
