/**
 * شاشة نقطة البيع (PHASE 11 — POS Core).
 * بحث نصي عن المنتجات، فلترة بالتصنيف، وإدخال باركود يدوي (الماسح بالكاميرا
 * يأتي لاحقًا مع إضافة expo-camera). إضافة المنتج للسلة والدفع في PHASE 12-15،
 * لذا زر الإضافة يعرض لافتة صادقة بالمرحلة (لا وظائف وهمية).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { SearchInput } from '@/design-system/primitives/SearchInput';
import { Chip } from '@/design-system/primitives/Chip';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { BottomSheet } from '@/design-system/primitives/BottomSheet';
import { Input } from '@/design-system/primitives/Input';
import { Button } from '@/design-system/primitives/Button';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { useToast } from '@/design-system/primitives/Toast';
import type { ProductsRepository } from '@/data/repositories/products.repository';
import type { Product } from '@/domain/products/types';
import { useCart } from '@/features/cart/cart-context';
import { cartErrorKey } from '@/features/cart/cart-messages';
import { CartSheet } from '@/features/cart/CartSheet';
import { usePos } from './usePos';
import { ProductCard } from './ProductCard';

// خصائص الشاشة (المستودع محقون من حاوية التركيب).
interface PosScreenProps {
  repository: ProductsRepository;
}

export function PosScreen({ repository }: PosScreenProps) {
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const toast = useToast();
  const pos = usePos(repository); // بيانات ومنطق نقطة البيع.
  const { totals, currency, add, findQuantity } = useCart(); // سلة البيع الحقيقية.

  const [scanVisible, setScanVisible] = useState(false); // ورقة الباركود.
  const [barcodeInput, setBarcodeInput] = useState(''); // نص الباركود المدخل.
  const [cartVisible, setCartVisible] = useState(false); // ورقة السلة.

  // ضغط الإضافة: يضيف فعليًا للسلة عبر محرك المجال (PHASE 12).
  const handleAdd = (product: Product) => {
    if (product.stockStatus === 'out_of_stock') return; // النافد لا يُضاف.
    const result = add(product, 1);
    if (!result.ok) {
      // قاعدة عمل (تجاوز مخزون/عملة) → رسالة محلية.
      toast.show(t(cartErrorKey(result.reason)), 'warning');
      return;
    }
    toast.show(
      t('cart.added', { name: locale === 'ar' ? product.nameAr : product.nameEn }),
      'success',
    );
  };

  // تأكيد الباركود اليدوي.
  const handleBarcodeSubmit = () => {
    pos.onBarcodeScanned(barcodeInput);
    setBarcodeInput('');
    setScanVisible(false);
    if (pos.barcodeFeedback?.found === false) {
      toast.show(t('pos.barcodeNotFound'), 'warning');
    } else if (pos.barcodeFeedback?.found) {
      toast.show(t('pos.barcodeFound'), 'success');
    }
  };

  // بطاقات هيكلية أثناء التحميل (صفوف بعمودين).
  const renderSkeleton = () => (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skelCell}>
          <Skeleton height={168} radiusToken="lg" />
        </View>
      ))}
    </View>
  );

  // عمود واحد من شبكة المنتجات (عمودان في الصف).
  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.cell}>
      <ProductCard product={item} locale={locale} quantity={findQuantity(item.id)} onAdd={handleAdd} />
    </View>
  );

  return (
    <Screen edges={['top']} padded={false}>
      {/* الترويسة: عنوان + بحث + مسح */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('pos.title')}</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchFlex}>
            <SearchInput
              value={pos.search}
              onChangeText={pos.setSearch}
              placeholder={t('pos.searchPlaceholder')}
              accessibilityLabel={t('pos.searchPlaceholder')}
            />
          </View>
          {/* زر المسح: الكاميرا لاحقًا؛ حاليًا إدخال باركود يدوي. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pos.scan')}
            accessibilityHint={t('pos.scanHint')}
            onPress={() => setScanVisible(true)}
            style={({ pressed }) => [
              styles.scanBtn,
              { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* شريط التصنيفات (أفقي) */}
        <FlatList
          horizontal
          data={[{ id: null, nameAr: t('pos.allCategories') }, ...pos.categories.map((c) => ({ id: c.id, nameAr: locale === 'ar' ? c.nameAr : c.nameEn }))]}
          keyExtractor={(item) => String(item.id ?? 'all')}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Chip
              label={item.nameAr}
              selected={pos.categoryId === (item.id ? String(item.id) : null)}
              onPress={() => pos.selectCategory(item.id ? String(item.id) : null)}
            />
          )}
        />
      </View>

      {/* المحتوى حسب الحالة */}
      {pos.status.kind === 'loading' ? (
        <View style={styles.body}>{renderSkeleton()}</View>
      ) : pos.status.kind === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('pos.errorTitle')}
            description={t(pos.status.messageKey)}
            actionLabel={t('common.retry')}
            onAction={() => void pos.refresh()}
          />
        </View>
      ) : pos.isEmpty ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="search-outline" title={t('pos.emptyTitle')} description={t('pos.emptyDescription')} />
        </View>
      ) : (
        <FlatList
          data={pos.products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void pos.refresh()} tintColor={colors.primary} />
          }
        />
      )}

      {/* شريط السلة السفلي الحقيقي (يظهر عند وجود بنود) */}
      {totals.isEmpty ? (
        // سلة فارغة: تلميح صادق بأن الإضافة تعمل.
        <View style={[styles.footerBar, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
          <Ionicons name="cart-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('pos.footerEmptyHint')}</Text>
        </View>
      ) : (
        // سلة فيها بنود: عدد الأصناف + الإجمالي الحقيقي + فتح السلة.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cart.open')}
          accessibilityHint={t('cart.openHint')}
          onPress={() => setCartVisible(true)}
          style={({ pressed }) => [
            styles.cartBar,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={styles.cartBarLeft}>
            <Ionicons name="cart" size={22} color={colors.primaryContrast} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totals.totalQuantity}</Text>
            </View>
          </View>
          <Text style={[styles.cartBarLabel, { color: colors.primaryContrast }]}>{t('cart.viewCart')}</Text>
          <Text style={[styles.cartBarTotal, { color: colors.primaryContrast }]}>
            {formatCurrency(totals.total.amount, currency)}
          </Text>
        </Pressable>
      )}

      {/* ورقة إدخال الباركود اليدوية (الكاميرا لاحقًا) */}
      <BottomSheet visible={scanVisible} onClose={() => setScanVisible(false)} title={t('pos.scanTitle')}>
        <Text style={[styles.scanNote, { color: colors.textSubtle }]}>{t('pos.scanNote')}</Text>
        <Input
          value={barcodeInput}
          onChangeText={setBarcodeInput}
          placeholder="6291000000011"
          keyboardType="number-pad"
          autoFocus
          leftIcon="#"
          accessibilityLabel={t('pos.scanTitle')}
        />
        <Button label={t('pos.lookupBarcode')} icon="search" onPress={handleBarcodeSubmit} />
        <Button label={t('common.cancel')} variant="secondary" onPress={() => setScanVisible(false)} />
      </BottomSheet>

      {/* ورقة مراجعة السلة (PHASE 12) */}
      <CartSheet visible={cartVisible} onClose={() => setCartVisible(false)} />
    </Screen>
  );
}

// أنماط الشاشة.
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  searchFlex: { flex: 1 },
  scanBtn: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flex: 1 },
  skelCell: { width: '48.5%' },
  row: { gap: spacing.md },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing['5xl'], gap: spacing.md },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  footerText: { fontSize: fontSize.sm, flex: 1 },
  // شريط السلة النشط.
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: -8,
    marginTop: -12,
    paddingHorizontal: 5,
  },
  cartBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '800' },
  cartBarLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '800' },
  cartBarTotal: { fontSize: fontSize.md, fontWeight: '800' },
  scanNote: { fontSize: fontSize.sm, lineHeight: 20 },
});
