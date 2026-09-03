import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { spacing } from '../tokens';

interface ScreenProps {
  children: ReactNode;
  edges?: Edge[];
  /** Use ScrollView wrapper (default plain View for FlatList screens). */
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export function Screen({
  children,
  edges = ['top', 'bottom'],
  scroll = false,
  padded = true,
  style,
}: ScreenProps) {
  const { colors } = useTheme();
  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[padded && styles.padded, styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { padding: spacing.xl },
  scrollContent: { paddingBottom: spacing['4xl'], gap: spacing.lg },
});
