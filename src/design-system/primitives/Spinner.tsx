import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { useTranslation } from '@/i18n/LocaleProvider';

interface SpinnerProps {
  size?: 'small' | 'large' | number;
  tone?: 'primary' | 'inverse' | 'muted';
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Spinner({
  size = 'small',
  tone = 'primary',
  style,
  accessibilityLabel,
}: SpinnerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const color =
    tone === 'inverse'
      ? colors.primaryContrast
      : tone === 'muted'
        ? colors.textSubtle
        : colors.primary;

  return (
    <View style={[styles.center, style]} accessible accessibilityRole="progressbar">
      <ActivityIndicator
        size={size}
        color={color}
        accessibilityLabel={accessibilityLabel ?? t('common.loading')}
      />
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
