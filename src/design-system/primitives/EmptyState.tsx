import { Ionicons } from '@expo/vector-icons';
import { Text, View, type ViewStyle, type StyleProp } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';
import type { Tone } from '../tokens/colors';
import { toneColors } from '../tokens/colors';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = 'cube-outline',
  title,
  description,
  tone = 'neutral',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const { strong, soft } = toneColors(colors, tone);

  return (
    <View
      style={[{ alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.sm }, style]}
      accessible
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.xl,
          backgroundColor: soft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <Ionicons name={icon} size={32} color={strong} />
      </View>
      <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}
