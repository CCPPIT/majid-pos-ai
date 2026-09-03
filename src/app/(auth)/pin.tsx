/**
 * Auth screen 3 — create PIN (enter then confirm).
 * Validates a strong 4-digit PIN, stores its hash in secure storage, then
 * advances to biometric setup.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, CodeInput, Screen, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { isWeakPin, isValidPin } from '@/domain/identity/validation';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';

type Step = 'create' | 'confirm';

export default function PinScreen() {
  const router = useRouter();
  const { pendingRegistration, savePin } = useBootstrap();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('create');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pendingRegistration) router.replace('/(auth)/sign-in');
  }, [pendingRegistration, router]);

  if (!pendingRegistration) return null;

  const handleFirst = async (pin: string) => {
    if (!isValidPin(pin)) return;
    if (isWeakPin(pin)) {
      setError(t('auth.pin.weak'));
      setFirst('');
      return;
    }
    setError(undefined);
    setFirst(pin);
    setStep('confirm');
  };

  const handleSecond = async (pin: string) => {
    if (!isValidPin(pin)) return;
    if (pin !== first) {
      setError(t('auth.pin.mismatch'));
      setSecond('');
      return;
    }
    setBusy(true);
    await savePin(pin);
    setBusy(false);
    router.push('/(auth)/biometric');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
            {step === 'create' ? t('auth.pin.title') : t('auth.pin.confirmTitle')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            {step === 'create' ? t('auth.pin.enter') : t('auth.pin.confirm')}
          </Text>
        </View>

        <CodeInput
          key={step}
          value={step === 'create' ? first : second}
          onChangeText={step === 'create' ? setFirst : setSecond}
          onComplete={step === 'create' ? handleFirst : handleSecond}
          secure
          error={!!error}
          accessibilityLabel={t('auth.pin.title')}
        />

        {error ? (
          <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {step === 'confirm' ? (
          <Button
            label={busy ? t('auth.saving') : t('auth.pin.continue')}
            onPress={() => void handleSecond(second)}
            disabled={second.length !== 4 || busy}
            loading={busy}
          />
        ) : (
          <Text style={{ color: colors.textSubtle, fontSize: 13, textAlign: 'center' }}>
            {t('auth.pin.desc')}
          </Text>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
