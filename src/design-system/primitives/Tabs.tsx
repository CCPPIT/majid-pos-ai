import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';

export interface TabItem {
  key: string;
  label: string;
  icon?: string;
  badge?: number;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
}

/** Segmented tab control (NOT the bottom navigation bar). */
export function Tabs({ items, activeKey, onChange, accessibilityLabel }: TabsProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={[
              styles.tab,
              { backgroundColor: active ? colors.surface : 'transparent' },
              active && { borderColor: colors.border },
            ]}
          >
            <Text
              style={{
                color: active ? colors.primary : colors.textSubtle,
                fontSize: fontSize.sm,
                fontWeight: active ? '800' : '600',
              }}
            >
              {item.label}
            </Text>
            {typeof item.badge === 'number' && item.badge > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryContrast }]}>
                  {item.badge > 99 ? '99+' : item.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
