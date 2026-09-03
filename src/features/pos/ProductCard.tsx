/**
 * بطاقة منتج في شاشة نقطة البيع (PHASE 11).
 * تعرض الأيقونة، الاسم (حسب اللغة)، السعر المنسّق بالعملة، حالة المخزون.
 * زر الإضافة إلى السلة يظهر كزر قادم (PHASE 12) — لا سلوك وهمي.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import type { Product, ProductStockStatus } from '@/domain/products/types';
import { useTranslation } from '@/i18n/LocaleProvider';

// خصائص البطاقة.
interface ProductCardProps {
  product: Product; // المنتج.
  locale: 'ar' | 'en'; // اللغة النشطة.
  quantity: number; // الكمية الحالية في السلة (للشارة).
  onAdd: (product: Product) => void; // ضغط الإضافة (يضيف للسلة فعليًا).
}

// مفتاح ترجمة حالة المخزون + النغمة.
function statusInfo(status: ProductStockStatus): { key: string; tone: 'success' | 'warning' | 'danger' } {
  if (status === 'out_of_stock') return { key: 'pos.outOfStock', tone: 'danger' };
  if (status === 'low_stock') return { key: 'pos.lowStock', tone: 'warning' };
  return { key: 'pos.inStock', tone: 'success' };
}

export function ProductCard({ product, locale, quantity, onAdd }: ProductCardProps) {
  const { colors } = useTheme();
  const { t, formatCurrency } = useTranslation();
  const name = locale === 'ar' ? product.nameAr : product.nameEn;
  const info = statusInfo(product.stockStatus);
  const palette = toneColors(colors, info.tone);
  const disabled = product.stockStatus === 'out_of_stock'; // النافد غير قابل للإضافة.

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* رأس البطاقة: أيقونة + شارة المخزون */}
      <View style={styles.top}>
        <View style={[styles.iconBox, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={(product.imageIcon ?? 'cube-outline') as keyof typeof Ionicons.glyphMap} size={26} color={colors.primary} />
        </View>
        <View style={[styles.badge, { backgroundColor: palette.soft }]}>
          <Text style={[styles.badgeText, { color: palette.strong }]}>{t(info.key)}</Text>
        </View>
      </View>

      {/* الاسم + الباركود */}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[styles.barcode, { color: colors.textSubtle }]} numberOfLines={1}>
        {product.barcode}
      </Text>

      {/* السعر + زر الإضافة */}
      <View style={styles.footer}>
        <Text style={[styles.price, { color: colors.text }]}>{formatCurrency(product.price.amount, product.price.currency)}</Text>
        <View style={styles.addWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pos.addToCart')}
            accessibilityState={{ disabled, selected: quantity > 0 }}
            disabled={disabled}
            onPress={() => onAdd(product)}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: disabled ? colors.surfaceMuted : colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={20} color={disabled ? colors.textSubtle : colors.primaryContrast} />
          </Pressable>
          {/* شارة الكمية عند إضافة المنتج للسلة */}
          {quantity > 0 ? (
            <View style={[styles.qtyBadge, { backgroundColor: colors.success }]} accessibilityLabel={t('cart.inCart', { qty: quantity })}>
              <Text style={styles.qtyBadgeText}>{quantity}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// أنماط البطاقة.
const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 168,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBox: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontSize: 10, fontWeight: '700' },
  name: { fontSize: fontSize.sm, fontWeight: '700', lineHeight: 18, minHeight: 36 },
  barcode: { fontSize: fontSize.xs },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: spacing.xs },
  price: { fontSize: fontSize.md, fontWeight: '800', flex: 1 },
  addWrap: { position: 'relative' },
  addBtn: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  qtyBadge: {
    position: 'absolute',
    top: -6,
    start: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  qtyBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
