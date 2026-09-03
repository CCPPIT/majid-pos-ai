/**
 * شاشة ملف العميل (PHASE 19).
 * تعرض بيانات العميل، بطاقة ولاء (نقاط/شريحة/الإنفاق/متبقٍّ للترقية)،
 * سجل المشتريات، ملاحظات CRM، وتعديل الملف. محمية بصلاحية customers.read،
 * والتعديل/الملاحظات بـ customers.manage.
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
import { Avatar } from '@/design-system/primitives/Avatar';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Spinner } from '@/design-system/primitives/Spinner';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { customersRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import { customerToDraft, loyaltySummary, type Customer, type LoyaltyTier } from '@/domain/customers';
import { CustomerFormSheet } from './CustomerFormSheet';

// نغمة الشريحة.
function tierTone(tier: LoyaltyTier): Tone {
  switch (tier) {
    case 'platinum': return 'info';
    case 'gold': return 'warning';
    case 'silver': return 'neutral';
    case 'bronze': return 'primary';
  }
}

export function CustomerDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency, formatDate } = useTranslation();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const params = useLocalSearchParams<{ id: string }>();
  const customerId = String(params.id ?? '');

  const permissions = state.session?.permissions ?? [];
  const canManage = hasPermission(permissions, 'customers.manage');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);

  // تحميل العميل.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await customersRepository.getById(asId(customerId));
      setCustomer(found);
      setNotFound(!found);
    } catch (error) {
      logger.error('Customer load failed', { error: String(error) });
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Customer detail effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // حفظ تعديل الملف.
  const handleUpdate = async (draft: import('@/domain/customers').CustomerDraft) => {
    if (!customer || !canManage) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    const updated = await customersRepository.update(customer, draft);
    setCustomer(updated);
    toast.show(t('customers.updated'), 'success');
  };

  // إضافة ملاحظة CRM.
  const addNote = async () => {
    if (!customer || !canManage) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      const updated = await customersRepository.addNote(customer.id, noteText, {
        tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
        userId: state.session?.user?.id,
      });
      setCustomer(updated);
      setNoteText('');
      toast.show(t('customers.noteAdded'), 'success');
    } catch {
      toast.show(t('customers.error.noteFailed'), 'danger');
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

  if (notFound || !customer) {
    return (
      <Screen edges={['top']} padded={false}>
        <View style={styles.center}>
          <EmptyState icon="person-outline" title={t('customers.notFoundTitle')} description={t('customers.notFoundDescription')} actionLabel={t('common.back')} onAction={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const tone = tierTone(customer.tier);
  const palette = toneColors(colors, tone);
  const summary = loyaltySummary(customer);

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('customers.profileTitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* بطاقة الهوية */}
        <Card glass style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Avatar name={customer.fullName} size={64} />
            <View style={styles.identityInfo}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{customer.fullName}</Text>
              <Text style={[styles.sub, { color: colors.textSubtle }]} numberOfLines={1}>
                {customer.kind === 'business' ? t('customers.kind.business') : t('customers.kind.individual')}
              </Text>
              <View style={styles.badgeRow}>
                <Badge label={t(`customers.tier.${customer.tier}`)} tone={tone} />
                {customer.tags.map((tag) => (
                  <Badge key={tag} label={tag} tone="neutral" />
                ))}
              </View>
            </View>
          </View>
          <View style={styles.contactRows}>
            {customer.phone ? <ContactRow icon="call-outline" value={customer.phone} /> : null}
            {customer.email ? <ContactRow icon="mail-outline" value={customer.email} /> : null}
            {customer.address ? <ContactRow icon="location-outline" value={customer.address} /> : null}
          </View>
          {canManage ? (
            <Button label={t('customers.edit')} icon="create-outline" variant="secondary" onPress={() => setEditVisible(true)} />
          ) : null}
        </Card>

        {/* بطاقة الولاء */}
        <Card glass style={[styles.loyaltyCard, { borderColor: palette.soft }]}>
          <View style={styles.loyaltyTop}>
            <View>
              <Text style={[styles.loyaltyPoints, { color: palette.strong }]}>
                {t('customers.pointsBalance', { count: summary.points })}
              </Text>
              <Text style={[styles.loyaltyTier, { color: colors.textMuted }]}>
                {t('customers.tierLabel')}: {t(`customers.tier.${customer.tier}`)}
              </Text>
            </View>
            <Ionicons name="medal-outline" size={40} color={palette.strong} />
          </View>
          <View style={styles.loyaltyStats}>
            <LoyaltyStat label={t('customers.totalSpent')} value={formatCurrency(customer.totalSpent.amount, customer.totalSpent.currency)} />
            <LoyaltyStat label={t('customers.ordersCount', { count: customer.orderCount })} value={String(customer.orderCount)} />
          </View>
          {summary.nextTier ? (
            <Text style={[styles.toNext, { color: colors.textMuted }]}>
              {t('customers.toNextTier', {
                amount: formatCurrency(summary.toNextTier, customer.totalSpent.currency),
                tier: t(`customers.tier.${summary.nextTier}`),
              })}
            </Text>
          ) : (
            <Text style={[styles.toNext, { color: colors.success ?? colors.primary }]}>{t('customers.topTier')}</Text>
          )}
        </Card>

        {/* سجل المشتريات */}
        <Card glass style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('customers.purchaseHistory')}</Text>
          {customer.purchases.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('customers.noPurchases')}</Text>
          ) : (
            customer.purchases.slice(0, 20).map((p) => (
              <View key={String(p.orderId)} style={[styles.purchaseRow, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.purchaseNumber, { color: colors.primary }]}>{p.orderNumber}</Text>
                  <Text style={[styles.purchaseDate, { color: colors.textMuted }]}>{formatDate(p.at)}</Text>
                </View>
                <Text style={[styles.purchaseTotal, { color: colors.text }]}>
                  {formatCurrency(p.total.amount, p.total.currency)}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* ملاحظات CRM */}
        <Card glass style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('customers.notesTitle')}</Text>
          {customer.notes.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('customers.noNotes')}</Text>
          ) : (
            customer.notes.slice(0, 10).map((note) => (
              <View key={String(note.id)} style={styles.noteRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noteText, { color: colors.text }]}>{note.text}</Text>
                  <Text style={[styles.purchaseDate, { color: colors.textMuted }]}>{formatDate(note.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
          {canManage ? (
            <View style={styles.noteInput}>
              <View style={{ flex: 1 }}>
                <Input placeholder={t('customers.notePh')} value={noteText} onChangeText={setNoteText} />
              </View>
              <Button label={t('customers.addNote')} size="sm" loading={busy} onPress={() => void addNote()} />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {/* ورقة تعديل العميل — تُعاد التركيب بمفتاح لتهيئة القيم */}
      {editVisible ? (
        <CustomerFormSheet
          key="edit"
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          initial={customerToDraft(customer)}
          editing
          onSave={handleUpdate}
        />
      ) : null}
    </Screen>
  );
}

// صف تواصل.
function ContactRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.contactValue, { color: colors.textSubtle }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// إحصائية ولاء صغيرة.
function LoyaltyStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.loyaltyStat}>
      <Text style={[styles.loyaltyStatValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.loyaltyStatLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  identityCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  identityRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  identityInfo: { flex: 1, gap: 4 },
  name: { fontSize: fontSize.lg, fontWeight: '900' },
  sub: { fontSize: fontSize.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  contactRows: { gap: spacing.xs },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contactValue: { fontSize: fontSize.sm, flex: 1 },
  loyaltyCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1 },
  loyaltyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyPoints: { fontSize: fontSize['2xl'], fontWeight: '900' },
  loyaltyTier: { fontSize: fontSize.sm, fontWeight: '700' },
  loyaltyStats: { flexDirection: 'row', gap: spacing.md },
  loyaltyStat: { flex: 1 },
  loyaltyStatValue: { fontSize: fontSize.md, fontWeight: '900' },
  loyaltyStatLabel: { fontSize: fontSize.xs, fontWeight: '600' },
  toNext: { fontSize: fontSize.xs, fontWeight: '700' },
  section: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.xs },
  emptyText: { fontSize: fontSize.sm, fontStyle: 'italic' },
  purchaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  purchaseNumber: { fontSize: fontSize.sm, fontWeight: '800' },
  purchaseDate: { fontSize: 10, marginTop: 2 },
  purchaseTotal: { fontSize: fontSize.sm, fontWeight: '900' },
  noteRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs, alignItems: 'flex-start' },
  noteText: { fontSize: fontSize.sm, flex: 1 },
  noteInput: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
});
