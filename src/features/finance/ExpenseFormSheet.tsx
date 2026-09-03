/**
 * ورقة إضافة مصروف (PHASE 20).
 * حقول: التصنيف، الوصف، المبلغ، طريقة الدفع. تحقق فوري عبر المجال.
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
import { validateExpenseDraft, type ExpenseCategory, type ExpenseDraft } from '@/domain/finance';

// التصنيفات المتاحة.
const CATEGORIES: ExpenseCategory[] = ['rent', 'utilities', 'salaries', 'marketing', 'maintenance', 'other'];
// طرق الدفع وقيمها + مفتاح التسمية.
const METHODS: { id: string; labelKey: string }[] = [
  { id: 'cash', labelKey: 'pay.methodCash' },
  { id: 'card', labelKey: 'pay.methodCard' },
  { id: 'wallet', labelKey: 'pay.methodWallet' },
];

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: ExpenseDraft) => Promise<void>;
}

// نموذج فارغ.
function emptyDraft(): ExpenseDraft {
  return { category: 'other', note: '', amount: '', method: 'cash' };
}

export function ExpenseFormSheet({ visible, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft); // القيم.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحديث حقل.
  const set = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // تحقق فوري.
  const validation = validateExpenseDraft(draft);

  // حفظ.
  const handleSave = async () => {
    const check = validateExpenseDraft(draft);
    if (!check.valid) {
      setError(t(check.errorKey ?? 'finance.error.invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setDraft(emptyDraft());
      onClose();
    } catch {
      setError(t('finance.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('finance.addExpense')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* التصنيف */}
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('finance.field.category')}</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={t(`finance.expenseCategory.${cat}`)}
              selected={draft.category === cat}
              onPress={() => set('category', cat)}
            />
          ))}
        </View>

        <Input label={t('finance.field.note')} placeholder={t('finance.field.notePh')} value={draft.note} onChangeText={(v) => set('note', v)} />
        <Input label={t('finance.field.amount')} placeholder="0" keyboardType="numeric" value={draft.amount} onChangeText={(v) => set('amount', v.replace(/[^0-9.]/g, ''))} />

        {/* طريقة الدفع */}
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('finance.field.method')}</Text>
        <View style={styles.chipWrap}>
          {METHODS.map((m) => (
            <Chip key={m.id} label={t(m.labelKey)} selected={draft.method === m.id} onPress={() => set('method', m.id)} />
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button label={t('finance.saveExpense')} icon="checkmark-circle-outline" variant="success" loading={saving} disabled={!validation.valid || saving} onPress={() => void handleSave()} />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '72%' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '700' },
  error: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
});
