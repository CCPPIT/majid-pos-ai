/** Typography tokens — size, weight and line-height scale. */

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 16,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  display:44,
} as const;

export type FontSize = keyof typeof fontSize;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export type FontWeight = keyof typeof fontWeight;

/** Line heights tuned to each size. */
export const lineHeight: Record<FontSize, number> = {
  xs: 16,
  sm: 18,
  md: 20,
  base: 24,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 38,
  '4xl': 44,
  display: 52,
};

export interface TextVariant {
  fontSize: number;
  fontWeight: (typeof fontWeight)[FontWeight];
  lineHeight: number;
  letterSpacing?: number;
}

export const textVariants = {
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, lineHeight: lineHeight.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, lineHeight: lineHeight.sm },
  body: { fontSize: fontSize.md, fontWeight: fontWeight.regular, lineHeight: lineHeight.md },
  bodyStrong: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: lineHeight.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, lineHeight: lineHeight.lg },
  heading: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, lineHeight: lineHeight.xl },
  display: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, lineHeight: lineHeight['2xl'] },
  hero: { fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold, lineHeight: lineHeight['3xl'] },
  metric: { fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold, lineHeight: lineHeight['4xl'] },
} satisfies Record<string, TextVariant>;

export type TextVariantName = keyof typeof textVariants;
