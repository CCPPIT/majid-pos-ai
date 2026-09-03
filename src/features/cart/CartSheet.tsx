/**
 * ورقة مراجعة السلة (PHASE 12 — Cart Engine).
 * تعرض بنود السلة مع أزرار كمية (−/+)، إزالة بند، خصم إجمالي،
 * والإجماليات الحقيقية (صافٍ/ضريبة/نهائي) المحسوبة في المجال.
 * زر الدفع لافتة صادقة (Checkout PHASE 13) — لا سلوك وهمي.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useToast } from '@/design-system/primitives/Toast';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { useCart } from './cart-context';
import { cartErrorKey } from './cart-messages';

// خصائص الورقة.
interface CartSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CartSheet({ visible, onClose }: CartSheetProps) {
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { cart, totals, increment, decrement, remove, applyDiscountPercent } = useCart();

  // تبديل الخصم السريع (لا خصم → 5 → 10 → لا خصم).
  const cycleDiscount = () => {
    const next = cart.discountPercent === 0 ? 5 : cart.discountPercent === 5 ? 10 : 0;
    const result = applyDiscountPercent(next);
    if (!result.ok) {
      toast.show(t(cartErrorKey(result.reason)), 'danger');
    } else if (next > 0) {
      toast.show(t('cart.discountApplied', { value: String(next) }), 'success');
    }
  };

  // مسار شاشة إتمام البيع (مطابق لملف src/app/(app)/checkout.tsx).
  const checkoutHref = '/(app)/checkout' as Href;
  // زر الدفع: نغلق الورقة وننتقل لشاشة إتمام البيع (PHASE 13).
  const handleCheckout = () => {
    onClose();
    router.push(checkoutHref);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('cart.title')}>
      {totals.isEmpty ? (
        // سلة فارغة.
        <EmptyState icon="cart-outline" title={t('cart.empty')} description={t('cart.emptyDescription')} />
      ) : (
        <View style={styles.container}>
          {/* قائمة البنود */}
          <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
            {cart.lines.map((line) => {
              const name = locale === 'ar' ? line.nameAr : line.nameEn;
              return (
                <View
                  key={String(line.productId)}
                  style={[styles.line, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                >
                  <View style={styles.lineInfo}>
                    <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.linePrice, { color: colors.textMuted }]}>
                      {t('cart.lineUnit', {
                        price: formatCurrency(line.unitPrice.amount, line.unitPrice.currency),
                        qty: line.quantity,
                      })}
                    </Text>
                  </View>

                  {/* أزرار الكمية */}
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('cart.decrement')}
                      onPress={() => {
                        const result = decrement(line.productId);
                        if (!result.ok) toast.show(t(cartErrorKey(result.reason)), 'danger');
                      }}
                      style={[styles.stepBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.qty, { color: colors.text }]}>{line.quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('cart.increment')}
                      onPress={() => {
                        const result = increment(line.productId);
                        if (!result.ok) toast.show(t(cartErrorKey(result.reason)), 'warning');
                      }}
                      style={[styles.stepBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </Pressable>
                    {/* إزالة البند */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('cart.remove')}
                      onPress={() => remove(line.productId)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* إجماليات حقيقية (محسوبة في المجال) */}
          <View style={[styles.totals, { borderTopColor: colors.border }]}>
            <TotalsRow label={t('cart.subtotal')} value={formatCurrency(totals.subtotal.amount, cart.currency)} />
            {totals.discount.amount > 0 ? (
              <TotalsRow label={t('cart.discount')} value={`- ${formatCurrency(totals.discount.amount, cart.currency)}`} negative />
            ) : null}
            <TotalsRow label={t('cart.tax')} value={formatCurrency(totals.taxAmount.amount, cart.currency)} />
            <View style={[styles.grandRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandLabel, { color: colors.text }]}>{t('cart.total')}</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>
                {formatCurrency(totals.total.amount, cart.currency)}
              </Text>
            </View>
          </View>

          {/* صف الخصم (تبديل سريع: لا خصم ← 5% ← 10%) */}
          <View style={styles.discountRow}>
            <Text style={[styles.discountLabel, { color: colors.textMuted }]}>{t('cart.discountPercent')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cart.setDiscountHint')}
              onPress={cycleDiscount}
              style={[styles.discountChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            >
              <Text style={[styles.discountChipText, { color: colors.primary }]}>
                {cart.discountPercent > 0 ? t('cart.discountValue', { value: String(cart.discountPercent) }) : t('cart.addDiscount')}
              </Text>
            </Pressable>
          </View>

          {/* زر الدفع: لافتة صادقة */}
          <Button label={t('cart.checkout')} icon="card-outline" variant="success" onPress={handleCheckout} />
          <Button label={t('common.close')} variant="secondary" onPress={onClose} />
        </View>
      )}
    </BottomSheet>
  );
}

// صف إجمالي (تسمية + قيمة نقدية منسّقة مسبقًا).
function TotalsRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.totalsValue, { color: negative ? colors.danger : colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

// أنماط الورقة.
const styles = StyleSheet.create({
  container: { gap: spacing.md, maxHeight: '78%' },
  list: { maxHeight: 260 },
  line: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  lineInfo: { flex: 1, gap: 2 },
  lineName: { fontSize: fontSize.sm, fontWeight: '700' },
  linePrice: { fontSize: fontSize.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: { width: 32, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontSize: fontSize.md, fontWeight: '800' },
  removeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  totals: { borderTopWidth: 1, paddingTop: spacing.sm, gap: spacing.xs },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsLabel: { fontSize: fontSize.sm },
  totalsValue: { fontSize: fontSize.sm, fontWeight: '700' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.xs },
  grandLabel: { fontSize: fontSize.lg, fontWeight: '800' },
  grandValue: { fontSize: fontSize.xl, fontWeight: '800' },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountLabel: { fontSize: fontSize.sm },
  discountChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1 },
  discountChipText: { fontSize: fontSize.sm, fontWeight: '700' },
});
