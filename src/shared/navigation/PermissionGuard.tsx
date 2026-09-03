/**
 * PermissionGuard — enforces a permission AT SCREEN ACCESS (Section 52).
 * Localized via the translation hook.
 */
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { hasPermission } from '@/security/permissions/permission';
import { Button, Screen, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';

interface PermissionGuardProps {
  permissions: readonly string[];
  required: string;
  children: ReactNode;
}

export function PermissionGuard({ permissions, required, children }: PermissionGuardProps) {
  const router = useRouter();
  const { colors, spacing, textVariants } = useTheme();
  const { t } = useTranslation();

  if (!hasPermission(permissions, required)) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: colors.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="lock-closed" size={32} color={colors.danger} />
          </View>
          <Text style={{ ...textVariants.heading, color: colors.text, textAlign: 'center' }}>
            {t('accessDenied.title')}
          </Text>
          <Text style={{ ...textVariants.body, color: colors.textMuted, textAlign: 'center', lineHeight: 23 }}>
            {t('accessDenied.message')}
          </Text>
          <Text style={{ color: colors.danger, fontSize: 13, fontFamily: 'monospace' }}>{required}</Text>
          <Button
            label={t('accessDenied.goHome')}
            icon="home-outline"
            onPress={() => router.replace('/(app)/(tabs)')}
            style={{ width: '100%', marginTop: spacing.sm }}
          />
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
