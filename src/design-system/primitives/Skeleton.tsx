import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { radius } from '../tokens';
import { useTranslation } from '@/i18n/LocaleProvider';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radiusToken?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radiusToken = 'sm', style }: SkeletonProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius[radiusToken],
          backgroundColor: colors.skeleton,
        },
        animatedStyle,
        style,
      ]}
      accessible
      accessibilityLabel={t('common.loading')}
      accessibilityRole="progressbar"
    />
  );
}
