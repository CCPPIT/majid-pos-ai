/** Spacing, radii and sizing tokens (4pt base grid). */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

export type Spacing = keyof typeof spacing;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  '3xl': 36,
  full: 999,
} as const;

export type Radius = keyof typeof radius;

/** Minimum accessible touch target (Section 50). */
export const touch = {
  minTarget: 44,
  minTargetLarge: 52,
} as const;

export const iconSize = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1,
  medium: 1.5,
  thick: 2,
} as const;
