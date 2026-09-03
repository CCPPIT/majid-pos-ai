/**
 * شاشة الدفع (PHASE 14 — Payments).
 * اختيار طريقة الدفع (نقدي/بطاقة/QR/محفظة)، إدخال القبض النقدي وحساب الباقي،
 * ثم المعالجة عبر مستودع المدفوعات (مزود-محايد). النجاح يعرض إجماليات وباقيًا.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Chip } from '@/design-system/primitives/Chip';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation } from '@/i18n/LocaleProvider';
import { asId } from '@/core/types/domain';
import type { PaymentMethod } from '@/domain/payments/types';
import { methodLabelKey } from '@/domain/payments/calculations';
import { paymentsRepository } from '@/shared/container';
import { usePayment } from './usePayment';

// طرق الدفع المعروضة مع أيقونات.
const METHODS: { id: PaymentMethod; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'cash', icon: 'cash-outline' },
  { id: 'card', icon: 'card-outline' },
  { id: 'qr', icon: 'qr-code-outline' },
  { id: 'wallet', icon: 'wallet-outline' },
];

export function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = params.orderId ? asId(String(params.orderId)) : null;
  const { t, formatCurrency } = useTranslation();
  const { colors } = useTheme();
  const vm = usePayment(orderId, paymentsRepository);

  // ── حالة التحميل ──
  if (vm.status.kind === 'loading') {
    return (
      <Screen edges={['top']}>
        <View style={styles.center}><Spinner size="large" /></View>
      </Screen>
    );
  }

  // ── الطلب غير موجود ──
  if (vm.status.kind === 'notfound') {
    return (
      <Screen edges={['top']}>
        <EmptyState
          icon="receipt-outline"
          title={t('pay.orderNotFound')}
          description={t('pay.orderNotFoundDesc')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  // ── خطأ ──
  if (vm.status.kind === 'error') {
    return (
      <Screen edges={['top']}>
        <EmptyState
          icon="cloud-offline-outline"
          title={t('pay.errorTitle')}
          description={t(vm.status.messageKey)}
          actionLabel={t('common.retry')}
          onAction={() => void vm.retry()}
        />
      </Screen>
    );
  }

  // ── نجاح الدفع ──
  if (vm.status.kind === 'done') {
    const { payment, order } = vm.status;
    return (
      <Screen edges={['top']}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={56} color="#fff" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>{t('pay.paidSuccess')}</Text>
          <Text style={[styles.orderNumber, { color: colors.primary }]}>{order.orderNumber}</Text>

          <Card glass style={styles.summaryCard}>
            <SummaryRow label={t('pay.method')} value={t(methodLabelKey(payment.method))} />
            <SummaryRow label={t('cart.total')} value={formatCurrency(order.total.amount, order.currency)} />
            {payment.tendered ? (
              <SummaryRow label={t('pay.tendered')} value={formatCurrency(payment.tendered.amount, order.currency)} />
            ) : null}
            {payment.changeDue && payment.changeDue.amount > 0 ? (
              <SummaryRow label={t('pay.changeDue')} value={formatCurrency(payment.changeDue.amount, order.currency)} highlight />
            ) : null}
            {payment.reference ? (
              <SummaryRow label={t('pay.reference')} value={payment.reference} />
            ) : null}
          </Card>

          <Text style={[styles.receiptNote, { color: colors.textSubtle }]}>{t('pay.receiptNote')}</Text>
          <View style={{ gap: spacing.sm, width: '100%' }}>
            <Button
              label={t('receipt.view')}
              icon="receipt-outline"
              onPress={() => router.replace(`/(app)/receipt?orderId=${encodeURIComponent(String(order.id))}` as never)}
            />
            <Button label={t('pay.newSale')} icon="add-circle-outline" variant="secondary" onPress={() => router.replace('/(app)/(tabs)/pos')} />
          </View>
        </View>
      </Screen>
    );
  }

  // ── جاهز / قيد المعالجة ──
  const processing = vm.status.kind === 'processing';
  // في حالة المعالجة لا يحدث تغيير بصري للمحتوى (الزر يعرض حالة الانتظار).
  const dueOrder = vm.status.kind === 'ready' ? vm.status.order : null;

  return (
    <Screen edges={['top']} scroll>
      <View style={styles.header}>
        <Button label={t('common.back')} variant="secondary" icon="arrow-back-outline" size="sm" onPress={() => router.back()} style={styles.backBtn} />
        <Text style={[styles.title, { color: colors.text }]}>{t('pay.title')}</Text>
      </View>

      {dueOrder ? (
        <View style={styles.content}>
          {/* رقم الطلب والمطلوب */}
          <Card glass style={styles.dueCard}>
            <Text style={[styles.dueLabel, { color: colors.textMuted }]}>{dueOrder.orderNumber}</Text>
            <Text style={[styles.dueAmount, { color: colors.primary }]}>
              {formatCurrency(dueOrder.total.amount, dueOrder.currency)}
            </Text>
            <Text style={[styles.dueSub, { color: colors.textSubtle }]}>{t('pay.amountDue')}</Text>
          </Card>

          {/* اختيار الطريقة */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('pay.method')}</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={t(methodLabelKey(m.id))}
                accessibilityState={{ selected: vm.method === m.id }}
                onPress={() => vm.setMethod(m.id)}
                style={[
                  styles.methodBtn,
                  {
                    backgroundColor: vm.method === m.id ? colors.primarySoft : colors.surfaceMuted,
                    borderColor: vm.method === m.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons name={m.icon} size={22} color={vm.method === m.id ? colors.primary : colors.textMuted} />
                <Text style={[styles.methodText, { color: vm.method === m.id ? colors.primary : colors.textMuted }]}>
                  {t(methodLabelKey(m.id))}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* القبض النقدي والباقي */}
          {vm.method === 'cash' ? (
            <View style={styles.cashBlock}>
              <Input
                label={t('pay.tendered')}
                placeholder={String(dueOrder.total.amount)}
                value={vm.tenderText}
                keyboardType="numeric"
                leftIcon="💵"
                onChangeText={vm.setTenderText}
                accessibilityLabel={t('pay.tendered')}
              />
              {/* فئات سريعة */}
              <View style={styles.quickRow}>
                {vm.quickAmounts.map((amount) => (
                  <Chip key={amount} label={formatCurrency(amount, dueOrder.currency, { compact: true })} onPress={() => vm.setQuickTender(amount)} />
                ))}
              </View>
              {vm.tender ? (
                <Card style={[styles.changeCard, { borderColor: vm.tender.isSufficient ? colors.success : colors.danger }]}>
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={vm.tender.isSufficient ? 'checkmark-circle' : 'alert-circle'}
                      size={20}
                      color={vm.tender.isSufficient ? colors.success : colors.danger}
                    />
                    <Text style={[styles.changeText, { color: vm.tender.isSufficient ? colors.success : colors.danger }]}>
                      {vm.tender.isSufficient
                        ? t('pay.changeDue') + ': ' + formatCurrency(vm.tender.changeDue.amount, dueOrder.currency)
                        : t('pay.insufficientCash')}
                    </Text>
                  </View>
                </Card>
              ) : null}
            </View>
          ) : (
            <Card glass style={styles.noteCard}>
              <Text style={[styles.noteText, { color: colors.textMuted }]}>{t('pay.gatewayNote')}</Text>
            </Card>
          )}

          {/* زر التحصيل */}
          <Button
            label={processing ? t('pay.processing') : t('pay.confirmPay')}
            icon="checkmark-circle-outline"
            variant="success"
            loading={processing}
            disabled={processing || (vm.method === 'cash' ? !vm.tender?.isSufficient : false)}
            onPress={() => void vm.pay()}
          />
        </View>
      ) : null}
    </Screen>
  );
}

// صف ملخص.
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: highlight ? colors.success : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  content: { gap: spacing.md },
  dueCard: { alignItems: 'center', gap: spacing.xs, borderRadius: radius.xl, paddingVertical: spacing.xl },
  dueLabel: { fontSize: fontSize.sm, fontWeight: '700' },
  dueAmount: { fontSize: 40, fontWeight: '900' },
  dueSub: { fontSize: fontSize.xs },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodBtn: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 80,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  methodText: { fontSize: fontSize.xs, fontWeight: '700' },
  cashBlock: { gap: spacing.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  changeCard: { borderRadius: radius.lg, borderWidth: 1.5 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  changeText: { fontSize: fontSize.md, fontWeight: '800', flex: 1 },
  noteCard: { borderRadius: radius.lg, padding: spacing.lg },
  noteText: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  // النجاح.
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: fontSize['2xl'], fontWeight: '800' },
  orderNumber: { fontSize: fontSize.xl, fontWeight: '800' },
  summaryCard: { width: '100%', gap: spacing.xs, borderRadius: radius.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  summaryLabel: { fontSize: fontSize.sm },
  summaryValue: { fontSize: fontSize.sm, fontWeight: '800' },
  receiptNote: { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18 },
});
