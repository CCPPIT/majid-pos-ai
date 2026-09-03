/**
 * شاشة الإيصال (PHASE 15 — Receipts).
 * تبني الإيصال من الطلب (+الدفعة) عبر المجال، تعرضه كبطاقة إيصال منسّقة،
 * وتتيح المشاركة (نص جاهز للطابعات الحرارية) عبر Share المدمج.
 * الطباعة الحرارية الفعلية تُربط لاحقًا (لافتة صادقة).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { asId, type ID } from '@/core/types/domain';
import { logger } from '@/core/logging/logger';
import { ordersRepository, paymentsRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { buildReceipt, receiptToText, type Receipt as ReceiptModel, type ReceiptLabels } from '@/domain/receipts';
import { methodLabelKey } from '@/domain/payments/calculations';
import type { Payment } from '@/domain/payments/types';
import type { SaleOrder } from '@/domain/sales/types';

// حالة الشاشة.
type ReceiptStatus =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'ready'; receipt: ReceiptModel; order: SaleOrder };

export function ReceiptScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId: ID | null = params.orderId ? asId(String(params.orderId)) : null;
  const { t, formatCurrency, formatDateTime } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const [status, setStatus] = useState<ReceiptStatus>({ kind: 'loading' });

  // تحميل الطلب وآخر دفعة ناجحة وبناء الإيصال.
  const load = useCallback(async () => {
    if (!orderId) {
      setStatus({ kind: 'notfound' });
      return;
    }
    const order = await ordersRepository.getOrder(orderId);
    if (!order) {
      setStatus({ kind: 'notfound' });
      return;
    }
    const payments = await paymentsRepository.listPaymentsForOrder(orderId);
    const payment: Payment | null = payments.find((p) => p.state === 'completed') ?? null;

    // تسميات الإيصال المترجمة.
    const labels: ReceiptLabels = {
      subtotal: t('cart.subtotal'),
      discount: t('cart.discount'),
      tax: t('cart.tax'),
      total: t('cart.total'),
      customer: t('checkout.customerLabel'),
      cashier: t('checkout.cashier'),
      items: t('orders.itemsCount'),
      tendered: t('pay.tendered'),
      change: t('pay.changeDue'),
      reference: t('pay.reference'),
      paymentMethod: t('pay.method'),
      paid: t('orders.statusPaid'),
      unpaid: t('orders.statusUnpaid'),
      thanks: t('receipt.thanks'),
    };

    const receipt = buildReceipt(order, payment, {
      header: {
        businessName: tenancy.context?.tenantName ?? order.cashierName,
        branchName: tenancy.context?.branchName,
        storeName: tenancy.context?.storeName ?? '',
      },
      formatMoney: (amount, ccy) => formatCurrency(amount, ccy),
      labels,
      locale,
      dateText: formatDateTime(order.createdAt),
      paymentMethodLabel: payment ? t(methodLabelKey(payment.method)) : undefined,
    });
    setStatus({ kind: 'ready', receipt, order });
  }, [orderId, t, formatCurrency, formatDateTime, locale, tenancy.context]);

  useEffect(() => {
    Promise.resolve().then(() => load()).catch((e: unknown) => {
      logger.error('Receipt load failed', { error: String(e) });
      setStatus({ kind: 'notfound' });
    });
  }, [load]);

  // مشاركة الإيصال نصيًا (جاهز للطابعة الحرارية/واتساب).
  const handleShare = async (receipt: ReceiptModel) => {
    const labels: ReceiptLabels = {
      subtotal: t('cart.subtotal'), discount: t('cart.discount'), tax: t('cart.tax'), total: t('cart.total'),
      customer: t('checkout.customerLabel'), cashier: t('checkout.cashier'), items: t('orders.itemsCount'),
      tendered: t('pay.tendered'), change: t('pay.changeDue'), reference: t('pay.reference'),
      paymentMethod: t('pay.method'), paid: t('orders.statusPaid'), unpaid: t('orders.statusUnpaid'),
      thanks: t('receipt.thanks'),
    };
    try {
      const text = receiptToText(receipt, labels);
      await Share.share({ message: text });
    } catch (error) {
      logger.warn('Receipt share failed', { error: String(error) });
    }
  };

  // الطباعة الحرارية تُربط لاحقًا (لا وظيفة وهمية).
  const handlePrint = () => {
    toast.show(t('receipt.printComingSoon'), 'info');
  };

  if (status.kind === 'loading') {
    return (
      <Screen edges={['top']}>
        <View style={styles.center}><Spinner size="large" /></View>
      </Screen>
    );
  }
  if (status.kind === 'notfound') {
    return (
      <Screen edges={['top']}>
        <EmptyState
          icon="receipt-outline"
          title={t('receipt.notFound')}
          description={t('receipt.notFoundDesc')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const { receipt, order } = status;

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* بطاقة الإيصال */}
        <Card style={[styles.receiptCard, { borderColor: colors.border }]}>
          {/* ترويسة */}
          <View style={styles.centerCol}>
            <Text style={[styles.business, { color: colors.text }]}>{receipt.header.businessName}</Text>
            {receipt.header.branchName ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{receipt.header.branchName}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.textMuted }]}>{receipt.header.storeName}</Text>
          </View>

          <View style={[styles.dashed, { borderColor: colors.border }]} />

          {/* رقم/تاريخ/حالة */}
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{receipt.orderNumber}</Text>
            <Badge label={receipt.isPaid ? t('orders.statusPaid') : t('orders.statusUnpaid')} tone={receipt.isPaid ? 'success' : 'warning'} />
          </View>
          <Text style={[styles.meta, { color: colors.textSubtle }]}>{receipt.dateText}</Text>

          <View style={[styles.dashed, { borderColor: colors.border }]} />

          {/* الأصناف */}
          {receipt.lines.map((line, i) => (
            <View key={i} style={styles.lineBlock}>
              <Text style={[styles.lineName, { color: colors.text }]}>{line.name}</Text>
              <View style={styles.lineNumbers}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {line.quantity} × {line.unitPriceText}
                </Text>
                <Text style={[styles.lineTotal, { color: colors.text }]}>{line.lineTotalText}</Text>
              </View>
            </View>
          ))}

          <View style={[styles.dashed, { borderColor: colors.border }]} />

          {/* الإجماليات */}
          {receipt.totals.map((row, i) => (
            <View key={i} style={styles.totalRow}>
              <Text style={[row.emphasis ? styles.grandLabel : styles.meta, { color: row.emphasis ? colors.text : colors.textMuted }]}>
                {row.label}
              </Text>
              <Text style={[row.emphasis ? styles.grandValue : styles.totalValue, { color: row.emphasis ? colors.primary : colors.text }]}>
                {row.value}
              </Text>
            </View>
          ))}

          {/* الدفع */}
          {receipt.payment ? (
            <>
              <View style={[styles.dashed, { borderColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{t('pay.method')}</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>{receipt.payment.methodLabel}</Text>
              </View>
              {receipt.payment.tenderedText ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{t('pay.tendered')}</Text>
                  <Text style={[styles.totalValue, { color: colors.text }]}>{receipt.payment.tenderedText}</Text>
                </View>
              ) : null}
              {receipt.payment.changeText ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{t('pay.changeDue')}</Text>
                  <Text style={[styles.totalValue, { color: colors.success }]}>{receipt.payment.changeText}</Text>
                </View>
              ) : null}
              {receipt.payment.reference ? (
                <Text style={[styles.reference, { color: colors.textSubtle }]}>{t('pay.reference')}: {receipt.payment.reference}</Text>
              ) : null}
            </>
          ) : null}

          <View style={[styles.dashed, { borderColor: colors.border }]} />

          {/* العميل/الكاشير */}
          <View style={styles.totalRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{t('checkout.customerLabel')}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{receipt.customerName}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{t('checkout.cashier')}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{receipt.cashierName}</Text>
          </View>

          <Text style={[styles.thanks, { color: colors.primary }]}>{receipt.footerText}</Text>
        </Card>

        {/* الإجراءات */}
        <View style={styles.actions}>
          {!receipt.isPaid ? (
            <Button
              label={t('pay.confirmPay')}
              variant="success"
              icon="card-outline"
              onPress={() => router.replace(`/(app)/payment?orderId=${encodeURIComponent(String(order.id))}` as never)}
            />
          ) : null}
          <Button label={t('receipt.share')} icon="share-social-outline" onPress={() => void handleShare(receipt)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('receipt.print')}
            onPress={handlePrint}
            style={({ pressed }) => [styles.printBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="print-outline" size={20} color={colors.primary} />
            <Text style={[styles.printText, { color: colors.primary }]}>{t('receipt.print')}</Text>
          </Pressable>
          <View style={styles.rowBtns}>
            <Button label={t('pay.newSale')} variant="secondary" icon="add-circle-outline" style={styles.flexBtn} onPress={() => router.replace('/(app)/(tabs)/pos')} />
            <Button label={t('pay.viewOrders')} variant="secondary" icon="receipt-outline" style={styles.flexBtn} onPress={() => router.replace('/(app)/(tabs)/orders')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['5xl'] },
  receiptCard: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, borderWidth: 1.5 },
  centerCol: { alignItems: 'center', gap: 2 },
  business: { fontSize: fontSize.lg, fontWeight: '900' },
  meta: { fontSize: fontSize.xs },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed', marginVertical: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineBlock: { gap: 2 },
  lineName: { fontSize: fontSize.sm, fontWeight: '700' },
  lineNumbers: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTotal: { fontSize: fontSize.sm, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalValue: { fontSize: fontSize.sm, fontWeight: '700' },
  grandLabel: { fontSize: fontSize.md, fontWeight: '800' },
  grandValue: { fontSize: fontSize.xl, fontWeight: '900' },
  reference: { fontSize: fontSize.xs, textAlign: 'right' },
  thanks: { fontSize: fontSize.sm, fontWeight: '800', textAlign: 'center', marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  printText: { fontSize: fontSize.md, fontWeight: '800' },
  rowBtns: { flexDirection: 'row', gap: spacing.sm },
  flexBtn: { flex: 1 },
});
