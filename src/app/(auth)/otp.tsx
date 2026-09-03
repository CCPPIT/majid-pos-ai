/**
 * Auth screen 2 — OTP verification.
 * Reads the pending registration to show the identifier; verifies the 4-digit
 * code against the issued demo OTP (shown in a dev banner — no backend yet).
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import {
  Alert,
  Button,
  Card,
  CodeInput,
  Screen,
  useTheme,
  useToast,
} from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { isValidOtp } from '@/domain/identity/validation';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const router = useRouter();
  const { pendingRegistration, verifyOtp, resendOtp } = useBootstrap();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // No registration in flight (direct deep link) — send back to identifier.
  useEffect(() => {
    if (!pendingRegistration) {
      router.replace('/(auth)/sign-in');
    }
  }, [pendingRegistration, router]);

  const submit = async (value: string) => {
    if (!isValidOtp(value)) return;
    setBusy(true);
    const ok = await verifyOtp(value);
    setBusy(false);
    if (ok) {
      router.push('/(auth)/pin');
    } else {
      setError(true);
      setCode('');
      toast.error(t('auth.otp.wrong'));
    }
  };

  const resend = async () => {
    if (countdown > 0 || !pendingRegistration) return;
    const fresh = await resendOtp();
    setCountdown(RESEND_SECONDS);
    setCode('');
    setError(false);
    toast.info(t('auth.otp.sent'));
    void fresh;
  };

  if (!pendingRegistration) return null;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
            {t('auth.otp.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            {t('auth.otp.desc', { identifier: pendingRegistration.identifier })}
          </Text>
        </View>

        {/* Dev banner — honest: no backend, the issued OTP is shown. */}
        <Alert tone="warning" message={t('auth.otp.demoCode', { code: pendingRegistration.issuedOtp })} />

        <CodeInput
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (error) setError(false);
          }}
          onComplete={(value) => void submit(value)}
          error={error}
          accessibilityLabel={t('auth.otp.title')}
        />

        <Button
          label={busy ? t('auth.verifying') : t('auth.otp.verify')}
          onPress={() => void submit(code)}
          disabled={code.length !== 4 || busy}
          loading={busy}
        />

        <Card style={{ alignItems: 'center' }} elevation="none">
          <Button
            label={countdown > 0 ? t('auth.otp.resendIn', { seconds: countdown }) : t('auth.otp.resend')}
            variant="ghost"
            size="sm"
            disabled={countdown > 0}
            onPress={() => void resend()}
          />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
