/**
 * شريط حالة المزامنة (PHASE 23).
 * شريط صغير أعلى الشاشة يعكس حالة الاتصال وعدد الطفرات المعلّقة، وزر دفع
 * يدوي. لا يظهر أي شيء إن كان الاتصال متاحًا ولا طفرات معلّقة (لا إزعاج).
 * بياناتك محفوظة محليًا دائمًا؛ الشريط يخصّ مزامنة الخادم المستقبلية فقط.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useSync } from './sync-context';

export function SyncStatusBar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { connectivity, summary, syncing, syncNow } = useSync();

  const offline = connectivity === 'offline';
  const pending = summary.pending + summary.inflight;
  const failed = summary.failed;

  // لا شيء يُعرض إن كان الاتصال متاحًا ولا طفرات معلّقة/فاشلة.
  if (!offline && pending === 0 && failed === 0) return null;

  // وضع عدم الاتصال: تنبيه بأن البيانات تُحفظ على الجهاز وستُزامن لاحقًا.
  if (offline) {
    return (
      <View style={[styles.bar, { backgroundColor: colors.warning }]}>
        <Ionicons name="cloud-offline-outline" size={14} color="#111827" />
        <Text style={styles.textDark} numberOfLines={1}>{t('sync.offlineBanner')}</Text>
      </View>
    );
  }

  // وضع الاتصال مع طفرات معلّقة/فاشلة.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('sync.syncNow')}
      onPress={() => void syncNow()}
      style={[styles.bar, { backgroundColor: failed > 0 ? colors.danger : colors.primary }]}
    >
      <Ionicons
        name={syncing ? 'sync' : failed > 0 ? 'alert-circle-outline' : 'cloud-upload-outline'}
        size={14}
        color="#fff"
      />
      <Text style={styles.textLight} numberOfLines={1}>
        {failed > 0 ? t('sync.failedBanner', { count: failed }) : t('sync.pendingBanner', { count: pending })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  textLight: { color: '#fff', fontSize: fontSize.xs, fontWeight: '800' },
  textDark: { color: '#111827', fontSize: fontSize.xs, fontWeight: '800', flex: 1, textAlign: 'center' },
});
