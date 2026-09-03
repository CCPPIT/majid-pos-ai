import { Image } from 'expo-image';
import { Text, View, type ImageStyle, type StyleProp } from 'react-native';

import { useTheme } from '../theme';
import { radius } from '../tokens';

interface AvatarProps {
  name?: string;
  uri?: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const initials = (name?: string): string => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
  return (first + second).toUpperCase() || '؟';
};

export function Avatar({ name, uri, size = 44, style }: AvatarProps) {
  const { colors } = useTheme();
  const borderRadius = radius.full;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius }, style]}
        contentFit="cover"
        accessibilityRole="image"
        accessibilityLabel={name ? `صورة ${name}` : 'صورة المستخدم'}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={name ? `الصورة الرمزية لـ ${name}` : 'صورة مستخدم'}
    >
      <Text style={{ color: colors.primary, fontSize: size * 0.36, fontWeight: '800' }}>
        {initials(name)}
      </Text>
    </View>
  );
}
