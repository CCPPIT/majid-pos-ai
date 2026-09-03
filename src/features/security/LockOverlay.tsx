/**
 * شاشة/طبقة القفل (PHASE 26).
 * تُعرض فوق كامل التطبيق عند القفل (قفل تلقائي أو يدوي) وتحجب المحتوى. الفتح
 * بـ PIN عبر مستودع الأمان، أو بالبصمة/الوجه إن كانت مفعّلة ومتاحة. لا يمكن
 * تجاوزها بالتنقل (تغطّي شجرة التوجيه) — إخفاء ليس أمنًا، وهنا حجب فعلي.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CodeInput } from '@/design-system/primitives/CodeInput';
import { useTheme } from '@/design-system';
import { fontSize, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { getBiometricCapability, type BiometricCapability } from '@/security/biometric/biometric';
import { useSecurity } from './security-context';

export function LockOverlay() {
  const { t } = useTranslation(); // الترجمة.
  const { colors } = useTheme(); // الثيم.
  const { locked, settings, unlockWithPin, unlockWithBiometric } = useSecurity(); // حالة الأمان.
  const [pin, setPin] = useState(''); // الـ PIN المُدخل.
  const [error, setError] = useState(false); // خطأ؟
  const [busy, setBusy] = useState(false); // جارٍ التحقق؟
  const [capability, setCapability] = useState<BiometricCapability | null>(null); // قدرات البصمة.

  // نفحص قدرات البصمة عند التركيب.
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => getBiometricCapability())
      .then((cap) => { if (alive) setCapability(cap); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  // إعادة الضبط عند كل قفل، ومحاولة البصمة تلقائيًا إن كانت مفعّلة.
  useEffect(() => {
    if (!locked) return;
    // إعادة الضبط ومحاولة البصمة عبر سلسلة promise (لا setState متزامن في الأثر).
    Promise.resolve()
      .then(async () => {
        setPin('');
        setError(false);
        setBusy(false);
        // محاولة فتح تلقائية بالبصمة عند القفل إن وُجدت وفُعّلت.
        if (settings?.biometricUnlockEnabled) {
          const cap = await getBiometricCapability();
          if (cap.available) {
            await unlockWithBiometric(t('security.biometricPrompt'));
          }
        }
      })
      .catch(() => undefined);
  }, [locked, settings?.biometricUnlockEnabled, unlockWithBiometric, t]);

  // محاولة فتح بـ PIN عند اكتمال الأرقام الأربعة.
  const handlePin = async (value: string) => {
    setPin(value);
    setError(false);
    if (value.length === 4) {
      setBusy(true);
      const ok = await unlockWithPin(value);
      setBusy(false);
      if (!ok) {
        setError(true);
        setPin('');
      }
    }
  };

  // طلب البصمة يدويًا.
  const handleBiometric = () => {
    void unlockWithBiometric(t('security.biometricPrompt'));
  };

  const canUseBiometric = (capability?.available ?? false) && (settings?.biometricUnlockEnabled ?? false);

  return (
    <Modal visible={locked} animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {/* رمز القفل */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="lock-closed" size={36} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('security.lockTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('security.lockSubtitle')}</Text>

          {/* إدخال الـ PIN */}
          <View style={styles.codeWrap}>
            <CodeInput
              value={pin}
              onChangeText={(v) => void handlePin(v)}
              secure
              error={error}
              autoFocus
              accessibilityLabel={t('security.pinA11y')}
            />
          </View>
          {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{t('security.wrongPin')}</Text> : null}
          {busy ? <Text style={[styles.hint, { color: colors.textSubtle }]}>{t('security.verifying')}</Text> : null}

          {/* زر البصمة إن توفرت */}
          {canUseBiometric ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('security.useBiometric')}
              onPress={handleBiometric}
              style={[styles.bioBtn, { borderColor: colors.primary }]}
            >
              <Ionicons name="finger-print" size={20} color={colors.primary} />
              <Text style={[styles.bioText, { color: colors.primary }]}>{t('security.useBiometric')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  content: { alignItems: 'center', gap: spacing.md },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: '900' },
  subtitle: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.lg },
  codeWrap: { width: '100%', alignItems: 'center' },
  errorText: { fontSize: fontSize.sm, fontWeight: '700' },
  hint: { fontSize: fontSize.sm },
  bioBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.md },
  bioText: { fontSize: fontSize.md, fontWeight: '800' },
});
