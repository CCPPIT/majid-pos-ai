/**
 * ورقة نموذج مورّد (PHASE 18).
 * حقول الاسم/الاتصال/الهاتف/البريد/العنوان/الرقم الضريبي/العملة،
 * تحقق فوري عبر المجال، وحفظ عبر المستودع. لا نصوص خام (i18n).
 */
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useState } from 'react';
import { validateSupplierDraft, type SupplierDraft } from '@/domain/procurement';

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  currency: string; // عملة المتجر الافتراضية.
  onSave: (draft: SupplierDraft) => Promise<void>; // دالة الحفظ من الشاشة.
}

// نموذج فارغ.
function emptyDraft(currency: string): SupplierDraft {
  return { nameAr: '', nameEn: '', contactName: '', phone: '', email: '', address: '', taxNumber: '', currency };
}

export function SupplierFormSheet({ visible, onClose, currency, onSave }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<SupplierDraft>(() => emptyDraft(currency)); // القيم.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحديث حقل.
  const set = <K extends keyof SupplierDraft>(key: K, value: SupplierDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // تحقق فوري.
  const validation = validateSupplierDraft(draft);
  const nameError = draft.nameAr && !validateSupplierDraft({ ...draft, nameEn: '', contactName: '', phone: '', email: '', address: '', taxNumber: '' }).valid
    ? t('procurement.error.supplierNameRequired')
    : undefined;

  // حفظ.
  const handleSave = async () => {
    const check = validateSupplierDraft(draft);
    if (!check.valid) {
      setError(t(check.errorKey ?? 'procurement.error.invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setDraft(emptyDraft(currency)); // تصفير بعد النجاح.
      onClose();
    } catch {
      setError(t('procurement.error.supplierSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('procurement.addSupplier')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input label={t('procurement.field.supplierNameAr')} placeholder={t('procurement.field.supplierNameArPh')} value={draft.nameAr} onChangeText={(v) => set('nameAr', v)} error={nameError} />
        <Input label={t('procurement.field.supplierNameEn')} placeholder={t('procurement.field.supplierNameEnPh')} value={draft.nameEn} onChangeText={(v) => set('nameEn', v)} />
        <Input label={t('procurement.field.contactName')} placeholder={t('procurement.field.contactNamePh')} value={draft.contactName} onChangeText={(v) => set('contactName', v)} />
        <Input label={t('procurement.field.phone')} placeholder="7xx xxx xxx" keyboardType="phone-pad" value={draft.phone} onChangeText={(v) => set('phone', v)} />
        <Input label={t('procurement.field.email')} placeholder="supplier@example.com" keyboardType="email-address" value={draft.email} onChangeText={(v) => set('email', v)} />
        <Input label={t('procurement.field.taxNumber')} placeholder={t('procurement.field.taxNumberPh')} value={draft.taxNumber} onChangeText={(v) => set('taxNumber', v)} />
        <Input label={t('procurement.field.address')} placeholder={t('procurement.field.addressPh')} value={draft.address} onChangeText={(v) => set('address', v)} />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button label={t('procurement.createSupplier')} icon="checkmark-circle-outline" variant="success" loading={saving} disabled={!validation.valid || saving} onPress={() => void handleSave()} />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '72%' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  error: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
});
