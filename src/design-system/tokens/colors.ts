/**
 * Color tokens — Premium / Futuristic / AI-Native palette (Section 44).
 * Dark is the default experience; Light is fully supported.
 * Neon is used as accent glow only — never full-screen.
 */

export interface ColorPalette {
  // Surfaces
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  glass: string; // translucent glass surface
  // Borders
  border: string;
  borderStrong: string;
  // Brand
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  primaryContrast: string;
  gradientFrom: string;
  gradientTo: string;
  glow: string;
  // Text
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  // Status tones (strong = text/icon, soft = tinted surface)
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  neutralSoft: string;
  // Overlays / loading
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
  shadow: string;
}

export const darkColors: ColorPalette = {
  background: '#0B0F14',
  backgroundElevated: '#0F1620',
  surface: '#101826',
  surfaceMuted: '#16202E',
  surfaceElevated: '#1A2740',
  glass: 'rgba(22, 32, 46, 0.72)',
  border: '#1E293B',
  borderStrong: '#334155',

  primary: '#38BDF8',
  primaryStrong: '#0EA5E9',
  primarySoft: 'rgba(14, 165, 233, 0.14)',
  primaryContrast: '#F8FAFC',
  gradientFrom: '#0EA5E9',
  gradientTo: '#6366F1',
  glow: 'rgba(56, 189, 248, 0.35)',

  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  textInverse: '#0B0F14',

  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.14)',
  neutralSoft: 'rgba(148, 163, 184, 0.12)',

  overlay: 'rgba(2, 6, 12, 0.72)',
  skeleton: '#16202E',
  skeletonHighlight: '#223044',
  shadow: '#000000',
};

export const lightColors: ColorPalette = {
  background: '#EEF2F7',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.78)',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  primary: '#0284C7',
  primaryStrong: '#0369A1',
  primarySoft: '#E0F2FE',
  primaryContrast: '#FFFFFF',
  gradientFrom: '#0EA5E9',
  gradientTo: '#6366F1',
  glow: 'rgba(14, 165, 233, 0.25)',

  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#94A3B8',
  textInverse: '#FFFFFF',

  success: '#059669',
  successSoft: '#D1FAE5',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',
  neutralSoft: '#F1F5F9',

  overlay: 'rgba(15, 23, 42, 0.45)',
  skeleton: '#E2E8F0',
  skeletonHighlight: '#F1F5F9',
  shadow: '#0F172A',
};

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Resolve tone → (strong color, soft surface) for the active palette. */
export const toneColors = (
  colors: ColorPalette,
  tone: Tone,
): { strong: string; soft: string } => {
  switch (tone) {
    case 'success':
      return { strong: colors.success, soft: colors.successSoft };
    case 'warning':
      return { strong: colors.warning, soft: colors.warningSoft };
    case 'danger':
      return { strong: colors.danger, soft: colors.dangerSoft };
    case 'info':
      return { strong: colors.info, soft: colors.infoSoft };
    case 'neutral':
      return { strong: colors.textMuted, soft: colors.neutralSoft };
    case 'primary':
    default:
      return { strong: colors.primary, soft: colors.primarySoft };
  }
};
