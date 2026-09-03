/** Elevation / shadow tokens (soft glow aesthetic, Section 44). */
import type { ColorPalette } from './colors';

export type Elevation = 'none' | 'sm' | 'md' | 'lg' | 'glow';

export const shadow = (colors: ColorPalette, elevation: Elevation) => {
  switch (elevation) {
    case 'sm':
      return {
        shadowColor: colors.shadow,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      };
    case 'md':
      return {
        shadowColor: colors.shadow,
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      };
    case 'lg':
      return {
        shadowColor: colors.shadow,
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
      };
    case 'glow':
      return {
        shadowColor: colors.glow,
        shadowOpacity: 0.9,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      };
    case 'none':
    default:
      return {
        shadowColor: colors.shadow,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      };
  }
};
