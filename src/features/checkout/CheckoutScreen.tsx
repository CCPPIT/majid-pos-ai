/**
 * شاشة إتمام البيع / الدفع (PHASE 13 — Checkout).
 * مراجعة نهائية للبنود والإجماليات، اختيار العميل (زائر/باسم)، ثم إنشاء
 * طلب بيع يُخزَّن محليًا وتُصفَّر السلة. الدفع الفعلي يأتي في PHASE 14
 * (لافتة صادقة). الطلب يُنشأ بحالة "بانتظار الدفع".
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Chip } from '@/design-system/primitives/Chip';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useCart } from '@/features/cart/cart-context';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { ordersRepository, customersRepository } from '@/shared/container';
import type { SaleOrder } from '@/domain/sales/types';
import { orderQuantity } from '@/domain/sales/order';
import { hasPermission } from '@/security/permissions/permission';
import type { Customer } from '@/domain/customers';

// نوع العميل المختار في الشاشة.
type CustomerChoice = 'walk_in' | 'named' | 'registered';

export function CheckoutScreen() {
  const router = useRouter();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const { state } = useBootstrap();
  const { cart, totals, currency, taxRatePercent, clear } = useCart();
  const tenancy = useTenancy();

  const [customerType, setCustomerType] = useState<CustomerChoice>('walk_in'); // نوع العميل.
  const [customerName, setCustomerName] = useState(''); // اسم العميل (إن وُجد).
  const [registeredSearch, setRegisteredSearch] = useState(''); // بحث العميل المسجّل.
  const [registeredResults, setRegisteredResults] = useState<Customer[]>([]); // نتائج البحث.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); // العميل المسجّل المختار.
  const [submitting, setSubmitting] = useState(false); // حالة الإنشاء.

  // هل يمكن استخدام عملاء CRM؟ (صلاحية قراءة العملاء).
  const canUseCustomers = hasPermission(state.session?.permissions ?? [], 'customers.read');

  // بحث العميل المسجّل بالاسم/الهاتف.
  const searchRegistered = (text: string) => {
    setRegisteredSearch(text);
    if (!canUseCustomers) return;
    if (text.trim().length < 1) {
      setRegisteredResults([]);
      return;
    }
    // بحث غير متزامن عبر المستودع.
    Promise.resolve()
      .then(() => customersRepository.list({ search: text.trim(), storeId: tenancy.context?.storeId, limit: 6 }))
      .then((list) => setRegisteredResults(list))
      .catch(() => setRegisteredResults([]));
  };
  const [error, setError] = useState<string | null>(null); // رسالة خطأ.
  const [createdOrder, setCreatedOrder] = useState<SaleOrder | null>(null); // الطلب بعد النجاح.

  // الكاشير من الجلسة.
  const cashierName = state.session?.user.fullName ?? '—';
  const cashierId = state.session?.user.id;

  // إنشاء الطلب.
  const handleFinalize = async () => {
    if (submitting || totals.isEmpty) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await ordersRepository.createOrder(cart, totals, {
        // معرّفات الهرمية النشطة (قد تكون غير محملة قبل الإعداد).
        storeId: tenancy.context?.storeId,
        tenantId: tenancy.context?.tenantId,
        organizationId: tenancy.context?.organizationId,
        branchId: tenancy.context?.branchId,
        cashierId,
        cashierName,
        customer:
          customerType === 'registered' && selectedCustomer
            ? { type: 'registered', name: selectedCustomer.fullName, customerId: selectedCustomer.id, phone: selectedCustomer.phone }
            : customerType === 'named' && customerName.trim()
              ? { type: 'named', name: customerName.trim() }
              : { type: 'walk_in', name: t('checkout.walkIn') },
        taxRatePercent,
      });
      clear(); // نصفّر السلة بعد الحفظ.
      setCreatedOrder(order);
    } catch {
      setError(t('checkout.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── شاشة النجاح بعد إنشاء الطلب ──
  if (createdOrder) {
    return (
      <Screen edges={['top']}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={56} color="#fff" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>{t('checkout.orderCreated')}</Text>
          <Text style={[styles.orderNumber, { color: colors.primary }]}>{createdOrder.orderNumber}</Text>
          <Card glass style={styles.successCard}>
            <SuccessRow label={t('checkout.totalPaid')} value={formatCurrency(createdOrder.total.amount, createdOrder.currency)} />
            <SuccessRow label={t('orders.itemsCount')} value={String(orderQuantity(createdOrder))} />
            <SuccessRow label={t('checkout.customerLabel')} value={createdOrder.customer.name} />
          </Card>
          <Text style={[styles.payNote, { color: colors.textSubtle }]}>{t('checkout.paymentPhaseNote')}</Text>
          <View style={{ gap: spacing.sm, width: '100%' }}>
            <Button
              label={t('checkout.payNow')}
              icon="card-outline"
              onPress={() => router.replace(`/(app)/payment?orderId=${encodeURIComponent(String(createdOrder.id))}` as never)}
            />
            <Button label={t('checkout.newSale')} variant="secondary" icon="add-circle-outline" onPress={() => router.replace('/(app)/(tabs)/pos')} />
          </View>
        </View>
      </Screen>
    );
  }

  // ── شاشة المراجعة ──
  return (
    <Screen edges={['top']} scroll>
      {/* ترويسة الرجوع */}
      <View style={styles.header}>
        <Button label={t('common.back')} variant="secondary" icon="arrow-back-outline" size="sm" onPress={() => router.back()} style={styles.backBtn} />
        <Text style={[styles.title, { color: colors.text }]}>{t('checkout.title')}</Text>
      </View>

      {totals.isEmpty ? (
        <EmptyState icon="cart-outline" title={t('cart.empty')} description={t('cart.emptyDescription')} />
      ) : (
        <View style={styles.content}>
          {/* بيانات المتجر والكاشير */}
          <Card glass style={styles.infoCard}>
            <InfoRow icon="storefront-outline" label={t('tenancy.activeStore')} value={tenancy.context?.storeName ?? '—'} />
            <InfoRow icon="git-branch-outline" label={t('tenancy.branch')} value={tenancy.context?.branchName ?? '—'} />
            <InfoRow icon="person-outline" label={t('checkout.cashier')} value={cashierName} />
          </Card>

          {/* اختيار العميل */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('checkout.customerLabel')}</Text>
          <View style={styles.chipRow}>
            <Chip
              label={t('checkout.walkIn')}
              icon="person-circle-outline"
              selected={customerType === 'walk_in'}
              onPress={() => setCustomerType('walk_in')}
            />
            <Chip
              label={t('checkout.namedCustomer')}
              icon="create-outline"
              selected={customerType === 'named'}
              onPress={() => setCustomerType('named')}
            />
            {canUseCustomers ? (
              <Chip
                label={t('checkout.registeredCustomer')}
                icon="people-outline"
                selected={customerType === 'registered'}
                onPress={() => setCustomerType('registered')}
              />
            ) : null}
          </View>
          {customerType === 'named' ? (
            <Input
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t('checkout.customerNamePlaceholder')}
              leftIcon="👤"
              accessibilityLabel={t('checkout.customerLabel')}
            />
          ) : null}
          {customerType === 'registered' ? (
            <View style={styles.registeredWrap}>
              {selectedCustomer ? (
                <Card glass style={styles.selectedCustomerCard}>
                  <View style={styles.selectedCustomerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedCustomerName, { color: colors.text }]} numberOfLines={1}>
                        {selectedCustomer.fullName}
                      </Text>
                      <Text style={[styles.selectedCustomerMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {selectedCustomer.phone ?? '—'} · {t(`customers.tier.${selectedCustomer.tier}`)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.cancel')}
                      onPress={() => { setSelectedCustomer(null); setRegisteredSearch(''); setRegisteredResults([]); }}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <Input
                  value={registeredSearch}
                  onChangeText={searchRegistered}
                  placeholder={t('checkout.searchCustomerPh')}
                  leftIcon="🔍"
                  accessibilityLabel={t('checkout.customerLabel')}
                />
              )}
              {!selectedCustomer && registeredResults.length > 0 ? (
                <Card glass style={styles.resultsCard}>
                  {registeredResults.map((c) => (
                    <Pressable
                      key={String(c.id)}
                      accessibilityRole="button"
                      onPress={() => { setSelectedCustomer(c); setRegisteredResults([]); setRegisteredSearch(''); }}
                      style={[styles.resultRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>{c.fullName}</Text>
                      <Text style={[styles.resultMeta, { color: colors.textMuted }]} numberOfLines={1}>{c.phone ?? '—'}</Text>
                    </Pressable>
                  ))}
                </Card>
              ) : null}
            </View>
          ) : null}

          {/* ملخص البنود */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('checkout.items')}</Text>
          <Card glass style={styles.itemsCard}>
            {cart.lines.map((line) => (
              <View key={String(line.productId)} style={styles.lineRow}>
                <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>
                  {locale === 'ar' ? line.nameAr : line.nameEn}
                </Text>
                <Text style={[styles.lineQty, { color: colors.textSubtle }]}>×{line.quantity}</Text>
                <Text style={[styles.lineTotal, { color: colors.text }]}>
                  {formatCurrency(line.unitPrice.amount * line.quantity, currency)}
                </Text>
              </View>
            ))}
          </Card>

          {/* الإجماليات */}
          <Card style={styles.totalsCard}>
            <TotalsRow label={t('cart.subtotal')} value={formatCurrency(totals.subtotal.amount, currency)} />
            {totals.discount.amount > 0 ? (
              <TotalsRow label={t('cart.discount')} value={`- ${formatCurrency(totals.discount.amount, currency)}`} danger />
            ) : null}
            <TotalsRow label={t('cart.tax')} value={formatCurrency(totals.taxAmount.amount, currency)} />
            <View style={[styles.grandRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandLabel, { color: colors.text }]}>{t('cart.total')}</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>
                {formatCurrency(totals.total.amount, currency)}
              </Text>
            </View>
          </Card>

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          {/* زر الإتمام (الدفع الفعلي لافتة صادقة في PHASE 14) */}
          <Button
            label={t('checkout.finalize')}
            icon="checkmark-circle-outline"
            variant="success"
            loading={submitting}
            disabled={totals.isEmpty}
            onPress={() => void handleFinalize()}
          />
          <Text style={[styles.phaseNote, { color: colors.textSubtle }]}>{t('checkout.paymentPhaseNote')}</Text>
        </View>
      )}
    </Screen>
  );
}

// صف معلومات (أيقونة + تسمية + قيمة).
function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textSubtle} />
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// صف إجمالي بسيط.
function TotalsRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.totalsValue, { color: danger ? colors.danger : colors.text }]}>{value}</Text>
    </View>
  );
}

// صف نجاح.
function SuccessRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.totalsValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  content: { gap: spacing.md },
  infoCard: { gap: spacing.sm, borderRadius: radius.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: { fontSize: fontSize.sm, flexShrink: 1 },
  infoValue: { fontSize: fontSize.sm, fontWeight: '700', flex: 1, textAlign: 'right' },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  registeredWrap: { gap: spacing.sm },
  selectedCustomerCard: { padding: spacing.md, borderRadius: radius.md },
  selectedCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectedCustomerName: { fontSize: fontSize.md, fontWeight: '800' },
  selectedCustomerMeta: { fontSize: fontSize.xs, marginTop: 2 },
  resultsCard: { padding: spacing.sm, borderRadius: radius.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName: { flex: 1, fontSize: fontSize.sm, fontWeight: '700' },
  resultMeta: { fontSize: fontSize.xs },
  itemsCard: { gap: spacing.xs, borderRadius: radius.lg },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  lineName: { flex: 1, fontSize: fontSize.sm, fontWeight: '600' },
  lineQty: { fontSize: fontSize.sm, minWidth: 34, textAlign: 'center' },
  lineTotal: { fontSize: fontSize.sm, fontWeight: '800', minWidth: 90, textAlign: 'right' },
  totalsCard: { gap: spacing.xs, borderRadius: radius.lg },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsLabel: { fontSize: fontSize.sm },
  totalsValue: { fontSize: fontSize.sm, fontWeight: '700' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.xs },
  grandLabel: { fontSize: fontSize.lg, fontWeight: '800' },
  grandValue: { fontSize: fontSize.xl, fontWeight: '800' },
  error: { fontSize: fontSize.sm, textAlign: 'center', fontWeight: '600' },
  phaseNote: { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18 },
  // شاشة النجاح.
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: fontSize['2xl'], fontWeight: '800' },
  orderNumber: { fontSize: fontSize.xl, fontWeight: '800' },
  successCard: { width: '100%', gap: spacing.sm, borderRadius: radius.lg },
  payNote: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
