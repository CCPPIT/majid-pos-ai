import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Spinner } from './Spinner';
import { fontSize, fontWeight, radius, touch } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'leading',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const height = size === 'sm' ? touch.minTarget : size === 'lg' ? 56 : touch.minTargetLarge;
  const paddingH = size === 'sm' ? 14 : size === 'lg' ? 28 : 22;
  const labelFont = size === 'sm' ? fontSize.sm : size === 'lg' ? fontSize.lg : fontSize.base;

  const isInactive = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? colors.primaryStrong
      : variant === 'danger'
        ? colors.danger
        : variant === 'success'
          ? colors.success
          : variant === 'secondary'
            ? colors.surfaceMuted
            : 'transparent';

  const borderColor =
    variant === 'ghost'
      ? colors.borderStrong
      : variant === 'secondary'
        ? colors.border
        : backgroundColor;

  const textColor =
    variant === 'ghost'
      ? colors.text
      : variant === 'secondary'
        ? colors.text
        : colors.primaryContrast;

  const iconEl = loading ? (
    <Spinner size="small" tone="inverse" />
  ) : icon ? (
    <Ionicons name={icon} size={labelFont + 2} color={textColor} />
  ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          paddingHorizontal: paddingH,
          borderRadius: radius.lg,
          backgroundColor,
          borderColor,
          borderWidth: 1,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        variant === 'primary' && !isInactive ? glowShadow(colors.glow) : null,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {iconPosition === 'leading' && iconEl}
      <Text style={[styles.label, { color: textColor, fontSize: labelFont }]}>{label}</Text>
      {iconPosition === 'trailing' && iconEl}
    </Pressable>
  );
}

// Soft glow for the primary CTA (Section 44 — subtle, not overwhelming).
const glowShadow = (glowColor: string): ViewStyle => ({
  shadowColor: glowColor,
  shadowOpacity: 0.5,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 0 },
  elevation: 6,
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: { width: '100%' },
  label: { fontWeight: fontWeight.bold, textAlign: 'center' },
});
