import { Ionicons } from '@expo/vector-icons';
import { Text, View, type ViewStyle, type StyleProp } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';
import { toneColors, type Tone } from '../tokens/colors';

interface AlertProps {
  title?: string;
  message: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  primary: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  info: 'information-circle',
  neutral: 'information-circle-outline',
};

export function Alert({ title, message, tone = 'info', icon, style }: AlertProps) {
  const { colors } = useTheme();
  const { strong, soft } = toneColors(colors, tone);

  return (
    <View
      style={[{ flexDirection: 'row', gap: spacing.sm, backgroundColor: soft, borderRadius: radius.lg, padding: spacing.lg }, style]}
      accessibilityRole="alert"
    >
      <Ionicons name={icon ?? DEFAULT_ICON[tone]} size={20} color={strong} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        {title ? (
          <Text style={{ color: strong, fontSize: fontSize.md, fontWeight: '800' }}>{title}</Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: 20 }}>{message}</Text>
      </View>
    </View>
  );
}
