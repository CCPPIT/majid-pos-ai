/**
 * ورقة نموذج عميل (PHASE 19).
 * تُستخدم للإنشاء والتعديل: النوع (فرد/تجاري)، الاسم، الهاتف، البريد،
 * العنوان، قناة التواصل، الوسوم. تحقق فوري عبر المجال، وحفظ عبر المستودع.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Chip } from '@/design-system/primitives/Chip';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useState } from 'react';
import {
  validateCustomerDraft,
  type CustomerDraft,
} from '@/domain/customers';

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  initial: CustomerDraft; // القيم الأولية (يبنيها الأب عند الفتح).
  editing: boolean; // هل نعدّل عميلًا قائمًا؟
  onSave: (draft: CustomerDraft) => Promise<void>; // الحفظ من الشاشة.
}

export function CustomerFormSheet({ visible, onClose, initial, editing, onSave }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<CustomerDraft>(initial); // القيم.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحديث حقل.
  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // تحقق فوري.
  const validation = validateCustomerDraft(draft);
  const nameErr = draft.fullName && !validateCustomerDraft({ ...draft, phone: '', email: '' }).valid
    ? t('customers.error.nameRequired')
    : undefined;

  // حفظ.
  const handleSave = async () => {
    const check = validateCustomerDraft(draft);
    if (!check.valid) {
      setError(t(check.errorKey ?? 'customers.error.invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError(t('customers.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // إبقاء الـ props مستخدمة (visible/editing للسياق).
  void visible;
  void editing;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={editing ? t('customers.editTitle') : t('customers.addTitle')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* نوع العميل */}
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('customers.field.kind')}</Text>
        <View style={styles.chipWrap}>
          <Chip label={t('customers.kind.individual')} icon="person-outline" selected={draft.kind === 'individual'} onPress={() => set('kind', 'individual')} />
          <Chip label={t('customers.kind.business')} icon="business-outline" selected={draft.kind === 'business'} onPress={() => set('kind', 'business')} />
        </View>

        <Input label={t('customers.field.name')} placeholder={t('customers.field.namePh')} value={draft.fullName} onChangeText={(v) => set('fullName', v)} error={nameErr} />
        <Input label={t('customers.field.phone')} placeholder="7xx xxx xxx" keyboardType="phone-pad" value={draft.phone} onChangeText={(v) => set('phone', v)} />
        <Input label={t('customers.field.email')} placeholder="customer@example.com" keyboardType="email-address" value={draft.email} onChangeText={(v) => set('email', v)} />
        <Input label={t('customers.field.address')} placeholder={t('customers.field.addressPh')} value={draft.address} onChangeText={(v) => set('address', v)} />
        <Input label={t('customers.field.tags')} placeholder={t('customers.field.tagsPh')} value={draft.tags} onChangeText={(v) => set('tags', v)} />

        {/* قناة التواصل المفضلة */}
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('customers.field.channel')}</Text>
        <View style={styles.chipWrap}>
          <Chip label={t('customers.channel.sms')} selected={draft.preferredChannel === 'sms'} onPress={() => set('preferredChannel', 'sms')} />
          <Chip label={t('customers.channel.whatsapp')} selected={draft.preferredChannel === 'whatsapp'} onPress={() => set('preferredChannel', 'whatsapp')} />
          <Chip label={t('customers.channel.email')} selected={draft.preferredChannel === 'email'} onPress={() => set('preferredChannel', 'email')} />
          <Chip label={t('customers.channel.none')} selected={draft.preferredChannel === 'none'} onPress={() => set('preferredChannel', 'none')} />
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button label={editing ? t('customers.save') : t('customers.create')} icon="checkmark-circle-outline" variant="success" loading={saving} disabled={!validation.valid || saving} onPress={() => void handleSave()} />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '74%' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '700' },
  error: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
});
