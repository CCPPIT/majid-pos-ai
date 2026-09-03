/**
 * شاشة سجل التدقيق (Audit Trail) — PHASE 27.
 * تعرض سجل الأحداث غير القابل للتعديل (append-only): عمليات البيع/الدفع/المخزون
 * وأحداث الأمان (قفل/فتح/خروج/إعدادات)، مع فلترة بالمجال والبحث وعدّادات
 * ملخص. الوصول محمي بصلاحية `audit.read` (إخفاء + حجب عبر PermissionGuard).
 * حالات التحميل/الخطأ/الفراغ مغطّاة؛ لا نصوص ثابتة (i18n).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { SearchInput } from '@/design-system/primitives/SearchInput';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { auditRepository } from '@/shared/container';
import { LIST_PERFORMANCE, stableKey } from '@/shared/performance/list';
import type { AuditCategory, AuditEntry, AuditSummary } from '@/domain/audit';

// أيقونة لكل مجال.
const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sales: 'cart-outline',
  payments: 'card-outline',
  inventory: 'layers-outline',
  catalog: 'cube-outline',
  customers: 'people-outline',
  procurement: 'business-outline',
  finance: 'wallet-outline',
  hr: 'person-circle-outline',
  security: 'shield-checkmark-outline',
};

// نبرة اللون حسب الأهمية.
function severityTone(severity: AuditEntry['severity']): Tone {
  if (severity === 'security') return 'danger';
  if (severity === 'sensitive') return 'warning';
  return 'info';
}

type LoadState = 'loading' | 'ready' | 'error'; // حالات التحميل.
type FilterTab = AuditCategory; // تبويب الفلترة (all + المجالات الموجودة).

const TABS: FilterTab[] = ['all', 'sales', 'payments', 'inventory', 'catalog', 'customers', 'procurement', 'finance', 'hr', 'security'];

export function AuditScreen() {
  const router = useRouter(); // التنقل.
  const { t } = useTranslation(); // الترجمة (التواريخ تُحلّ داخل صفّ memo).
  const { colors } = useTheme(); // الثيم.
  const { state } = useBootstrap(); // الجلسة (للصلاحيات).
  const permissions = state.session?.permissions ?? []; // الصلاحيات.

  const [entries, setEntries] = useState<AuditEntry[]>([]); // المدخلات الكاملة.
  const [summary, setSummary] = useState<AuditSummary | null>(null); // الملخص.
  const [status, setStatus] = useState<LoadState>('loading'); // الحالة.
  const [refreshing, setRefreshing] = useState(false); // سحب للتحديث.
  const [tab, setTab] = useState<FilterTab>('all'); // مجال الفلترة.
  const [search, setSearch] = useState(''); // نص البحث.

  // تحميل السجل.
  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([auditRepository.list(), auditRepository.summary()]);
      setEntries(list);
      setSummary(sum);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // تحميل أولي (نمط promise لتفادي setState متزامن في الأثر).
  useEffect(() => {
    Promise.resolve().then(() => load()).catch(() => setStatus('error'));
  }, [load]);

  // تطبيق الفلترة محليًا (المدخلات محمّلة أصلًا).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (tab !== 'all' && e.category !== tab) return false;
      if (q) {
        const hay = `${e.entityRef ?? ''} ${e.actorLabel} ${e.action} ${t(e.summaryKey, e.summaryParams)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, tab, search, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // صف مدخلة (مكوّن مغلّف بـ memo عبر AuditRow) — مرجع ثابت لـ renderItem.
  const renderItem = useCallback(
    ({ item }: { item: AuditEntry }) => <AuditRow item={item} />,
    [],
  );

  return (
    <PermissionGuard permissions={permissions} required="audit.read">
      <Screen edges={['top']} padded={false}>
        {/* الترويسة */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('audit.title')}</Text>
        </View>

        {status === 'error' ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('audit.errorTitle')}
            description={t('audit.errorBody')}
            actionLabel={t('common.retry')}
            onAction={() => void load()}
          />
        ) : (
          <>
            {/* شريط البحث */}
            <View style={styles.searchWrap}>
              <SearchInput value={search} onChangeText={setSearch} placeholder={t('audit.searchPlaceholder')} />
            </View>

            {/* عدّادات سريعة */}
            {summary ? (
              <View style={styles.statsRow}>
                <Stat label={t('audit.statTotal')} value={summary.total} tone="info" />
                <Stat label={t('audit.statSecurity')} value={summary.securityCount} tone="danger" />
                <Stat label={t('audit.statSensitive')} value={summary.bySeverity.sensitive ?? 0} tone="warning" />
              </View>
            ) : null}

            {/* تبويبات المجال */}
            <FlatList
              horizontal
              data={TABS}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
              renderItem={({ item: category }) => {
                const active = tab === category;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setTab(category)}
                    style={[styles.tab, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }]}
                  >
                    <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSubtle }]}>{t(`audit.category.${category}`)}</Text>
                  </Pressable>
                );
              }}
            />

            {status === 'loading' ? (
              <View style={styles.center}><Spinner size="large" /></View>
            ) : (
              <FlatList
                data={visible}
                keyExtractor={stableKey}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                initialNumToRender={LIST_PERFORMANCE.initialNumToRender}
                maxToRenderPerBatch={LIST_PERFORMANCE.maxToRenderPerBatch}
                windowSize={LIST_PERFORMANCE.windowSize}
                removeClippedSubviews={LIST_PERFORMANCE.removeClippedSubviews}
                updateCellsBatchingPeriod={LIST_PERFORMANCE.updateCellsBatchingPeriod}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListEmptyComponent={
                  <EmptyState icon="file-tray-outline" title={t('audit.emptyTitle')} description={t('audit.emptyBody')} />
                }
              />
            )}
          </>
        )}
      </Screen>
    </PermissionGuard>
  );
}

// صف تدقيق واحد — مغلّف بـ React.memo لتخطّي إعادة الرسم عند تغير عناصر أخرى
// في القائمة (يُعاد الرسم فقط عندما يتغير كائن المدخلة نفسها، وهو نادر لأنه
// سجل append-only). يقرأ الثيم/الترجمة بنفسه فلا يعتمد على تابع مُمرَّر.
const AuditRow = memo(function AuditRow({ item }: { item: AuditEntry }) {
  const { colors } = useTheme();
  const { t, formatDateTime } = useTranslation();
  const tone = severityTone(item.severity);
  const palette = toneColors(colors, tone);
  const icon = CATEGORY_ICON[item.category] ?? 'ellipse-outline';
  // نترجم طريقة الفتح (pin/biometric) إن وُجدت في المعاملات.
  const params: Record<string, string | number> = { ...item.summaryParams };
  if (params.method === 'pin' || params.method === 'biometric') {
    params.method = t(`audit.method.${params.method}`);
  }
  return (
    <Card glass style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: palette.soft }]}>
          <Ionicons name={icon} size={18} color={palette.strong} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {t(item.summaryKey, params)}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {formatDateTime(item.occurredAt)}
            </Text>
          </View>
          <Text style={[styles.actor, { color: colors.textSubtle }]} numberOfLines={1}>
            {t('audit.actor')}: {item.actorLabel}
          </Text>
        </View>
      </View>
    </Card>
  );
});

// بطاقة عدّاد صغيرة.
function Stat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const { colors } = useTheme();
  const palette = toneColors(colors, tone);
  return (
    <Card glass style={styles.statCard}>
      <Text style={[styles.statValue, { color: palette.strong }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize['2xl'], fontWeight: '800' },
  searchWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 2 },
  statValue: { fontSize: fontSize.xl, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  tabs: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tabText: { fontSize: fontSize.xs, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center' },
  list: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing['6xl'] },
  card: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.sm, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 10 },
  actor: { fontSize: 10, fontWeight: '700' },
});
