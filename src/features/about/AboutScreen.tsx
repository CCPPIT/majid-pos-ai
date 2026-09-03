/**
 * شاشة «عن التطبيق» (PHASE 30+ / جاهزية إنتاج).
 * تعرض الهوية، رقم الإصدار، وبيئة البناء (تنموي/تجريبي/إنتاجي) — مع إفصاح
 * صادق بأن التطبيق يعمل دون اتصال ويحفظ البيانات محليًا، وأن المساعد الذكي
 * قواعد محلية لا سحابة وهمية. قراءة فقط؛ لا تلمس التخزين.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, Screen, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/core/config/constants';
import { env, isProduction } from '@/core/config/env';

export function AboutScreen() {
  const router = useRouter(); // للرجوع.
  const { colors, spacing, textVariants } = useTheme(); // الثيم.
  const { t } = useTranslation(); // الترجمة.

  // تسمية البيئة محليّة.
  const envLabel =
    env.appEnvironment === 'production'
      ? t('about.envProduction')
      : env.appEnvironment === 'staging'
        ? t('about.envStaging')
        : t('about.envDevelopment');

  // لون شارة البيئة: أخضر إنتاج، كهرماني غير ذلك.
  const badgeColor = isProduction ? colors.success : colors.warning;

  return (
    <Screen>
      <View style={{ gap: spacing.xl, flex: 1 }}>
        {/* ترويسة فيها زر رجوع */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={{ ...textVariants.heading, color: colors.text }}>{t('about.title')}</Text>
        </View>

        {/* بطاقة الهوية والإصدار */}
        <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}
          >
            <Ionicons name="sparkles" size={40} color={colors.primary} />
          </View>
          <Text style={{ ...textVariants.title, color: colors.text }}>{APP_NAME}</Text>
          <Text style={{ ...textVariants.label, color: colors.textMuted }}>{APP_TAGLINE}</Text>

          {/* صف الإصدار + شارة البيئة */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            <Text style={{ ...textVariants.label, color: colors.textSubtle }}>
              {t('about.version')} {APP_VERSION}
            </Text>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: badgeColor,
              }}
            >
              <Text style={{ color: '#0B0F14', fontSize: 12, fontWeight: '800' }}>{envLabel}</Text>
            </View>
          </View>
        </Card>

        {/* إفصاح: يعمل دون اتصال / بيانات محلية */}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.primary} />
            <Text style={{ ...textVariants.bodyStrong, color: colors.text }}>{t('about.offlineTitle')}</Text>
          </View>
          <Text style={{ ...textVariants.body, color: colors.textMuted }}>{t('about.offlineBody')}</Text>
        </Card>

        {/* إفصاح: ذكاء مساعد محلي صادق (لا سحابة وهمية) */}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
            <Text style={{ ...textVariants.bodyStrong, color: colors.text }}>{t('about.aiTitle')}</Text>
          </View>
          <Text style={{ ...textVariants.body, color: colors.textMuted }}>{t('about.aiBody')}</Text>
        </Card>

        {/* حقوق النشر */}
        <Text style={{ ...textVariants.caption, color: colors.textSubtle, textAlign: 'center', marginTop: 'auto' }}>
          {t('about.rights')}
        </Text>
      </View>
    </Screen>
  );
}
