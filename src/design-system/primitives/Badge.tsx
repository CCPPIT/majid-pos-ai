import { Text, View, type ViewProps } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';
import { toneColors, type Tone } from '../tokens/colors';

interface BadgeProps extends ViewProps {
  label: string;
  tone?: Tone;
  variant?: 'soft' | 'solid';
}

export function Badge({ label, tone = 'neutral', variant = 'soft', style, ...rest }: BadgeProps) {
  const { colors } = useTheme();
  const { strong, soft } = toneColors(colors, tone);
  const bg = variant === 'solid' ? strong : soft;
  const fg = variant === 'solid' ? colors.primaryContrast : strong;

  return (
    <View
      {...rest}
      accessibilityRole="text"
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: fontSize.sm, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
