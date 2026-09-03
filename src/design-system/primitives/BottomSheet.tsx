import { Ionicons } from '@expo/vector-icons';
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { radius, spacing } from '../tokens';
import { useTranslation } from '@/i18n/LocaleProvider';

interface BottomSheetProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  dismissible?: boolean;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, dismissible = true, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
      accessibilityViewIsModal
      accessibilityLabel={title}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? onClose : undefined} />
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.sheet,
            { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {title ? (
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={12}
                onPress={onClose}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </SafeAreaView>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginVertical: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
});
