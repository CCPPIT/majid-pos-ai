/**
 * شاشة لوحة التحكم الديناميكية (PHASE 10).
 * ترويسة (تحية + المتجر النشط + زر تحديث)، ثم العناصر المفلترة بالصلاحية
 * مع حالات موحدة: تحميل (هياكل عظمية) · خطأ (إعادة محاولة) · فراغ · بيانات.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import type { DashboardRepository } from '@/data/repositories/dashboard.repository';
import { DashboardGrid } from './DashboardGrid';
import { useDashboard } from './useDashboard';

// خصائص الشاشة (المستودع يُحقن من الجذر).
interface DashboardScreenProps {
  repository: DashboardRepository;
}

export function DashboardScreen({ repository }: DashboardScreenProps) {
  const { t } = useTranslation(); // الترجمة.
  const { colors } = useTheme(); // الألوان.
  const { state } = useBootstrap(); // الجلسة (للاسم والصلاحيات).
  const permissions = state.session?.permissions ?? []; // صلاحيات الدور.
  const dashboard = useDashboard(repository, permissions); // بيانات اللوحة.
  const user = state.session?.user;

  return (
    <Screen edges={['top']} padded={false}>
      {/* الترويسة */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{t('home.welcome')}، {user?.fullName ?? '—'} 👋</Text>
            <Text style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>
              {dashboard.contextStoreName || '—'}
            </Text>
            {dashboard.contextBranchName ? (
              <Text style={[styles.branchName, { color: colors.textSubtle }]} numberOfLines={1}>
                {t('tenancy.context', { store: dashboard.contextStoreName, branch: dashboard.contextBranchName })}
              </Text>
            ) : null}
          </View>
          {/* زر التحديث اليدوي */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.refresh')}
            onPress={() => void dashboard.refresh()}
            style={({ pressed }) => [styles.refreshBtn, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* المحتوى حسب الحالة */}
      {dashboard.status.kind === 'loading' ? (
        <LoadingSkeleton />
      ) : dashboard.status.kind === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('dashboard.errorTitle')}
            description={t(dashboard.status.messageKey)}
            actionLabel={t('common.retry')}
            onAction={() => void dashboard.refresh()}
          />
        </View>
      ) : dashboard.status.kind === 'empty' ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="grid-outline"
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDescription')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            // داخل فرع البيانات لا نعرض حالة تحميل مدمجة؛ السحب يُعيد الجلب.
            <RefreshControl refreshing={false} onRefresh={() => void dashboard.refresh()} tintColor={colors.primary} />
          }
        >
          <DashboardGrid widgets={dashboard.widgets} metrics={dashboard.status.snapshot.metrics} currency={dashboard.currency} />
          {/* تذييل صادق: البيانات الحالية تجريبية حتى ربط الخادم */}
          <Card glass style={styles.demoCard}>
            <View style={styles.demoRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSubtle} />
              <Text style={[styles.demoText, { color: colors.textSubtle }]}>{t('dashboard.demoNotice')}</Text>
            </View>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

// هياكل عظمية أثناء التحميل (صف كبير + صفّان من الأزواج).
function LoadingSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Skeleton height={148} radiusToken="xl" />
      <View style={styles.row}>
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
      </View>
      <Skeleton height={148} radiusToken="xl" />
      <View style={styles.row}>
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
      </View>
      <View style={styles.row}>
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
        <Skeleton height={132} radiusToken="xl" style={styles.flex} />
      </View>
    </ScrollView>
  );
}

// أنماط الشاشة.
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  greeting: { fontSize: fontSize.sm, fontWeight: '600' },
  storeName: { fontSize: fontSize['2xl'], fontWeight: '800' },
  branchName: { fontSize: fontSize.xs },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['5xl'] },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  demoCard: { padding: spacing.md, marginTop: spacing.xs },
  demoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  demoText: { fontSize: fontSize.xs, flex: 1, lineHeight: 18 },
});
