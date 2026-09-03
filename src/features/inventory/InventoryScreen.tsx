/**
 * شاشة المخزون (PHASE 17).
 * تبويبان: مستويات المخزون (كل المنتجات بكمياتها وحالتها وقيمتها التقديرية)
 * وسجل الحركات (استلام/تسوية/تحويل). تنفيذ الحركات محمي بالصلاحيات
 * (inventory.adjust / inventory.transfer) — إخفاء + إنفاذ.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { SearchInput } from '@/design-system/primitives/SearchInput';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Badge } from '@/design-system/primitives/Badge';
import { Tabs } from '@/design-system/primitives/Tabs';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { inventoryRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import type { InventoryLevel, InventoryMovement, InventoryMovementType } from '@/domain/inventory/types';
import { InventoryActionSheet, type InventoryAction } from './InventoryActionSheet';

type ListStatus = 'loading' | 'ready' | 'error';
type TabKey = 'levels' | 'movements';

// أيقونة ولون وملصق لكل نوع حركة.
function movementVisual(type: InventoryMovementType): { icon: string; tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral' } {
  switch (type) {
    case 'receive':
    case 'transfer_in':
    case 'return':
      return { icon: 'arrow-down-circle-outline', tone: 'success' };
    case 'transfer_out':
      return { icon: 'swap-horizontal-outline', tone: 'info' };
    case 'sale':
      return { icon: 'cart-outline', tone: 'neutral' };
    case 'adjust':
      return { icon: 'clipboard-outline', tone: 'warning' };
  }
}

function InventoryManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? []; // صلاحيات الجلسة.

  // الصلاحيات (إخفاء + إنفاذ).
  const canAdjust = hasPermission(permissions, 'inventory.adjust');
  const canTransfer = hasPermission(permissions, 'inventory.transfer');

  const [tab, setTab] = useState<TabKey>('levels');
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [summary, setSummary] = useState<{ total: number; inStock: number; lowStock: number; outOfStock: number; stockValue: number } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListStatus>('loading');
  const [sheet, setSheet] = useState<{ action: InventoryAction; level: InventoryLevel } | null>(null);

  // تحميل المستويات والملخص.
  const loadLevels = useCallback(async () => {
    const query = {
      search: search.trim() || undefined,
      storeId: tenancy.context?.storeId,
      branchId: tenancy.context?.branchId,
    };
    const [list, sum] = await Promise.all([
      inventoryRepository.listLevels(query),
      inventoryRepository.summary({ storeId: query.storeId, branchId: query.branchId }),
    ]);
    setLevels(list);
    setSummary(sum);
  }, [search, tenancy.context]);

  // تحميل سجل الحركات.
  const loadMovements = useCallback(async () => {
    const list = await inventoryRepository.listMovements(60);
    setMovements(list);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      await Promise.all([loadLevels(), loadMovements()]);
      setStatus('ready');
    } catch (error) {
      logger.error('Inventory load failed', { error: String(error) });
      setStatus('error');
    }
  }, [loadLevels, loadMovements]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Inventory effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // تنفيذ حركة من الورقة.
  const handleSubmit = async (values: { quantity: number; reason: string; reference: string; toStoreId: string }) => {
    if (!sheet) return;
    const ctx = {
      tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
      storeId: tenancy.context?.storeId,
      branchId: tenancy.context?.branchId,
      userId: state.session?.user?.id,
    };
    const productId = sheet.level.productId;

    if (sheet.action === 'receive') {
      if (!canAdjust) { toast.show(t('accessDenied.message'), 'danger'); return; }
      await inventoryRepository.receiveStock({ productId, quantity: values.quantity, reason: values.reason, reference: values.reference, storeId: tenancy.context?.storeId, branchId: tenancy.context?.branchId }, ctx);
      toast.show(t('inventory.received'), 'success');
    } else if (sheet.action === 'adjust') {
      if (!canAdjust) { toast.show(t('accessDenied.message'), 'danger'); return; }
      await inventoryRepository.adjustStock({ productId, newQuantity: values.quantity, reason: values.reason, reference: values.reference, storeId: tenancy.context?.storeId, branchId: tenancy.context?.branchId }, ctx);
      toast.show(t('inventory.adjusted'), 'success');
    } else {
      if (!canTransfer) { toast.show(t('accessDenied.message'), 'danger'); return; }
      if (!tenancy.context?.storeId) { toast.show(t('inventory.error.needStore'), 'danger'); return; }
      await inventoryRepository.transferStock(
        {
          productId,
          quantity: values.quantity,
          fromStoreId: tenancy.context.storeId,
          toStoreId: asId(values.toStoreId),
          reason: values.reason,
          storeId: tenancy.context?.storeId,
          branchId: tenancy.context?.branchId,
        },
        ctx,
      );
      toast.show(t('inventory.transferred'), 'success');
    }
    await load();
  };

  // شارة الحالة.
  const statusBadge = (statusKey: InventoryLevel['status']) => {
    const map = { out_of_stock: { key: 'pos.outOfStock', tone: 'danger' as const }, low_stock: { key: 'pos.lowStock', tone: 'warning' as const }, in_stock: { key: 'pos.inStock', tone: 'success' as const } };
    const info = map[statusKey];
    return <Badge label={t(info.key)} tone={info.tone} />;
  };

  // صف مستوى مخزون.
  const renderLevel = ({ item }: { item: InventoryLevel }) => {
    const name = locale === 'ar' ? item.nameAr : item.nameEn;
    return (
      <Card glass style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="cube-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.barcode, { color: colors.textSubtle }]} numberOfLines={1}>{item.barcode}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.qty, { color: colors.text }]}>{t('inventory.quantity')}: {item.quantity}</Text>
              {statusBadge(item.status)}
            </View>
            <Text style={[styles.value, { color: colors.textMuted }]}>
              {t('inventory.stockValue')}: {formatCurrency(item.stockValue, item.currency)}
            </Text>
          </View>
        </View>
        {(canAdjust || canTransfer) ? (
          <View style={styles.actions}>
            {canAdjust ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.receive')} onPress={() => setSheet({ action: 'receive', level: item })}
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="arrow-down-circle-outline" size={17} color={colors.success ?? colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>{t('inventory.receive')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.adjust')} onPress={() => setSheet({ action: 'adjust', level: item })}
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="clipboard-outline" size={17} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>{t('inventory.adjust')}</Text>
                </Pressable>
              </>
            ) : null}
            {canTransfer ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.transfer')} onPress={() => setSheet({ action: 'transfer', level: item })}
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="swap-horizontal-outline" size={17} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>{t('inventory.transfer')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  // صف حركة مخزون.
  const renderMovement = ({ item }: { item: InventoryMovement }) => {
    const level = levels.find((l) => String(l.productId) === String(item.productId));
    const productName = level ? (locale === 'ar' ? level.nameAr : level.nameEn) : String(item.productId);
    const visual = movementVisual(item.type);
    const palette = toneColors(colors, visual.tone);
    const typeLabel = t(`inventory.move.${item.type}`);
    const effectText = item.type === 'adjust' ? `= ${item.resultingQuantity}` : `${item.type === 'sale' || item.type === 'transfer_out' ? '−' : '+'}${item.quantity}`;
    return (
      <Card glass style={styles.moveCard}>
        <View style={[styles.moveIcon, { backgroundColor: palette.soft }]}>
          <Ionicons name={visual.icon as never} size={20} color={palette.strong} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{productName}</Text>
          <Text style={[styles.barcode, { color: colors.textSubtle }]} numberOfLines={1}>{typeLabel} · {item.reason}</Text>
        </View>
        <View style={styles.moveEnd}>
          <Text style={[styles.moveQty, { color: palette.strong }]}>{effectText}</Text>
          <Text style={[styles.barcode, { color: colors.textSubtle }]}>{t('inventory.after')}: {item.resultingQuantity}</Text>
        </View>
      </Card>
    );
  };

  const currency = tenancy.context?.currency ?? 'YER';

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('inventory.title')}</Text>
        </View>

        {/* بطاقات الملخص */}
        {summary ? (
          <View style={styles.summaryRow}>
            <SummaryStat label={t('inventory.statTotal')} value={String(summary.total)} icon="cube-outline" color={colors.primary} />
            <SummaryStat label={t('inventory.statLow')} value={String(summary.lowStock)} icon="alert-circle-outline" color={colors.warning} />
            <SummaryStat label={t('inventory.statOut')} value={String(summary.outOfStock)} icon="close-circle-outline" color={colors.danger} />
            <SummaryStat label={t('inventory.statValue')} value={formatCurrency(summary.stockValue, currency)} icon="cash-outline" color={colors.success ?? colors.primary} small />
          </View>
        ) : null}

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            { key: 'levels', label: t('inventory.tabLevels'), icon: 'list' },
            { key: 'movements', label: t('inventory.tabMovements'), icon: 'time' },
          ]}
        />

        {tab === 'levels' ? <SearchInput value={search} onChangeText={setSearch} placeholder={t('inventory.searchPh')} /> : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('inventory.errorTitle')} description={t('inventory.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : tab === 'levels' ? (
        levels.length === 0 ? (
          <View style={styles.stateWrap}>
            <EmptyState icon="cube-outline" title={t('inventory.emptyTitle')} description={t('inventory.emptyDescription')} />
          </View>
        ) : (
          <FlatList
            data={levels}
            keyExtractor={(item) => String(item.productId)}
            renderItem={renderLevel}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
          />
        )
      ) : movements.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="time-outline" title={t('inventory.noMovementsTitle')} description={t('inventory.noMovementsDescription')} />
        </View>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMovement}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
        />
      )}

      {/* ورقة تنفيذ الحركة */}
      {sheet ? (
        <InventoryActionSheet
          key={`${sheet.action}-${String(sheet.level.productId)}`}
          visible={!!sheet}
          onClose={() => setSheet(null)}
          action={sheet.action}
          productName={locale === 'ar' ? sheet.level.nameAr : sheet.level.nameEn}
          currentQuantity={sheet.level.quantity}
          onSubmit={handleSubmit}
        />
      ) : null}
    </Screen>
  );
}

// بطاقة إحصائية صغيرة في الملخص.
function SummaryStat({ label, value, icon, color, small }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <Card glass style={styles.statCard}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.statValue, { color: colors.text }, small && styles.statValueSmall]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

// الشاشة الخارجية: تفرض صلاحية قراءة المخزون على مستوى الشاشة.
export function InventoryScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="inventory.read">
      <InventoryManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', gap: 2, minWidth: 0 },
  statValue: { fontSize: fontSize.md, fontWeight: '900' },
  statValueSmall: { fontSize: fontSize.sm },
  statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  moveCard: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  moveIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: '800' },
  barcode: { fontSize: fontSize.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  qty: { fontSize: fontSize.sm, fontWeight: '800' },
  value: { fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },
  moveEnd: { alignItems: 'flex-end', gap: 2 },
  moveQty: { fontSize: fontSize.lg, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  actionText: { fontSize: fontSize.sm, fontWeight: '700' },
});
