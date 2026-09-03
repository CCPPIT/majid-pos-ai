/**
 * شاشة الطلبات (PHASESE 13).
 * تعرض طلبات البيع المخزنة (الأحدث أولًا) مفلترة بنطاق المتجر النشط،
 * مع حالات موحدة (تحميل/خطأ/فراغ) ورقم الطلب والإجمالي وحالة الدفع.
 * الدفع الفعلي لكل طلب يأتي في PHASE 14 (لافتة صادقة).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Badge } from '@/design-system/primitives/Badge';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { ordersRepository } from '@/shared/container';
import { LIST_PERFORMANCE } from '@/shared/performance/list';
import type { SaleOrder } from '@/domain/sales/types';
import { orderQuantity } from '@/domain/sales/order';
import { logger } from '@/core/logging/logger';

// حالة القائمة.
type ListStatus = 'loading' | 'ready' | 'error';

export function OrdersScreen() {
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const tenancy = useTenancy();

  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');

  // تحميل الطلبات بنطاق المتجر النشط.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await ordersRepository.listOrders({
        storeId: tenancy.context?.storeId,
        branchId: tenancy.context?.branchId,
        organizationId: tenancy.context?.organizationId,
      });
      setOrders(list);
      setStatus('ready');
    } catch (error) {
      logger.error('Orders load failed', { error: String(error) });
      setStatus('error');
    }
  }, [tenancy.context]);

  // تحميل أولي/عند جاهزية النطاق (نمط async لتفادي setState متزامن في effect).
  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Orders effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // ضغط طلب: المدفوع يفتح إيصاله (PHASE 15)، وغير المدفوع ينتقل للتحصيل (PHASE 14).
  const handleOrderPress = (order: SaleOrder) => {
    if (order.paymentStatus === 'paid') {
      router.push(`/(app)/receipt?orderId=${encodeURIComponent(String(order.id))}` as never);
      return;
    }
    router.push(`/(app)/payment?orderId=${encodeURIComponent(String(order.id))}` as never);
  };

  // بطاقة طلب واحدة.
  const renderOrder = ({ item }: { item: SaleOrder }) => {
    const qty = orderQuantity(item);
    const isPaid = item.paymentStatus === 'paid';
    const palette = toneColors(colors, isPaid ? 'success' : 'warning');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.orderNumber}`}
        accessibilityHint={t('orders.openHint')}
        onPress={() => handleOrderPress(item)}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Card glass style={styles.orderCard}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.orderNumber, { color: colors.text }]}>{item.orderNumber}</Text>
              <Badge
                label={t(isPaid ? 'orders.statusPaid' : 'orders.statusUnpaid')}
                tone={isPaid ? 'success' : 'warning'}
              />
            </View>
            <Text style={[styles.meta, { color: colors.textSubtle }]}>
              {new Date(item.createdAt).toLocaleString(locale === 'ar' ? 'ar-YE' : 'en-US')}
            </Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.customerRow}>
              <Ionicons name="person-outline" size={15} color={colors.textSubtle} />
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.customer.name} · {t('orders.itemsCount')}: {qty}
              </Text>
            </View>
            <Text style={[styles.total, { color: palette.strong }]}>
              {formatCurrency(item.total.amount, item.currency)}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('orders.title')}</Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} radiusToken="lg" />
          ))}
        </View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('orders.errorTitle')}
            description={t('orders.loadFailed')}
            actionLabel={t('common.retry')}
            onAction={() => void load()}
          />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="receipt-outline" title={t('orders.emptyTitle')} description={t('orders.emptyDescription')} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          // تحسين أداء التمرير (PHASE 29): نافذة أصغر وتفريغ الصفوف خارج الشاشة.
          initialNumToRender={LIST_PERFORMANCE.initialNumToRender}
          maxToRenderPerBatch={LIST_PERFORMANCE.maxToRenderPerBatch}
          windowSize={LIST_PERFORMANCE.windowSize}
          removeClippedSubviews={LIST_PERFORMANCE.removeClippedSubviews}
          updateCellsBatchingPeriod={LIST_PERFORMANCE.updateCellsBatchingPeriod}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['5xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  orderCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTop: { gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { fontSize: fontSize.md, fontWeight: '800' },
  meta: { fontSize: fontSize.xs },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  total: { fontSize: fontSize.lg, fontWeight: '800' },
});
