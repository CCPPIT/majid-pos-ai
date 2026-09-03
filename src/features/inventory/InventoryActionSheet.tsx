/**
 * ورقة إجراء مخزون (PHASE 17).
 * نوع واحد للحركة يُحدَّد من الشاشة: استلام / تسوية / تحويل.
 * حقول الكمية (والرصيد الفعلي للتسوية، والوجهة للتحويل) + سبب إلزامي.
 */
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useState } from 'react';

// أنواع الحركة التي تنفّذها الورقة.
export type InventoryAction = 'receive' | 'adjust' | 'transfer';

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  action: InventoryAction; // نوع الحركة.
  productName: string; // اسم المنتج (للعرض).
  currentQuantity: number; // الرصيد الحالي (للعرض والتحقق).
  // خيارات المتاجر للتحويل (المعرف → الاسم). إن وُجدت.
  storeOptions?: { id: string; label: string }[];
  onSubmit: (values: { quantity: number; reason: string; reference: string; toStoreId: string }) => Promise<void>;
}

export function InventoryActionSheet({
  visible,
  onClose,
  action,
  productName,
  currentQuantity,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState(''); // الكمية (الاستلام/التحويل).
  const [reason, setReason] = useState(''); // السبب.
  const [reference, setReference] = useState(''); // المرجع.
  const [toStoreId, setToStoreId] = useState(''); // متجر الوجهة (تحويل).
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // التسوية تستخدم حقل الرصيد الفعلي نفسه (quantity).
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isFinite(qtyNumber) && qtyNumber > 0;
  // التسوية تقبل صفرًا (رصيد فعلي صفر)، لذا تتحقق منها بشكل منفصل.
  const adjustValid = action === 'adjust' && quantity.trim() !== '' && Number.isFinite(qtyNumber) && qtyNumber >= 0;
  // الإنقاص (تحويل) يتطلب رصيدًا كافيًا.
  const enough = action !== 'transfer' || qtyNumber <= currentQuantity;
  const reasonValid = reason.trim().length > 0;
  const transferTargetValid = action !== 'transfer' || toStoreId.trim().length > 0;
  const canSubmit = (qtyValid || adjustValid) && reasonValid && enough && transferTargetValid && !saving;

  // عنوان الحركة.
  const titleKey =
    action === 'receive' ? 'inventory.receiveTitle' : action === 'adjust' ? 'inventory.adjustTitle' : 'inventory.transferTitle';
  // مفتاح تسمية حقل الكمية.
  const qtyLabelKey = action === 'adjust' ? 'inventory.field.countedQty' : 'inventory.field.quantity';

  // تنفيذ الإجراء.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ quantity: Math.trunc(qtyNumber), reason: reason.trim(), reference: reference.trim(), toStoreId: toStoreId.trim() });
      setQuantity('');
      setReason('');
      setReference('');
      setToStoreId('');
      onClose();
    } catch {
      setError(t('inventory.error.actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t(titleKey)}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{productName}</Text>
        <Text style={[styles.current, { color: colors.textMuted }]}>
          {t('inventory.currentStock')}: {currentQuantity}
        </Text>

        <Input
          label={t(qtyLabelKey)}
          placeholder="0"
          keyboardType="number-pad"
          value={quantity}
          onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
        />

        {action === 'transfer' ? (
          <Input
            label={t('inventory.field.targetStore')}
            placeholder={t('inventory.field.targetStorePh')}
            value={toStoreId}
            onChangeText={setToStoreId}
          />
        ) : null}

        <Input
          label={t('inventory.field.reason')}
          placeholder={t('inventory.field.reasonPh')}
          value={reason}
          onChangeText={setReason}
        />
        <Input
          label={t('inventory.field.reference')}
          placeholder={t('inventory.field.referencePh')}
          value={reference}
          onChangeText={setReference}
        />

        {action === 'transfer' && !enough && quantity ? (
          <Text style={[styles.error, { color: colors.danger }]}>{t('inventory.error.insufficientStock')}</Text>
        ) : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button
          label={t('inventory.apply')}
          icon="checkmark-circle-outline"
          variant="success"
          loading={saving}
          disabled={!canSubmit}
          onPress={() => void handleSubmit()}
        />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '70%' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  productName: { fontSize: fontSize.lg, fontWeight: '800' },
  current: { fontSize: fontSize.sm, fontWeight: '600' },
  error: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
});
