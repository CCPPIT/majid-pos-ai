/**
 * شاشة المالية والمحاسبة (PHASE 20).
 * تقرير مشتق من أحداث حقيقية: إيراد المبيعات، تكلفة المشتريات، المصاريف،
 * الضريبة، ومجمل/صافي الربح، مع فلترة بالفترة الزمنية وسجل قيود.
 * إضافة المصاريف محمية بصلاحية finance.manage.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Tabs } from '@/design-system/primitives/Tabs';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { financeRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import type { FinanceEntry, FinancePeriod, FinanceSummary } from '@/domain/finance';
import { ExpenseFormSheet } from './ExpenseFormSheet';

type ListStatus = 'loading' | 'ready' | 'error';

// أيقونة/نغمة لكل نوع قيد.
function entryVisual(type: FinanceEntry['type']): { icon: string; tone: Tone; sign: string } {
  switch (type) {
    case 'sale': return { icon: 'cart-outline', tone: 'success', sign: '+' };
    case 'sale_tax': return { icon: 'receipt-outline', tone: 'info', sign: '+' };
    case 'purchase': return { icon: 'cube-outline', tone: 'warning', sign: '−' };
    case 'purchase_tax': return { icon: 'receipt-outline', tone: 'warning', sign: '−' };
    case 'expense': return { icon: 'cash-outline', tone: 'danger', sign: '−' };
  }
}

function FinanceManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency, formatDateTime } = useTranslation();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];

  // الصلاحيات (إخفاء + إنفاذ).
  const canManage = hasPermission(permissions, 'finance.manage');

  const [period, setPeriod] = useState<FinancePeriod>('today');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [expenseVisible, setExpenseVisible] = useState(false);

  const currency = tenancy.context?.currency ?? 'YER';

  // تحميل التقرير للفترة.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const report = await financeRepository.getReport(
        period,
        { storeId: tenancy.context?.storeId, branchId: tenancy.context?.branchId },
        { currency },
      );
      setSummary(report.summary);
      setEntries(report.entries);
      setStatus('ready');
    } catch (error) {
      logger.error('Finance report failed', { error: String(error) });
      setStatus('error');
    }
  }, [period, tenancy.context, currency]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Finance effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // إضافة مصروف.
  const handleAddExpense = async (draft: import('@/domain/finance').ExpenseDraft) => {
    if (!canManage) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    await financeRepository.addExpense(draft, {
      tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
      organizationId: tenancy.context?.organizationId,
      branchId: tenancy.context?.branchId,
      storeId: tenancy.context?.storeId,
      userId: state.session?.user?.id,
      currency,
    });
    toast.show(t('finance.expenseAdded'), 'success');
    await load();
  };

  // صف قيد مالي.
  const renderEntry = ({ item }: { item: FinanceEntry }) => {
    const visual = entryVisual(item.type);
    const palette = toneColors(colors, visual.tone);
    return (
      <Card glass style={styles.entryCard}>
        <View style={[styles.entryIcon, { backgroundColor: palette.soft }]}>
          <Ionicons name={visual.icon as never} size={20} color={palette.strong} />
        </View>
        <View style={styles.entryInfo}>
          <Text style={[styles.entryAccount, { color: colors.text }]} numberOfLines={1}>{t(item.account)}</Text>
          <Text style={[styles.entryMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {item.reference} · {formatDateTime(item.at)}
          </Text>
        </View>
        <Text style={[styles.entryAmount, { color: palette.strong }]}>
          {visual.sign} {formatCurrency(item.amount.amount, item.amount.currency)}
        </Text>
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
          <Text style={[styles.title, { color: colors.text }]}>{t('finance.title')}</Text>
        </View>
        <Tabs
          activeKey={period}
          onChange={(k) => setPeriod(k as FinancePeriod)}
          items={[
            { key: 'today', label: t('finance.period.today') },
            { key: 'week', label: t('finance.period.week') },
            { key: 'month', label: t('finance.period.month') },
            { key: 'all', label: t('finance.period.all') },
          ]}
        />
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2].map((i) => <Skeleton key={i} height={90} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('finance.errorTitle')} description={t('finance.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
          ListHeaderComponent={
            summary ? (
              <View style={{ gap: spacing.md }}>
                {/* بطاقة الربح الرئيسية */}
                <Card glass style={styles.heroCard}>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{t('finance.netProfit')}</Text>
                  <Text
                    style={[
                      styles.heroValue,
                      { color: summary.netProfit.amount >= 0 ? colors.success ?? colors.primary : colors.danger },
                    ]}
                  >
                    {formatCurrency(summary.netProfit.amount, summary.netProfit.currency)}
                  </Text>
                  <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                    {t('finance.transactionsCount', { count: summary.transactionCount })}
                  </Text>
                </Card>

                {/* شبكة المؤشرات */}
                <View style={styles.grid}>
                  <Metric label={t('finance.revenue')} value={formatCurrency(summary.revenue.amount, currency)} icon="trending-up" color={colors.primary} />
                  <Metric label={t('finance.grossProfit')} value={formatCurrency(summary.grossProfit.amount, currency)} icon="pulse" color={colors.success ?? colors.primary} />
                  <Metric label={t('finance.purchasesCost')} value={formatCurrency(summary.purchasesCost.amount, currency)} icon="cube" color={colors.warning} />
                  <Metric label={t('finance.expenses')} value={formatCurrency(summary.expenses.amount, currency)} icon="cash" color={colors.danger} />
                  <Metric label={t('finance.taxCollected')} value={formatCurrency(summary.taxCollected.amount, currency)} icon="receipt" color={colors.info ?? colors.primary} />
                  <Metric label={t('finance.taxPaid')} value={formatCurrency(summary.taxPaid.amount, currency)} icon="receipt" color={colors.warning} />
                  <Metric label={t('finance.cashIn')} value={formatCurrency(summary.cashIn.amount, currency)} icon="arrow-down-circle" color={colors.success ?? colors.primary} />
                  <Metric label={t('finance.cashOut')} value={formatCurrency(summary.cashOut.amount, currency)} icon="arrow-up-circle" color={colors.danger} />
                </View>

                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('finance.transactionsTitle')}</Text>
                {entries.length === 0 ? (
                  <EmptyState icon="document-text-outline" title={t('finance.emptyTitle')} description={t('finance.emptyDescription')} />
                ) : null}
              </View>
            ) : null
          }
        />
      )}

      {/* زر إضافة مصروف */}
      {canManage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('finance.addExpense')}
          onPress={() => setExpenseVisible(true)}
          style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="add" size={28} color={colors.primaryContrast} />
        </Pressable>
      ) : null}

      <ExpenseFormSheet visible={expenseVisible} onClose={() => setExpenseVisible(false)} onSave={handleAddExpense} />
    </Screen>
  );
}

// بطاقة مؤشر صغيرة.
function Metric({ label, value, icon, color }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  const { colors } = useTheme();
  return (
    <Card glass style={styles.metricCard}>
      <View style={styles.metricHead}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.metricLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </Card>
  );
}

// الشاشة الخارجية: تفرض صلاحية قراءة المالية.
export function FinanceScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="finance.read">
      <FinanceManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  heroCard: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: 4 },
  heroLabel: { fontSize: fontSize.sm, fontWeight: '700' },
  heroValue: { fontSize: fontSize['3xl'] ?? 32, fontWeight: '900' },
  heroSub: { fontSize: fontSize.xs, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '48%', borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricLabel: { fontSize: fontSize.xs, fontWeight: '700', flexShrink: 1 },
  metricValue: { fontSize: fontSize.md, fontWeight: '900' },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '800', marginTop: spacing.sm },
  entryCard: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  entryIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, gap: 2 },
  entryAccount: { fontSize: fontSize.sm, fontWeight: '800' },
  entryMeta: { fontSize: 10 },
  entryAmount: { fontSize: fontSize.sm, fontWeight: '900' },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    end: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
