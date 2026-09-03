/**
 * Placeholder screen — HONEST non-implementation marker (Section 62).
 * Built on the design system and fully localized (PHASE 04).
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';

interface PlaceholderScreenProps {
  /** Localized title (already translated by the caller). */
  title: string;
  phase: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children?: ReactNode;
}

export function PlaceholderScreen({
  title,
  phase,
  description,
  icon = 'construct-outline',
  children,
}: PlaceholderScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={36} color={colors.primary} />
        </View>

        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
            {t('placeholder.phase', { phase })}
          </Text>
        </View>

        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 }}>
            {description}
          </Text>
        ) : null}

        {children ? (
          <View style={{ width: '100%', gap: spacing.md, marginTop: spacing.sm }}>{children}</View>
        ) : null}
      </View>
    </Screen>
  );
}
