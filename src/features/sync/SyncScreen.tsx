/**
 * شاشة حالة المزامنة (PHASE 23).
 * تعرض حالة الاتصال، ملخص الطابور (معلّق/قيد الإرسال/ناجح/فاشل)، سجل الطفرات
 * الأحدث، وزر مزامنة يدوية. صادقة: لا يوجد خادم بعد، فالمزوّد محاكي محلي
 * ينجح فورًا (البيانات محفوظة على الجهاز أصلًا). الحماية بصلاحية reports.view
 * كإدارة تشغيلية (لا تكشف بيانات جديدة).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { logger } from '@/core/logging/logger';
import { useTranslation } from '@/i18n/LocaleProvider';
import { syncRepository } from '@/shared/container';
import { LIST_PERFORMANCE } from '@/shared/performance/list';
import { useSync } from './sync-context';
import { SyncStatusBar } from './SyncStatusBar';
import type { MutationRecord, MutationStatus } from '@/domain/sync/types';

// نغمة حالة الطفرة.
function statusTone(status: MutationStatus): Tone {
  switch (status) {
    case 'synced': return 'success';
    case 'pending': return 'warning';
    case 'inflight': return 'info';
    case 'failed': return 'danger';
  }
}

export function SyncScreen() {
  const router = useRouter();
  const { t, formatDateTime } = useTranslation();
  const { colors } = useTheme();
  const { connectivity, summary, syncing, syncNow, refresh } = useSync();

  const [records, setRecords] = useState<MutationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // تحميل سجل الطفرات.
  const load = useCallback(async () => {
    setLoading(true);
    const list = await syncRepository.list();
    setRecords(list.slice(0, 100));
    await refresh();
    setLoading(false);
  }, [refresh]);

  useEffect(() => {
    // نحمّل أوليًا عبر سلسلة promise لتفادي setState متزامن داخل الأثر.
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.warn('Sync screen load failed', { error: String(error) }));
  }, [load]);

  // مزامنة يدوية ثم تحديث.
  const handleSync = async () => {
    await syncNow();
    await load();
  };

  const online = connectivity !== 'offline';

  // صف طفرة.
  const renderItem = ({ item }: { item: MutationRecord }) => {
    const tone = statusTone(item.status);
    const palette = toneColors(colors, tone);
    return (
      <Card glass style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: palette.soft }]}>
            <Ionicons
              name={item.status === 'synced' ? 'cloud-done-outline' : item.status === 'failed' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
              size={18}
              color={palette.strong}
            />
          </View>
          <View style={styles.info}>
            <Text style={[styles.entity, { color: colors.text }]} numberOfLines={1}>
              {t(`sync.entity.${item.entity}`)} · {t(`sync.action.${item.action}`)}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {item.ref ?? item.localId} · {formatDateTime(item.createdAt)}
            </Text>
          </View>
          <Badge label={t(`sync.status.${item.status}`)} tone={tone} />
        </View>
      </Card>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <SyncStatusBar />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('sync.title')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><Spinner size="large" /></View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          // تحسين أداء تمرير سجل الطفرات (PHASE 29).
          initialNumToRender={LIST_PERFORMANCE.initialNumToRender}
          maxToRenderPerBatch={LIST_PERFORMANCE.maxToRenderPerBatch}
          windowSize={LIST_PERFORMANCE.windowSize}
          removeClippedSubviews={LIST_PERFORMANCE.removeClippedSubviews}
          updateCellsBatchingPeriod={LIST_PERFORMANCE.updateCellsBatchingPeriod}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void handleSync()} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              {/* حالة الاتصال */}
              <Card glass style={[styles.statusCard, { borderColor: online ? colors.success ?? colors.primary : colors.warning }]}>
                <View style={styles.statusRow}>
                  <Ionicons
                    name={online ? 'cloud-done-outline' : 'cloud-offline-outline'}
                    size={28}
                    color={online ? colors.success ?? colors.primary : colors.warning}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {online ? t('sync.online') : t('sync.offline')}
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                      {t('sync.statusHint')}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* ملخص الطابور */}
              <View style={styles.grid}>
                <Stat label={t('sync.status.pending')} value={summary.pending} tone="warning" />
                <Stat label={t('sync.status.inflight')} value={summary.inflight} tone="info" />
                <Stat label={t('sync.status.synced')} value={summary.synced} tone="success" />
                <Stat label={t('sync.status.failed')} value={summary.failed} tone="danger" />
              </View>

              <Button
                label={syncing ? t('sync.syncing') : t('sync.syncNow')}
                icon={syncing ? 'sync' : 'cloud-upload-outline'}
                variant="primary"
                loading={syncing}
                disabled={!online}
                onPress={() => void handleSync()}
              />

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('sync.queueTitle')}</Text>

              {records.length === 0 ? (
                <EmptyState icon="cloud-done-outline" title={t('sync.emptyTitle')} description={t('sync.emptyDescription')} />
              ) : null}
            </View>
          }
        />
      )}
    </Screen>
  );
}

// بطاقة رقم صغيرة.
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
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center' },
  list: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing['6xl'] },
  statusCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusTitle: { fontSize: fontSize.md, fontWeight: '800' },
  statusSub: { fontSize: fontSize.xs, marginTop: 2 },
  grid: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 2 },
  statValue: { fontSize: fontSize['2xl'], fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '800', marginTop: spacing.xs },
  card: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  entity: { fontSize: fontSize.sm, fontWeight: '800' },
  meta: { fontSize: 10 },
});
