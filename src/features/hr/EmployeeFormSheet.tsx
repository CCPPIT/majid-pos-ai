/**
 * ورقة نموذج موظف (PHASE 21).
 * حقول: الاسم، الهاتف، البريد، المسمى الوظيفي، كود الدور، الراتب، تاريخ
 * التعيين، ملاحظات. تحقق فوري عبر المجال. لا نصوص خام (i18n).
 */
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useState } from 'react';
import { validateEmployeeDraft, type EmployeeDraft } from '@/domain/hr';

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  initial: EmployeeDraft; // القيم الأولية.
  editing: boolean; // تعديل أم إنشاء.
  onSave: (draft: EmployeeDraft) => Promise<void>;
}

// نموذج فارغ.
export function emptyEmployeeDraft(): EmployeeDraft {
  return { fullName: '', phone: '', email: '', position: '', roleCode: '', baseSalary: '', hireDate: new Date().toISOString().slice(0, 10), notes: '' };
}

export function EmployeeFormSheet({ visible, onClose, initial, editing, onSave }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<EmployeeDraft>(initial); // القيم.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحديث حقل.
  const set = <K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // تحقق فوري.
  const validation = validateEmployeeDraft(draft);

  // حفظ.
  const handleSave = async () => {
    const check = validateEmployeeDraft(draft);
    if (!check.valid) {
      setError(t(check.errorKey ?? 'hr.error.invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError(t('hr.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={editing ? t('hr.editTitle') : t('hr.addTitle')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input label={t('hr.field.name')} placeholder={t('hr.field.namePh')} value={draft.fullName} onChangeText={(v) => set('fullName', v)} />
        <Input label={t('hr.field.position')} placeholder={t('hr.field.positionPh')} value={draft.position} onChangeText={(v) => set('position', v)} />
        <Input label={t('hr.field.phone')} placeholder="7xx xxx xxx" keyboardType="phone-pad" value={draft.phone} onChangeText={(v) => set('phone', v)} />
        <Input label={t('hr.field.email')} placeholder="employee@example.com" keyboardType="email-address" value={draft.email} onChangeText={(v) => set('email', v)} />
        <Input label={t('hr.field.roleCode')} placeholder={t('hr.field.roleCodePh')} value={draft.roleCode} onChangeText={(v) => set('roleCode', v)} />
        <Input label={t('hr.field.salary')} placeholder="0" keyboardType="numeric" value={draft.baseSalary} onChangeText={(v) => set('baseSalary', v.replace(/[^0-9.]/g, ''))} />
        <Input label={t('hr.field.hireDate')} placeholder="2026-01-01" value={draft.hireDate} onChangeText={(v) => set('hireDate', v)} />
        <Input label={t('hr.field.notes')} placeholder={t('hr.field.notesPh')} value={draft.notes} onChangeText={(v) => set('notes', v)} />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button label={editing ? t('hr.save') : t('hr.create')} icon="checkmark-circle-outline" variant="success" loading={saving} disabled={!validation.valid || saving} onPress={() => void handleSave()} />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '74%' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  error: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
});
