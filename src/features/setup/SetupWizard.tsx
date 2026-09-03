/**
 * مكوّن معالج إعداد المتجر (PHASE 09) — واجهة المعالج.
 * شاشة واحدة بعدة خطوات: العمل · الدولة · الضريبة · الفرع/المتجر · المدير · المراجعة.
 * كل النصوص عبر مفاتيح ترجمة، والأزرار مفعّلة فقط عند صحة الخطوة.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { logger } from '@/core/logging/logger';
import { Button, Card, Chip, Input, Progress, Screen } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/design-system/theme';
import {
  BUSINESS_TYPE_OPTIONS, // خيارات نوع النشاط.
  CODE_MAX_LENGTH, // حد كود المتجر.
  COUNTRY_OPTIONS, // خيارات الدول.
  CURRENCY_OPTIONS, // خيارات العملات.
  NAME_MAX_LENGTH, // حد الاسم.
  TAX_RATE_MAX, // أقصى ضريبة.
} from '@/domain/setup/options';
import type { CountryCode, CurrencyCode } from '@/domain/setup/types';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useSetup } from './setup-context';
import { useSetupWizard } from './useSetupWizard';

// صف غلاف بسيط (عنوان + مسافة).
function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{children}</Text>;
}

export function SetupWizard() {
  const { t } = useTranslation(); // الترجمة.
  const { colors } = useTheme(); // الألوان.
  const router = useRouter(); // التنقل.
  const { completeStoreSetup } = useBootstrap(); // علَم إتمام الإعداد.
  const { submitProfile } = useSetup(); // حفظ الملف وبناء الهرمية.
  const wizard = useSetupWizard(); // منطق المعالج.
  const [submitting, setSubmitting] = useState(false); // حالة الحفظ.
  const [submitError, setSubmitError] = useState<string | null>(null); // خطأ الحفظ.

  // إتمام المعالج: نبني الملف، نحفظه، نضع علَم الإعداد، ثم ننتقل للوحة.
  const handleFinish = async () => {
    if (submitting) return; // نمنع الضغط المزدوج.
    setSubmitting(true);
    setSubmitError(null);
    try {
      const profile = wizard.buildProfile(); // نكوّن الملف الكامل.
      const built = await submitProfile(profile); // نحفظ ونبني الهرمية.
      await completeStoreSetup(); // نضع علَم اكتمال الإعداد.
      logger.info('Setup wizard finished', { store: String(built.activeStoreId) });
      router.replace('/(app)/(tabs)'); // ننتقل للتطبيق.
    } catch (error) {
      logger.error('Setup wizard failed', { error: String(error) });
      setSubmitError(t('setup.error.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // عنوان فرعي للخطوة الحالية.
  const stepTitle = t(`setup.step.${wizard.step}.title`);
  const stepHint = t(`setup.step.${wizard.step}.hint`);

  return (
    <Screen edges={['top']}>
      {/* رأس المعالج: التقدم + العدّاد */}
      <View style={styles.header}>
        <View style={styles.progressRow}>
          <Progress value={wizard.progress} accessibilityLabel={t('setup.progressLabel')} style={styles.progressBar} />
          <Text style={[styles.counter, { color: colors.textMuted }]}>
            {wizard.stepIndex + 1}/{wizard.steps.length}
          </Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{stepTitle}</Text>
        <Text style={[styles.stepHint, { color: colors.textSubtle }]}>{stepHint}</Text>
      </View>

      {/* جسم الخطوة (تمرير) */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* خطوة 1: بيانات العمل */}
        {wizard.step === 'business' && (
          <View style={styles.stepGap}>
            <Input
              label={t('setup.field.businessName')}
              placeholder={t('setup.field.businessNamePlaceholder')}
              value={wizard.draft.businessName ?? ''}
              maxLength={NAME_MAX_LENGTH}
              leftIcon="🏪"
              returnKeyType="next"
              onChangeText={(v) => wizard.setField('businessName', v)}
              accessibilityLabel={t('setup.field.businessName')}
            />
            <SectionLabel>{t('setup.field.businessType')}</SectionLabel>
            <View style={styles.chipWrap}>
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={t(opt.labelKey)}
                  icon={opt.icon as keyof typeof Ionicons.glyphMap}
                  selected={wizard.draft.businessType === opt.value}
                  onPress={() => wizard.selectBusinessType(opt.value)}
                />
              ))}
            </View>
          </View>
        )}

        {/* خطوة 2: الدولة والعملة */}
        {wizard.step === 'location' && (
          <View style={styles.stepGap}>
            <SectionLabel>{t('setup.field.country')}</SectionLabel>
            <View style={styles.chipWrap}>
              {COUNTRY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={t(opt.labelKey)}
                  icon={opt.icon as keyof typeof Ionicons.glyphMap}
                  selected={wizard.draft.country === opt.value}
                  onPress={() => wizard.selectCountry(opt.value as CountryCode)}
                />
              ))}
            </View>
            <SectionLabel>{t('setup.field.currency')}</SectionLabel>
            <View style={styles.chipWrap}>
              {CURRENCY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={`${t(opt.labelKey)} (${opt.symbol})`}
                  selected={wizard.draft.currency === opt.value}
                  onPress={() => wizard.setField('currency', opt.value as CurrencyCode)}
                />
              ))}
            </View>
          </View>
        )}

        {/* خطوة 3: الضريبة */}
        {wizard.step === 'tax' && (
          <View style={styles.stepGap}>
            <Input
              label={t('setup.field.taxRate')}
              placeholder="5"
              value={wizard.draft.taxRatePercent != null ? String(wizard.draft.taxRatePercent) : ''}
              keyboardType="numeric"
              leftIcon="％"
              onChangeText={(v) => {
                const cleaned = v.replace(/[^0-9.]/g, ''); // أرقام ونقطة فقط.
                if (cleaned === '') {
                  // حقل فارغ: نحذف القيمة من المسودة (خطوة غير مكتملة).
                  wizard.setField('taxRatePercent', undefined as unknown as number);
                } else {
                  const parsed = Number(cleaned);
                  if (Number.isFinite(parsed)) wizard.setField('taxRatePercent', parsed);
                }
              }}
              accessibilityLabel={t('setup.field.taxRate')}
            />
            <Text style={[styles.helper, { color: colors.textSubtle }]}>
              {t('setup.tax.helper', { max: String(TAX_RATE_MAX) })}
            </Text>
          </View>
        )}

        {/* خطوة 4: الفرع والمتجر */}
        {wizard.step === 'store' && (
          <View style={styles.stepGap}>
            <Input
              label={t('setup.field.branchName')}
              placeholder={t('setup.field.branchNamePlaceholder')}
              value={wizard.draft.branchName ?? ''}
              maxLength={NAME_MAX_LENGTH}
              leftIcon="🏬"
              onChangeText={(v) => wizard.setField('branchName', v)}
              accessibilityLabel={t('setup.field.branchName')}
            />
            <Input
              label={t('setup.field.branchCity')}
              placeholder={t('setup.field.branchCityPlaceholder')}
              value={wizard.draft.branchCity ?? ''}
              maxLength={NAME_MAX_LENGTH}
              leftIcon="📍"
              onChangeText={(v) => wizard.setField('branchCity', v)}
              accessibilityLabel={t('setup.field.branchCity')}
            />
            <Input
              label={t('setup.field.storeName')}
              placeholder={t('setup.field.storeNamePlaceholder')}
              value={wizard.draft.storeName ?? ''}
              maxLength={NAME_MAX_LENGTH}
              leftIcon="🧾"
              onChangeText={(v) => wizard.setField('storeName', v)}
              accessibilityLabel={t('setup.field.storeName')}
            />
            <Input
              label={t('setup.field.storeCode')}
              placeholder="SNH-01"
              value={wizard.draft.storeCode ?? ''}
              maxLength={CODE_MAX_LENGTH}
              autoCapitalize="characters"
              leftIcon="#"
              onChangeText={(v) => wizard.setField('storeCode', v)}
              hint={t('setup.field.storeCodeHint')}
              accessibilityLabel={t('setup.field.storeCode')}
            />
          </View>
        )}

        {/* خطوة 5: المدير (اختياري) */}
        {wizard.step === 'manager' && (
          <View style={styles.stepGap}>
            <Input
              label={t('setup.field.managerName')}
              placeholder={t('setup.field.managerNamePlaceholder')}
              value={wizard.draft.managerName ?? ''}
              maxLength={NAME_MAX_LENGTH}
              leftIcon="👤"
              onChangeText={(v) => wizard.setField('managerName', v)}
              hint={t('setup.manager.optional')}
              accessibilityLabel={t('setup.field.managerName')}
            />
            <Card glass style={styles.noteCard}>
              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={iconMd} color={colors.primary} />
                <Text style={[styles.noteText, { color: colors.textMuted }]}>{t('setup.manager.hrNote')}</Text>
              </View>
            </Card>
          </View>
        )}

        {/* خطوة 6: المراجعة */}
        {wizard.step === 'review' && (
          <Card glass style={styles.reviewCard}>
            <ReviewRow iconKey="business" label={t('setup.field.businessName')} value={wizard.draft.businessName} />
            <ReviewRow iconKey="business" label={t('setup.field.businessType')} value={businessTypeLabel(wizard.draft.businessType, t)} />
            <ReviewRow iconKey="location" label={t('setup.field.country')} value={countryLabel(wizard.draft.country, t)} />
            <ReviewRow iconKey="location" label={t('setup.field.currency')} value={wizard.draft.currency} />
            <ReviewRow iconKey="tax" label={t('setup.field.taxRate')} value={`${wizard.draft.taxRatePercent ?? 0}%`} />
            <ReviewRow iconKey="store" label={t('setup.field.branchName')} value={wizard.draft.branchName} />
            <ReviewRow iconKey="store" label={t('setup.field.branchCity')} value={wizard.draft.branchCity} />
            <ReviewRow iconKey="store" label={t('setup.field.storeName')} value={wizard.draft.storeName} />
            <ReviewRow iconKey="store" label={t('setup.field.storeCode')} value={wizard.draft.storeCode} />
            {wizard.draft.managerName ? (
              <ReviewRow iconKey="manager" label={t('setup.field.managerName')} value={wizard.draft.managerName} />
            ) : null}
          </Card>
        )}

        {/* رسالة خطأ عند الحفظ */}
        {submitError ? <Text style={[styles.submitError, { color: colors.danger }]}>{submitError}</Text> : null}
      </ScrollView>

      {/* أزرار التنقل السفلية */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label={t('common.back')}
          variant="secondary"
          icon="arrow-back-outline"
          disabled={wizard.isFirstStep || submitting}
          onPress={wizard.back}
          style={styles.footerBtn}
        />
        {wizard.isLastStep ? (
          <Button
            label={t('setup.finish')}
            variant="success"
            icon="checkmark-circle-outline"
            loading={submitting}
            disabled={!wizard.canProceed}
            onPress={handleFinish}
            style={styles.footerBtn}
          />
        ) : (
          <Button
            label={t('common.next')}
            icon="arrow-forward-outline"
            iconPosition="trailing"
            disabled={!wizard.canProceed}
            onPress={wizard.next}
            style={styles.footerBtn}
          />
        )}
      </View>
    </Screen>
  );
}

// صف في بطاقة المراجعة (أيقونة + تسمية + قيمة).
function ReviewRow({ iconKey, label, value }: { iconKey: string; label: string; value?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.reviewRow}>
      <Ionicons name={(reviewIcons[iconKey] ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap} size={iconSm} color={colors.primary} />
      <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: colors.text }]} numberOfLines={1}>
        {value?.trim() || '—'}
      </Text>
    </View>
  );
}

// خريطة أيقونات صفوف المراجعة.
const reviewIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  business: 'storefront-outline',
  location: 'location-outline',
  tax: 'receipt-outline',
  store: 'git-branch-outline',
  manager: 'person-outline',
};

// حجم أيقونة صغير/متوسط.
const iconSm = 18;
const iconMd = 22;

// تسمية نوع النشاط للمراجعة.
function businessTypeLabel(code: string | undefined, t: (k: string) => string): string {
  if (!code) return '';
  return t(`setup.type.${code}`);
}
// تسمية الدولة للمراجعة.
function countryLabel(code: string | undefined, t: (k: string) => string): string {
  if (!code) return '';
  return t(`setup.country.${code}`);
}

// أنماط المعالج.
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressBar: { flex: 1 },
  counter: { fontSize: fontSize.sm, fontWeight: '600' },
  stepTitle: { fontSize: fontSize.xl, fontWeight: '700' },
  stepHint: { fontSize: fontSize.sm, lineHeight: 20 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.xl, gap: spacing.lg },
  stepGap: { gap: spacing.md },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helper: { fontSize: fontSize.xs, lineHeight: 18 },
  noteCard: { borderRadius: radius.lg, padding: spacing.lg },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  reviewCard: { gap: spacing.sm, borderRadius: radius.xl },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  reviewLabel: { fontSize: fontSize.sm, flexShrink: 1 },
  reviewValue: { fontSize: fontSize.sm, fontWeight: '700', flex: 1, textAlign: 'right' },
  submitError: { fontSize: fontSize.sm, textAlign: 'center', fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    paddingBottom: spacing.lg,
  },
  footerBtn: { flex: 1 },
});
