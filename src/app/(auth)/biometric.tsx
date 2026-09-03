/**
 * Auth screen 4 — biometric enrollment (optional).
 * Detects device capability, prompts for biometrics to enable, then creates
 * the real session. Skipping also completes registration (biometric can be
 * enabled later from settings).
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Alert, Button, Card, Screen, Spinner, useTheme, useToast } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { getBiometricCapability, promptBiometric, type BiometricCapability } from '@/security/biometric/biometric';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';

export default function BiometricScreen() {
  const router = useRouter();
  const { finishRegistration, enableBiometric } = useBootstrap();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBiometricCapability().then(setCapability);
  }, []);

  const proceed = async (withBiometric: boolean) => {
    setBusy(true);
    if (withBiometric) {
      await enableBiometric(true);
    }
    await finishRegistration(); // creates + persists the session
    setBusy(false);
    router.replace('/(app)/store-setup');
  };

  const handleEnable = async () => {
    setBusy(true);
    const result = await promptBiometric(t('auth.biometric.prompt'));
    if (result.success) {
      await enableBiometric(true);
      setBusy(false);
      await proceed(false);
    } else {
      setBusy(false);
      toast.error(t('auth.biometric.failed'));
    }
  };

  const kindLabel =
    capability?.kind === 'face'
      ? t('auth.biometric.face')
      : t('auth.biometric.fingerprint');

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 28,
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={capability?.kind === 'face' ? 'happy-outline' : 'finger-print'}
              size={52}
              color={colors.primary}
            />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
            {t('auth.biometric.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            {t('auth.biometric.desc')}
          </Text>
        </View>

        {capability === null ? (
          <View style={{ alignItems: 'center' }}>
            <Spinner size="large" />
          </View>
        ) : capability.available ? (
          <Card style={{ gap: spacing.md }}>
            <Button
              label={busy ? t('auth.saving') : `${t('auth.biometric.enable')} · ${kindLabel}`}
              icon="finger-print"
              onPress={() => void handleEnable()}
              disabled={busy}
              loading={busy}
            />
            <Button label={t('auth.biometric.skip')} variant="ghost" onPress={() => void proceed(false)} disabled={busy} />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Alert tone="info" message={t('auth.biometric.unavailable')} />
            <Button label={t('auth.biometric.skip')} onPress={() => void proceed(false)} loading={busy} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
