/**
 * ورقة نموذج المنتج (PHASE 16).
 * تُستخدم للإنشاء والتعديل: حقول الاسم/الباركود/SKU/التصنيف/السعر/الكمية/الضريبة،
 * تحقق فوري عبر المجال، وحفظ عبر المستودع. لا نصوص خام (i18n).
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
import type { Product, ProductCategory } from '@/domain/products/types';
import {
  validateDraft,
  validateBarcode,
  validateNameAr,
  validatePrice,
  validateStock,
  type ProductDraft,
} from '@/domain/products/validation';

// خصائص الورقة.
interface Props {
  visible: boolean;
  onClose: () => void;
  categories: ProductCategory[]; // التصنيفات المتاحة.
  currency: string; // عملة المتجر.
  initial: ProductDraft; // القيم الأولية (يُبنيها الأب عند الفتح).
  editing: Product | null; // منتج قائم عند التعديل (null = إنشاء).
  onSave: (draft: ProductDraft) => Promise<void>; // دالة الحفظ (من الشاشة).
}

export function ProductFormSheet({ visible, onClose, categories, currency, initial, editing, onSave }: Props) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  // يُهيأ النموذج من القيم الأولية عند التركيب؛ يعيد الأب التركيب بمفتاح لكل فتح.
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحديث حقل.
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // أخطاء فورية.
  const nameErr = draft.nameAr && !validateNameAr(draft.nameAr).valid ? t(validateNameAr(draft.nameAr).errorKey ?? '') : undefined;
  const barcodeErr = draft.barcode && !validateBarcode(draft.barcode).valid ? t(validateBarcode(draft.barcode).errorKey ?? '') : undefined;
  const priceErr = draft.priceAmount && !validatePrice(draft.priceAmount).valid ? t(validatePrice(draft.priceAmount).errorKey ?? '') : undefined;
  const stockErr = draft.stockQuantity && !validateStock(draft.stockQuantity).valid ? t(validateStock(draft.stockQuantity).errorKey ?? '') : undefined;

  const canSave = validateDraft(draft).valid && !saving;

  // حفظ.
  const handleSave = async () => {
    const validation = validateDraft(draft);
    if (!validation.valid) {
      setError(t(validation.errorKey ?? 'products.error.invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError(t('products.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={editing ? t('products.editTitle') : t('products.addTitle')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input
          label={t('products.field.nameAr')}
          placeholder={t('products.field.nameArPh')}
          value={draft.nameAr}
          onChangeText={(v) => set('nameAr', v)}
          error={nameErr}
        />
        <Input
          label={t('products.field.nameEn')}
          placeholder={t('products.field.nameEnPh')}
          value={draft.nameEn}
          onChangeText={(v) => set('nameEn', v)}
        />
        <Input
          label={t('products.field.barcode')}
          placeholder="6291000000000"
          keyboardType="number-pad"
          value={draft.barcode}
          onChangeText={(v) => set('barcode', v)}
          error={barcodeErr}
        />
        <Input
          label={t('products.field.sku')}
          placeholder={t('products.field.skuPh')}
          value={draft.sku}
          onChangeText={(v) => set('sku', v)}
        />

        {/* التصنيف */}
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('products.field.category')}</Text>
        <View style={styles.chipWrap}>
          {categories.map((c) => (
            <Chip
              key={String(c.id)}
              label={locale === 'ar' ? c.nameAr : c.nameEn}
              icon={c.icon as never}
              selected={draft.categoryId === String(c.id)}
              onPress={() => set('categoryId', String(c.id))}
            />
          ))}
        </View>

        <Input
          label={t('products.field.price')}
          placeholder="0"
          keyboardType="numeric"
          value={draft.priceAmount}
          onChangeText={(v) => set('priceAmount', v.replace(/[^0-9.]/g, ''))}
          error={priceErr}
        />
        <Input
          label={t('products.field.stock')}
          placeholder="0"
          keyboardType="number-pad"
          value={draft.stockQuantity}
          onChangeText={(v) => set('stockQuantity', v.replace(/[^0-9]/g, ''))}
          error={stockErr}
        />

        {/* شمول الضريبة */}
        <Chip
          label={t('products.field.taxIncluded')}
          icon={draft.taxIncluded ? 'checkbox-outline' : 'square-outline'}
          selected={draft.taxIncluded}
          onPress={() => set('taxIncluded', !draft.taxIncluded)}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button
          label={editing ? t('products.save') : t('products.create')}
          icon="checkmark-circle-outline"
          variant="success"
          loading={saving}
          disabled={!canSave}
          onPress={() => void handleSave()}
        />
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
  error: { fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center' },
});
