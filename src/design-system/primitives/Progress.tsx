import { useEffect } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { radius } from '../tokens';
import { toneColors, type Tone } from '../tokens/colors';

interface ProgressProps {
  /** 0..1 */
  value: number;
  height?: number;
  tone?: Tone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Progress({ value, height = 8, tone = 'primary', accessibilityLabel, style }: ProgressProps) {
  const { colors } = useTheme();
  const { strong } = toneColors(colors, tone);
  const animated = useSharedValue(0);

  const clamped = Math.max(0, Math.min(1, value));

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 350 });
  }, [animated, clamped]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animated.value * 100}%`,
  }));

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.full,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        style,
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'التقدم'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: strong, borderRadius: radius.full }, barStyle]} />
    </View>
  );
}
