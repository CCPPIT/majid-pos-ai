/**
 * شاشة تفاصيل أمر الشراء (PHASE 18).
 * تعرض المورّد، الأسطر (مطلوب/مُستلَم)، الإجماليات، وأزرار دورة الحياة:
 * تقديم → اعتماد → استلام كل صنف → (إلغاء). الاستلام يحدّث المخزون فعلًا.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Badge } from '@/design-system/primitives/Badge';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { procurementRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import {
  isFullyReceived,
  isReceivable,
  totalOrderedQuantity,
  totalReceivedQuantity,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '@/domain/procurement';

// نغمة الحالة.
function statusTone(status: PurchaseOrderStatus): Tone {
  switch (status) {
    case 'draft': return 'neutral';
    case 'submitted': return 'info';
    case 'approved': return 'primary';
    case 'partially_received': return 'warning';
    case 'received': return 'success';
    case 'cancelled': return 'danger';
  }
}

export function PurchaseOrderDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const params = useLocalSearchParams<{ id: string }>();
  const poId = String(params.id ?? '');

  const permissions = state.session?.permissions ?? [];
  const canCreate = hasPermission(permissions, 'procurement.create');
  const canApprove = hasPermission(permissions, 'procurement.approve');

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // كمية الاستلام لكل صنف (مفتاح: معرف المنتج).
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // سياق المنفّذ.
  const actorCtx = {
    tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
    organizationId: tenancy.context?.organizationId,
    branchId: tenancy.context?.branchId,
    storeId: tenancy.context?.storeId,
    userId: state.session?.user?.id,
  };

  // تحميل الأمر.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await procurementRepository.getPurchaseOrder(asId(poId));
      setPo(found);
      setNotFound(!found);
    } catch (error) {
      logger.error('PO load failed', { error: String(error) });
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('PO detail effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // تغيير الحالة (تقديم/اعتماد/إلغاء).
  const changeStatus = async (to: PurchaseOrderStatus) => {
    if (!po) return;
    if (to === 'approved' && !canApprove) { toast.show(t('accessDenied.message'), 'danger'); return; }
    if ((to === 'submitted' || to === 'cancelled') && !canCreate) { toast.show(t('accessDenied.message'), 'danger'); return; }
    setBusy(true);
    try {
      const updated = await procurementRepository.changeStatus(po.id, to, actorCtx);
      setPo(updated);
      toast.show(t('procurement.statusUpdated'), 'success');
    } catch (error) {
      toast.show(t('procurement.error.actionFailed'), 'danger');
      logger.error('PO status change failed', { error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  // استلام كمية لصنف.
  const receiveLine = async (productId: string) => {
    if (!po) return;
    const qty = Number(receiveQty[productId] ?? '0');
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.show(t('procurement.error.quantityInvalid'), 'danger');
      return;
    }
    setBusy(true);
    try {
      const updated = await procurementRepository.receiveOrderLine(po.id, asId(productId), qty, actorCtx);
      setPo(updated);
      setReceiveQty((prev) => ({ ...prev, [productId]: '' }));
      toast.show(t('procurement.receivedOk'), 'success');
    } catch (error) {
      toast.show(t('procurement.error.actionFailed'), 'danger');
      logger.error('PO receive failed', { error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top']} padded={false}>
        <View style={styles.center}><Spinner size="large" /></View>
      </Screen>
    );
  }

  if (notFound || !po) {
    return (
      <Screen edges={['top']} padded={false}>
        <View style={styles.center}>
          <EmptyState icon="document-outline" title={t('procurement.notFoundTitle')} description={t('procurement.notFoundDescription')} actionLabel={t('common.back')} onAction={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const tone = statusTone(po.status);
  const palette = toneColors(colors, tone);
  const supplierName = locale === 'ar' ? po.supplierNameAr : po.supplierNameEn;
  const receivable = isReceivable(po);

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.primary }]}>{po.poNumber}</Text>
          <Badge label={t(`procurement.status.${po.status}`)} tone={tone} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* بطاقة المورّد */}
        <Card glass style={styles.section}>
          <View style={styles.supplierRow}>
            <View style={[styles.supplierIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.supplierName, { color: colors.text }]}>{supplierName}</Text>
              <Text style={[styles.meta, { color: palette.strong }]}>
                {t('procurement.receivedProgress', { received: totalReceivedQuantity(po), ordered: totalOrderedQuantity(po) })}
              </Text>
            </View>
          </View>
          {po.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>{po.notes}</Text> : null}
        </Card>

        {/* الأسطر */}
        {po.lines.map((line) => {
          const name = locale === 'ar' ? line.nameAr : line.nameEn;
          const remaining = line.orderedQuantity - line.receivedQuantity;
          const fullyReceivedLine = line.receivedQuantity >= line.orderedQuantity;
          return (
            <Card key={String(line.productId)} glass style={styles.lineCard}>
              <View style={styles.lineTop}>
                <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                <Text style={[styles.lineCost, { color: colors.primary }]}>{formatCurrency(line.lineTotal.amount, line.lineTotal.currency)}</Text>
              </View>
              <View style={styles.lineMeta}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('procurement.ordered')}: {line.orderedQuantity}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('procurement.received')}: {line.receivedQuantity}
                </Text>
                <Text style={[styles.meta, { color: remaining > 0 ? colors.warning : colors.success }]}>
                  {t('procurement.remaining')}: {remaining}
                </Text>
              </View>
              {/* حقل الاستلام يظهر فقط للأوامر القابلة للاستلام وللأصناف غير المكتملة */}
              {receivable && !fullyReceivedLine ? (
                <View style={styles.receiveRow}>
                  <View style={styles.receiveInput}>
                    <Input
                      keyboardType="number-pad"
                      placeholder={t('procurement.receiveQtyPh', { max: remaining })}
                      value={receiveQty[String(line.productId)] ?? ''}
                      onChangeText={(v) => setReceiveQty((prev) => ({ ...prev, [String(line.productId)]: v.replace(/[^0-9]/g, '') }))}
                    />
                  </View>
                  <Button label={t('procurement.receive')} icon="cube-outline" size="sm" loading={busy} onPress={() => void receiveLine(String(line.productId))} />
                </View>
              ) : null}
            </Card>
          );
        })}

        {/* الإجماليات */}
        <Card glass style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('procurement.subtotal')}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(po.subtotal.amount, po.subtotal.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('procurement.tax')} ({po.taxRate}%)</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(po.tax.amount, po.tax.currency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.grandLabel, { color: colors.primary }]}>{t('procurement.total')}</Text>
            <Text style={[styles.grandValue, { color: colors.primary }]}>{formatCurrency(po.total.amount, po.total.currency)}</Text>
          </View>
        </Card>

        {/* أزرار دورة الحياة */}
        <View style={styles.actions}>
          {po.status === 'draft' ? (
            <>
              <Button label={t('procurement.submit')} icon="send-outline" variant="primary" loading={busy} onPress={() => void changeStatus('submitted')} style={styles.flex} />
              <Button label={t('procurement.cancelOrder')} variant="danger" loading={busy} onPress={() => void changeStatus('cancelled')} style={styles.flex} />
            </>
          ) : po.status === 'submitted' ? (
            <>
              {canApprove ? <Button label={t('procurement.approve')} icon="checkmark-done-outline" variant="success" loading={busy} onPress={() => void changeStatus('approved')} style={styles.flex} /> : null}
              <Button label={t('procurement.cancelOrder')} variant="danger" loading={busy} onPress={() => void changeStatus('cancelled')} style={styles.flex} />
            </>
          ) : receivable ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {isFullyReceived(po) ? t('procurement.fullyReceivedHint') : t('procurement.receiveHint')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '900', flex: 1 },
  body: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  section: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  supplierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  supplierIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  supplierName: { fontSize: fontSize.md, fontWeight: '800' },
  meta: { fontSize: fontSize.xs, fontWeight: '600' },
  notes: { fontSize: fontSize.sm, fontStyle: 'italic' },
  lineCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  lineName: { flex: 1, fontSize: fontSize.md, fontWeight: '800' },
  lineCost: { fontSize: fontSize.sm, fontWeight: '900' },
  lineMeta: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  receiveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  receiveInput: { flex: 1 },
  totalsCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: fontSize.sm },
  totalValue: { fontSize: fontSize.sm, fontWeight: '800' },
  grandRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: spacing.xs },
  grandLabel: { fontSize: fontSize.md, fontWeight: '900' },
  grandValue: { fontSize: fontSize.lg, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  hint: { fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center', flex: 1 },
});
