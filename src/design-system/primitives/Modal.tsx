import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { useTranslation } from '@/i18n/LocaleProvider';

interface ModalProps {
  visible: boolean;
  onClose?: () => void;
  /** Pressing the backdrop / back gesture closes the modal. */
  dismissible?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

export function Modal({ visible, onClose, dismissible = true, children, accessibilityLabel }: ModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={dismissible ? onClose : undefined}
        />
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
          ]}
        >
          {dismissible && onClose ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  panel: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 10, padding: spacing.xs },
});
