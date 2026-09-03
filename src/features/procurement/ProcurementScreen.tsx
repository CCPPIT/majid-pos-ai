/**
 * شاشة المشتريات (PHASE 18).
 * تبويبان: أوامر الشراء (مع حالاتها وإجمالياتها) والمورّدون.
 * الأزرار محمية بالصلاحيات: إنشاء أمر (procurement.create)،
 * اعتماد أمر (procurement.approve)، إدارة المورّدين (suppliers.manage).
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
import { Tabs } from '@/design-system/primitives/Tabs';
import { Button } from '@/design-system/primitives/Button';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { procurementRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from '@/domain/procurement';
import { SupplierFormSheet } from './SupplierFormSheet';

type ListStatus = 'loading' | 'ready' | 'error';
type TabKey = 'orders' | 'suppliers';

// نغمة ولون الحالة.
function statusTone(status: PurchaseOrderStatus): Tone {
  switch (status) {
    case 'draft': return 'neutral';
    case 'submitted': return 'info';
    case 'approved': return 'primary';
    case 'partially_received': return 'warning';
    case 'received': return 'success';
    case 'cancelled': return 'danger';
  }
}

function ProcurementManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? []; // صلاحيات الجلسة.

  // الصلاحيات (إخفاء + إنفاذ).
  const canCreate = hasPermission(permissions, 'procurement.create');
  const canApprove = hasPermission(permissions, 'procurement.approve');
  const canManageSuppliers = hasPermission(permissions, 'suppliers.manage');

  const [tab, setTab] = useState<TabKey>('orders');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [supplierSheet, setSupplierSheet] = useState(false); // ورقة المورّد.

  // سياق المنفّذ (الهرمية + المستخدم).
  const actorCtx = {
    tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
    organizationId: tenancy.context?.organizationId,
    branchId: tenancy.context?.branchId,
    storeId: tenancy.context?.storeId,
    userId: state.session?.user?.id,
  };

  // تحميل البيانات.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [poList, supplierList] = await Promise.all([
        procurementRepository.listPurchaseOrders(),
        procurementRepository.listSuppliers(),
      ]);
      setOrders(poList);
      setSuppliers(supplierList);
      setStatus('ready');
    } catch (error) {
      logger.error('Procurement load failed', { error: String(error) });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Procurement effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // حفظ مورّد جديد.
  const handleSupplierSave = async (draft: import('@/domain/procurement').SupplierDraft) => {
    if (!canManageSuppliers) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    await procurementRepository.createSupplier(draft, actorCtx);
    toast.show(t('procurement.supplierCreated'), 'success');
    await load();
  };

  // تقديم أمر للموافقة (إجراء سريع من القائمة).
  const handleQuickAction = async (po: PurchaseOrder, action: 'submit' | 'approve' | 'cancel') => {
    try {
      if (action === 'submit' && !canCreate) { toast.show(t('accessDenied.message'), 'danger'); return; }
      if (action === 'approve' && !canApprove) { toast.show(t('accessDenied.message'), 'danger'); return; }
      const target: PurchaseOrderStatus = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'cancelled';
      await procurementRepository.changeStatus(po.id, target, actorCtx);
      toast.show(t('procurement.statusUpdated'), 'success');
      await load();
    } catch (error) {
      toast.show(t('procurement.error.actionFailed'), 'danger');
      logger.error('PO quick action failed', { error: String(error) });
    }
  };

  // صف أمر شراء.
  const renderOrder = ({ item }: { item: PurchaseOrder }) => {
    const supplierName = locale === 'ar' ? item.supplierNameAr : item.supplierNameEn;
    const tone = statusTone(item.status);
    const palette = toneColors(colors, tone);
    return (
      <Pressable onPress={() => router.push(`/(app)/po/${String(item.id)}` as never)} accessibilityRole="button">
        <Card glass style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.titleWrap}>
              <Text style={[styles.poNumber, { color: colors.primary }]}>{item.poNumber}</Text>
              <Text style={[styles.supplier, { color: colors.text }]} numberOfLines={1}>{supplierName}</Text>
            </View>
            <Badge label={t(`procurement.status.${item.status}`)} tone={tone} />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('procurement.linesCount', { count: item.lines.length })}
            </Text>
            <Text style={[styles.total, { color: palette.strong }]}>
              {formatCurrency(item.total.amount, item.total.currency)}
            </Text>
          </View>
          {/* إجراءات سريعة حسب الحالة */}
          <View style={styles.actions}>
            {item.status === 'draft' ? (
              <>
                <Button label={t('procurement.submit')} icon="send-outline" variant="secondary" size="sm" onPress={() => void handleQuickAction(item, 'submit')} style={styles.actionFlex} />
                <Button label={t('procurement.cancel')} variant="ghost" size="sm" onPress={() => void handleQuickAction(item, 'cancel')} style={styles.actionFlex} />
              </>
            ) : item.status === 'submitted' && canApprove ? (
              <Button label={t('procurement.approve')} icon="checkmark-done-outline" variant="success" size="sm" onPress={() => void handleQuickAction(item, 'approve')} style={styles.actionFlex} />
            ) : (item.status === 'approved' || item.status === 'partially_received') ? (
              <Button label={t('procurement.receive')} icon="cube-outline" variant="primary" size="sm" onPress={() => router.push(`/(app)/po/${String(item.id)}` as never)} style={styles.actionFlex} />
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  };

  // صف مورّد.
  const renderSupplier = ({ item }: { item: Supplier }) => {
    const name = locale === 'ar' ? item.nameAr : item.nameEn;
    return (
      <Card glass style={styles.card}>
        <View style={styles.supplierRow}>
          <View style={[styles.supplierIcon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="business-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.supplierInfo}>
            <Text style={[styles.supplier, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            {item.contactName ? <Text style={[styles.meta, { color: colors.textSubtle }]} numberOfLines={1}>{item.contactName}</Text> : null}
            <Text style={[styles.meta, { color: colors.textSubtle }]} numberOfLines={1}>{item.phone ?? item.email ?? '—'}</Text>
          </View>
          {item.active ? <Badge label={t('procurement.active')} tone="success" /> : <Badge label={t('procurement.inactive')} tone="neutral" />}
        </View>
      </Card>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('procurement.title')}</Text>
        </View>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            { key: 'orders', label: t('procurement.tabOrders'), icon: 'document' },
            { key: 'suppliers', label: t('procurement.tabSuppliers'), icon: 'people' },
          ]}
        />
        {canCreate && tab === 'orders' ? (
          <Button label={t('procurement.newOrder')} icon="add-circle-outline" variant="primary" onPress={() => router.push('/(app)/po/new' as never)} />
        ) : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2].map((i) => <Skeleton key={i} height={100} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('procurement.errorTitle')} description={t('procurement.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : tab === 'orders' ? (
        orders.length === 0 ? (
          <View style={styles.stateWrap}>
            <EmptyState icon="document-outline" title={t('procurement.emptyOrdersTitle')} description={t('procurement.emptyOrdersDescription')}
              actionLabel={canCreate ? t('procurement.newOrder') : undefined}
              onAction={canCreate ? () => router.push('/(app)/po/new' as never) : undefined} />
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderOrder}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
          />
        )
      ) : suppliers.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="business-outline" title={t('procurement.emptySuppliersTitle')} description={t('procurement.emptySuppliersDescription')}
            actionLabel={canManageSuppliers ? t('procurement.addSupplier') : undefined}
            onAction={canManageSuppliers ? () => setSupplierSheet(true) : undefined} />
        </View>
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSupplier}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
          ListFooterComponent={
            canManageSuppliers ? (
              <Button label={t('procurement.addSupplier')} icon="add-circle-outline" variant="secondary" onPress={() => setSupplierSheet(true)} />
            ) : null
          }
        />
      )}

      {/* ورقة إضافة مورّد */}
      <SupplierFormSheet
        visible={supplierSheet}
        onClose={() => setSupplierSheet(false)}
        currency={tenancy.context?.currency ?? 'YER'}
        onSave={handleSupplierSave}
      />
    </Screen>
  );
}

// الشاشة الخارجية: تفرض صلاحية قراءة المشتريات.
export function ProcurementScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="procurement.read">
      <ProcurementManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  titleWrap: { flex: 1, gap: 2 },
  poNumber: { fontSize: fontSize.sm, fontWeight: '900' },
  supplier: { fontSize: fontSize.md, fontWeight: '800' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: fontSize.xs },
  total: { fontSize: fontSize.md, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionFlex: { flex: 1 },
  supplierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  supplierIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  supplierInfo: { flex: 1, gap: 2 },
});
