/**
 * Auth screen 1 — identifier (phone / email).
 * Validates the identifier, starts a registration and issues a demo OTP,
 * then advances to OTP. A clearly-labelled demo shortcut still exists.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Button, Input, Screen, Spinner, useTheme, useToast } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { detectIdentifier, isValidIdentifier } from '@/domain/identity/validation';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';

export default function SignInScreen() {
  const router = useRouter();
  const { startAuthRegistration, devSignIn } = useBootstrap();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!isValidIdentifier(identifier)) {
      setError(t('auth.identifier.invalid'));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await startAuthRegistration(identifier, detectIdentifier(identifier));
      router.push('/(auth)/otp');
    } catch {
      toast.error(t('auth.identifier.invalid'));
    } finally {
      setSubmitting(false);
    }
  };

  const devLogin = async () => {
    await devSignIn();
    toast.success(t('auth.devSignInSuccess'));
    router.replace('/(app)/store-setup');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontSize: 40, fontWeight: '800' }}>M</Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            {t('auth.identifier.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            {t('auth.identifier.desc')}
          </Text>
        </View>

        <Input
          value={identifier}
          onChangeText={(text) => {
            setIdentifier(text);
            if (error) setError(undefined);
          }}
          placeholder={t('auth.identifier.placeholder')}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          accessibilityLabel={t('auth.identifier.title')}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />

        <Button
          label={submitting ? t('auth.sending') : t('auth.identifier.cta')}
          icon={submitting ? undefined : 'arrow-forward'}
          onPress={() => void submit()}
          disabled={submitting || identifier.trim().length === 0}
          loading={submitting}
        />

        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          {submitting ? <Spinner /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.devLink')}
            onPress={() => void devLogin()}
            style={{ paddingVertical: spacing.sm }}
          >
            <Text style={{ color: colors.textSubtle, fontSize: 12, textAlign: 'center' }}>
              {t('auth.devLink')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
