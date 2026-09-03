import { Text, View } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, spacing } from '../tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { Button } from './Button';
import { Modal } from './Modal';

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/** Confirmation dialog — the explicit Confirm step of the AI action safety
 * pipeline and destructive actions generally (Section 36). */
export function Dialog({
  visible,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const confirm = confirmLabel ?? t('common.confirm');
  const cancel = cancelLabel ?? t('common.cancel');
  return (
    <Modal visible={visible} onClose={onCancel} accessibilityLabel={title}>
      <View style={{ gap: spacing.sm }} accessible accessibilityRole="alert">
        <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: '800' }}>{title}</Text>
        {message ? (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 }}>{message}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Button
          label={cancel}
          variant="secondary"
          onPress={onCancel}
          style={{ flex: 1 }}
          accessibilityHint="إلغاء الإجراء"
        />
        <Button
          label={confirm}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          style={{ flex: 1 }}
          accessibilityHint={destructive ? 'تنفيذ إجراء لا يمكن التراجع عنه' : 'تأكيد الإجراء'}
        />
      </View>
    </Modal>
  );
}
