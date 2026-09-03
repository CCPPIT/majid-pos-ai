import { View, type ViewProps } from 'react-native';

import { useTheme } from '../theme';
import { radius, spacing, type Radius } from '../tokens';
import { shadow, type Elevation } from '../tokens/shadows';

interface CardProps extends ViewProps {
  elevation?: Elevation;
  radiusToken?: Radius;
  padded?: boolean;
  glass?: boolean;
}

export function Card({
  elevation = 'sm',
  radiusToken = 'xl',
  padded = true,
  glass = false,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: glass ? colors.glass : colors.surface,
          borderRadius: radius[radiusToken],
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? spacing.xl : 0,
          ...shadow(colors, elevation),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
