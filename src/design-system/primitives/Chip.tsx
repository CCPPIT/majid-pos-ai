import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, type ViewStyle, type StyleProp } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  accessibilityHint,
  style,
}: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: 36,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={fontSize.base} color={selected ? colors.primary : colors.textMuted} />
      ) : null}
      <Text
        style={{
          color: selected ? colors.primary : colors.textMuted,
          fontSize: fontSize.sm,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
