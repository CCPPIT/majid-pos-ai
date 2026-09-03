/**
 * شاشة الوكلاء الأذكياء (AI Agents) — PHASE 25.
 * تعرض رؤى الوكلاء السبعة مشتقة من بيانات حقيقية (قواعد على الجهاز، لا خادم
 * ذكاء اصطناعي بعد). كل رؤية للقراءة فقط؛ الإجراء المقترح لا يُنفَّذ تلقائيًا
 * — زر "تنفيذ" ينقل المستخدم إلى الشاشة المعنية ليتصرف بنفسه (خط الأمان يُخفي
 * الرؤى والأزرار حسب الصلاحيات). حالات التحميل/الخطأ/الفراغ مغطّاة.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { AGENT_BY_ID } from '@/domain/agents';
import { collectInsights, type AgentViewInsight } from './agents-service';
import { LIST_PERFORMANCE } from '@/shared/performance/list';

// يحوّل خطورة الرؤية إلى نغمة لونية.
function severityTone(severity: AgentViewInsight['severity']): Tone {
  switch (severity) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    case 'good': return 'success';
    default: return 'info';
  }
}

// أيقونة الخطورة.
function severityIcon(severity: AgentViewInsight['severity']): keyof typeof Ionicons.glyphMap {
  switch (severity) {
    case 'critical': return 'alert-circle';
    case 'warning': return 'warning-outline';
    case 'good': return 'checkmark-circle-outline';
    default: return 'sparkles-outline';
  }
}

type LoadState = 'loading' | 'ready' | 'error'; // حالات التحميل.

export function AgentsScreen() {
  const router = useRouter(); // التنقل.
  const { t, formatCurrency } = useTranslation(); // الترجمة وتنسيق العملة.
  const { colors } = useTheme(); // الثيم.
  const tenancy = useTenancy(); // سياق المتجر (للعملة).
  const { state } = useBootstrap(); // الجلسة (للصلاحيات).
  const currency = tenancy.context?.currency ?? 'YER'; // عملة العرض.

  const [insights, setInsights] = useState<AgentViewInsight[]>([]); // الرؤى.
  const [status, setStatus] = useState<LoadState>('loading'); // الحالة.
  const [refreshing, setRefreshing] = useState(false); // سحب للتحديث.

  // تحميل الرؤى من الخدمة.
  const load = useCallback(async () => {
    try {
      const result = await collectInsights(
        state.session?.permissions ?? [],
        { fmtMoney: (amount, cur) => formatCurrency(amount, cur ?? currency), currency },
        (key, params) => t(key, params),
      );
      setInsights(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, [state.session, formatCurrency, currency, t]);

  // تحميل أولي عبر أثر (نمط التطبيق: promise لتفادي setState متزامن).
  useEffect(() => {
    Promise.resolve()
      .then(() => load())
      .catch(() => setStatus('error'));
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // بطاقة رؤيا واحدة.
  const renderInsight = useCallback(
    ({ item }: { item: AgentViewInsight }) => {
      const tone = severityTone(item.severity);
      const palette = toneColors(colors, tone);
      const agent = AGENT_BY_ID[item.agentId];
      return (
        <Card glass style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: palette.soft }]}>
              <Ionicons name={severityIcon(item.severity)} size={20} color={palette.strong} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                <Ionicons name={agent.icon as keyof typeof Ionicons.glyphMap} size={14} color={colors.textMuted} />
              </View>
              <Text style={[styles.body, { color: colors.textSubtle }]}>{item.body}</Text>
              {item.action ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.action.label}
                  onPress={() => router.push(item.action!.route as never)}
                  style={[styles.actionBtn, { borderColor: palette.strong }]}
                >
                  <Ionicons name="arrow-forward" size={14} color={palette.strong} />
                  <Text style={[styles.actionLabel, { color: palette.strong }]}>{item.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Card>
      );
    },
    [colors, router],
  );

  // حالة الخطأ.
  if (status === 'error') {
    return (
      <Screen edges={['top']} padded>
        <Header />
        <EmptyState
          icon="cloud-offline-outline"
          title={t('agents.errorTitle')}
          description={t('agents.errorBody')}
          actionLabel={t('common.retry')}
          onAction={() => void load()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.headerWrap}>
        <Header />
        {/* تنويه أمان: الوكلاء يقترحون فقط ولا ينفّذون. */}
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted ?? colors.surface, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>{t('agents.safetyNote')}</Text>
        </View>
      </View>

      {status === 'loading' ? (
        <View style={styles.center}><Spinner size="large" /></View>
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(item) => item.id}
          renderItem={renderInsight}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          // تحسين أداء التمرير (PHASE 29): نافذة محدودة وتفريغ الصفوف خارج الشاشة.
          initialNumToRender={LIST_PERFORMANCE.initialNumToRender}
          maxToRenderPerBatch={LIST_PERFORMANCE.maxToRenderPerBatch}
          windowSize={LIST_PERFORMANCE.windowSize}
          removeClippedSubviews={LIST_PERFORMANCE.removeClippedSubviews}
          updateCellsBatchingPeriod={LIST_PERFORMANCE.updateCellsBatchingPeriod}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="sparkles-outline" title={t('agents.emptyTitle')} description={t('agents.emptyBody')} />
          }
        />
      )}
    </Screen>
  );
}

// ترويسة الشاشة (رجوع + عنوان).
function Header() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{t('agents.title')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize['2xl'], fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  noticeText: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
  center: { flex: 1, justifyContent: 'center' },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  card: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: '800', flex: 1 },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.xs },
  actionLabel: { fontSize: fontSize.xs, fontWeight: '800' },
});
