/**
 * شاشة إعدادات الأمان (PHASE 26).
 * تعرض إعدادات القفل التلقائي (مفعّل/المهلة)، فتح البصمة، طلب PIN قبل
 * الإجراءات الحساسة، زر "قفل الآن"، وتقرير سلامة الجهاز (مستوى الثقة/تحذيرات).
 * كل التبديلات تُحفظ عبر سياق الأمان؛ الحالات تُدار محليًا مع تحميل أولي.
 * لا نصوص ثابتة — كلها عبر i18n.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { TIMEOUT_MINUTES } from '@/domain/security-lock';
import type { AutoLockTimeout, DeviceSecurityReport, SecuritySettings } from '@/domain/security-lock';
import { getDeviceSecurityReport } from '@/security/device/device-security.service';
import { useSecurity } from './security-context';

export function SecurityScreen() {
  const router = useRouter(); // التنقل.
  const { t } = useTranslation(); // الترجمة.
  const { colors } = useTheme(); // الثيم.
  const { settings, saveSettings, lock } = useSecurity(); // سياق الأمان.
  const [report, setReport] = useState<DeviceSecurityReport | null>(null); // تقرير الجهاز.

  // تحديث جزء من الإعدادات وحفظه فورًا.
  const update = async (patch: Partial<SecuritySettings>) => {
    if (!settings) return;
    await saveSettings({ ...settings, ...patch });
  };

  // تحميل تقرير سلامة الجهاز أول مرة.
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => getDeviceSecurityReport())
      .then((r) => { if (alive) setReport(r); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const tone = report?.trustLevel === 'high' ? 'success' : report?.trustLevel === 'medium' ? 'warning' : 'danger';
  const palette = toneColors(colors, tone);

  return (
    <Screen edges={['top']} padded={false}>
      {/* الترويسة */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{t('security.title')}</Text>
      </View>

      {!settings ? (
        <View style={styles.center}><Spinner size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* القفل التلقائي */}
          <Card glass style={styles.card}>
            <ToggleRow
              icon="timer-outline"
              label={t('security.autoLock')}
              value={settings.autoLockEnabled}
              onValueChange={(v) => void update({ autoLockEnabled: v })}
            />
            {settings.autoLockEnabled ? (
              <View style={styles.timeouts}>
                {TIMEOUT_MINUTES.map((to) => {
                  const active = settings.lockTimeout === to;
                  return (
                    <Pressable
                      key={String(to)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => void update({ lockTimeout: to as AutoLockTimeout })}
                      style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : colors.textSubtle }]}>{t(`security.timeout.${String(to)}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>

          {/* فتح البصمة */}
          <Card glass style={styles.card}>
            <ToggleRow
              icon="finger-print-outline"
              label={t('security.biometricUnlock')}
              value={settings.biometricUnlockEnabled}
              onValueChange={(v) => void update({ biometricUnlockEnabled: v })}
            />
          </Card>

          {/* طلب PIN للإجراءات الحساسة */}
          <Card glass style={styles.card}>
            <ToggleRow
              icon="shield-checkmark-outline"
              label={t('security.requirePinSensitive')}
              value={settings.requirePinForSensitive}
              onValueChange={(v) => void update({ requirePinForSensitive: v })}
            />
          </Card>

          {/* قفل الآن */}
          <Button
            label={t('security.lockNow')}
            icon="lock-closed"
            variant="primary"
            onPress={() => lock()}
          />

          {/* تقرير سلامة الجهاز */}
          <Card glass style={styles.card}>
            <View style={styles.reportHead}>
              <Ionicons name="phone-portrait-outline" size={20} color={palette.strong} />
              <Text style={[styles.reportTitle, { color: colors.text }]}>{t('security.deviceTitle')}</Text>
            </View>
            {report ? (
              <>
                <View style={[styles.trustBadge, { backgroundColor: palette.soft }]}>
                  <Text style={[styles.trustText, { color: palette.strong }]}>{t(`security.trust.${report.trustLevel}`)}</Text>
                </View>
                {report.warnings.map((w) => (
                  <View key={w} style={styles.warningRow}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                    <Text style={[styles.warningText, { color: colors.textSubtle }]}>{t(w)}</Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.center}><Spinner /></View>
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

// صف تبديل (Switch) مع أيقونة وتسمية.
function ToggleRow({ icon, label, value, onValueChange }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  center: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '700' },
  timeouts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { fontSize: fontSize.sm, fontWeight: '700' },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportTitle: { fontSize: fontSize.md, fontWeight: '800' },
  trustBadge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  trustText: { fontSize: fontSize.sm, fontWeight: '900' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warningText: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
});
