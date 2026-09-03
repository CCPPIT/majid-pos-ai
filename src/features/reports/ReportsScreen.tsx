/**
 * شاشة التقارير والتحليلات (PHASE 22).
 * مؤشرات مبيعات لفترة مختارة، رسم أعمدة بسيط (View-only)، توزيع طرق الدفع،
 * الأكثر مبيعًا، ونسبة النمو. الأرقام كلها من مجال التقارير (لا حساب في الواجهة).
 * المشاركة (Share) تُصدّر تقريرًا نصيًا — بلا تزوير.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Tabs } from '@/design-system/primitives/Tabs';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Button } from '@/design-system/primitives/Button';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { reportsRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { hasPermission } from '@/security/permissions/permission';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { reportToText, type ReportPeriod, type SalesReport } from '@/domain/reports';

type ListStatus = 'loading' | 'ready' | 'error';

function ReportsManager() {
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  const canExport = hasPermission(permissions, 'reports.export');

  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [report, setReport] = useState<SalesReport | null>(null);
  const [status, setStatus] = useState<ListStatus>('loading');

  const currency = tenancy.context?.currency ?? 'YER';

  // تحميل التقرير للفترة.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await reportsRepository.getSalesReport(
        period,
        { storeId: tenancy.context?.storeId, branchId: tenancy.context?.branchId },
        currency,
      );
      setReport(result);
      setStatus('ready');
    } catch (error) {
      logger.error('Reports load failed', { error: String(error) });
      setStatus('error');
    }
  }, [period, tenancy.context, currency]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Reports effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // مشاركة التقرير نصيًا.
  const handleShare = async () => {
    if (!report) return;
    const text = reportToText(report, {
      title: t('reports.shareTitle'),
      period: t(`reports.period.${report.period}`),
      revenue: t('reports.revenue'),
      orders: t('reports.orders'),
      paid: t('reports.paid'),
      tax: t('reports.tax'),
      discount: t('reports.discount'),
      avg: t('reports.avgOrder'),
      growth: t('reports.growth'),
      methods: t('reports.methods'),
      top: t('reports.topProducts'),
      order: t('reports.orders'),
    });
    try {
      await Share.share({ message: text });
    } catch (error) {
      logger.warn('Share report failed', { error: String(error) });
    }
  };

  // أعلى قيمة إيراد في السلسلة لتحجيم الأعمدة.
  const maxRevenue = Math.max(1, ...(report?.series.map((s) => s.revenue.amount) ?? [1]));

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.title')}</Text>
        <Tabs
          activeKey={period}
          onChange={(k) => setPeriod(k as ReportPeriod)}
          items={[
            { key: 'today', label: t('reports.period.today') },
            { key: 'week', label: t('reports.period.week') },
            { key: 'month', label: t('reports.period.month') },
            { key: 'all', label: t('reports.period.all') },
          ]}
        />
        {canExport && report ? (
          <Button label={t('reports.share')} icon="share-social-outline" variant="secondary" onPress={() => void handleShare()} />
        ) : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2].map((i) => <Skeleton key={i} height={90} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('reports.errorTitle')} description={t('reports.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : !report || report.paidCount === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="bar-chart-outline" title={t('reports.emptyTitle')} description={t('reports.emptyDescription')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* بطاقة الإيراد الرئيسية + النمو */}
          <Card glass style={styles.heroCard}>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{t('reports.revenue')}</Text>
            <Text style={[styles.heroValue, { color: colors.primary }]}>
              {formatCurrency(report.revenue.amount, report.currency)}
            </Text>
            <View style={styles.growthRow}>
              <Ionicons
                name={report.growth >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={report.growth >= 0 ? colors.success ?? colors.primary : colors.danger}
              />
              <Text style={[styles.growthText, { color: report.growth >= 0 ? colors.success ?? colors.primary : colors.danger }]}>
                {report.growth >= 0 ? '+' : ''}{report.growth}% {t('reports.growthSuffix')}
              </Text>
            </View>
          </Card>

          {/* شبكة المؤشرات */}
          <View style={styles.grid}>
            <Metric label={t('reports.orders')} value={String(report.orderCount)} icon="receipt-outline" color={colors.primary} />
            <Metric label={t('reports.paid')} value={String(report.paidCount)} icon="checkmark-circle-outline" color={colors.success ?? colors.primary} />
            <Metric label={t('reports.avgOrder')} value={formatCurrency(report.avgOrderValue.amount, currency)} icon="calculator-outline" color={colors.info ?? colors.primary} />
            <Metric label={t('reports.tax')} value={formatCurrency(report.tax.amount, currency)} icon="document-text-outline" color={colors.warning} />
            <Metric label={t('reports.discount')} value={formatCurrency(report.discount.amount, currency)} icon="pricetag-outline" color={colors.danger} />
            <Metric label={t('reports.methods')} value={String(report.methods.length)} icon="card-outline" color={colors.primary} />
          </View>

          {/* الرسم البياني (أعمدة View-only) */}
          {report.series.length > 1 ? (
            <Card glass style={styles.chartCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.trend')}</Text>
              <View style={styles.chart}>
                {report.series.map((point) => (
                  <View key={point.dateKey} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (point.revenue.amount / maxRevenue) * 120),
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>{point.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* توزيع طرق الدفع */}
          {report.methods.length > 0 ? (
            <Card glass style={styles.sectionCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.methods')}</Text>
              {report.methods.map((m) => (
                <View key={m.method} style={styles.methodRow}>
                  <Text style={[styles.methodName, { color: colors.text }]}>{t(`pay.method${cap(m.method)}`)}</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.barFill, { width: `${m.share}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={[styles.methodShare, { color: colors.textMuted }]}>{m.share}%</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* الأكثر مبيعًا */}
          {report.topProducts.length > 0 ? (
            <Card glass style={styles.sectionCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.topProducts')}</Text>
              {report.topProducts.map((p, i) => {
                const name = locale === 'ar' ? p.nameAr : p.nameEn;
                return (
                  <View key={String(p.productId)} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.topRank, { color: colors.primary }]}>{i + 1}</Text>
                    <Text style={[styles.topName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.topQty, { color: colors.textMuted }]}>×{p.quantity}</Text>
                    <Text style={[styles.topRev, { color: colors.text }]} numberOfLines={1}>
                      {formatCurrency(p.revenue.amount, currency)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

// يجعل أول حرف كبيرًا لمفاتيح طرق الدفع (cash → Cash).
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// الشاشة الخارجية: تفرض صلاحية عرض التقارير.
export function ReportsScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="reports.view">
      <ReportsManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  heroCard: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: 4 },
  heroLabel: { fontSize: fontSize.sm, fontWeight: '700' },
  heroValue: { fontSize: 32, fontWeight: '900' },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  growthText: { fontSize: fontSize.sm, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '48%', borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricLabel: { fontSize: fontSize.xs, fontWeight: '700', flexShrink: 1 },
  metricValue: { fontSize: fontSize.md, fontWeight: '900' },
  chartCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: '800' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9 },
  sectionCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  methodName: { fontSize: fontSize.sm, fontWeight: '700', width: 64 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  methodShare: { fontSize: fontSize.xs, fontWeight: '700', width: 40, textAlign: 'right' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  topRank: { fontSize: fontSize.sm, fontWeight: '900', width: 20 },
  topName: { flex: 1, fontSize: fontSize.sm, fontWeight: '700' },
  topQty: { fontSize: fontSize.xs, fontWeight: '700' },
  topRev: { fontSize: fontSize.sm, fontWeight: '900', maxWidth: 110 },
});
