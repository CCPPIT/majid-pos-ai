/**
 * شاشة العملاء (PHASE 19).
 * قائمة عملاء CRM مع بحث وشريحة ولون، إضافة عميل (FAB)، ضغط لفتح الملف.
 * محمية بصلاحية customers.read (الشاشة) وcustomers.create (الإضافة).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { SearchInput } from '@/design-system/primitives/SearchInput';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Badge } from '@/design-system/primitives/Badge';
import { Avatar } from '@/design-system/primitives/Avatar';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { customersRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import type { Customer, CustomerDraft, LoyaltyTier } from '@/domain/customers';
import { CustomerFormSheet } from './CustomerFormSheet';

type ListStatus = 'loading' | 'ready' | 'error';

// نغمة الشريحة.
function tierTone(tier: LoyaltyTier): Tone {
  switch (tier) {
    case 'platinum': return 'info';
    case 'gold': return 'warning';
    case 'silver': return 'neutral';
    case 'bronze': return 'primary';
  }
}

// نموذج عميل فارغ.
function emptyDraft(): CustomerDraft {
  return { kind: 'individual', fullName: '', phone: '', email: '', address: '', preferredChannel: 'whatsapp', tags: '' };
}

function CustomersManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];

  const canManage = hasPermission(permissions, 'customers.manage');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListStatus>('loading');
  const [formVisible, setFormVisible] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // تحميل العملاء.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await customersRepository.list({
        search: search.trim() || undefined,
        storeId: tenancy.context?.storeId,
        branchId: tenancy.context?.branchId,
      });
      setCustomers(list);
      setStatus('ready');
    } catch (error) {
      logger.error('Customers load failed', { error: String(error) });
      setStatus('error');
    }
  }, [search, tenancy.context]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Customers effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // إنشاء عميل جديد.
  const handleCreate = async (draft: CustomerDraft) => {
    if (!canManage) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    await customersRepository.create(draft, {
      tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
      organizationId: tenancy.context?.organizationId,
      branchId: tenancy.context?.branchId,
      storeId: tenancy.context?.storeId,
      userId: state.session?.user?.id,
      currency: tenancy.context?.currency ?? 'YER',
    });
    toast.show(t('customers.created'), 'success');
    await load();
  };

  // صف عميل.
  const renderItem = ({ item }: { item: Customer }) => {
    const tone = tierTone(item.tier);
    const palette = toneColors(colors, tone);
    return (
      <Pressable onPress={() => router.push(`/(app)/customer/${String(item.id)}` as never)} accessibilityRole="button">
        <Card glass style={styles.card}>
          <View style={styles.row}>
            <Avatar name={item.fullName} size={44} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.fullName}</Text>
              <Text style={[styles.sub, { color: colors.textSubtle }]} numberOfLines={1}>
                {item.phone ?? item.email ?? '—'}
              </Text>
              <View style={styles.metaRow}>
                <Badge label={t(`customers.tier.${item.tier}`)} tone={tone} />
                <Text style={[styles.points, { color: palette.strong }]}>
                  {t('customers.points', { count: item.pointsBalance })}
                </Text>
              </View>
            </View>
            <View style={styles.end}>
              <Text style={[styles.spent, { color: colors.primary }]}>
                {formatCurrency(item.totalSpent.amount, item.totalSpent.currency)}
              </Text>
              <Text style={[styles.orders, { color: colors.textMuted }]}>
                {t('customers.ordersCount', { count: item.orderCount })}
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('customers.title')}</Text>
        </View>
        <SearchInput value={search} onChangeText={setSearch} placeholder={t('customers.searchPh')} />
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={76} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('customers.errorTitle')} description={t('customers.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="people-outline" title={t('customers.emptyTitle')} description={t('customers.emptyDescription')}
            actionLabel={canManage ? t('customers.add') : undefined}
            onAction={canManage ? () => { setFormKey((k) => k + 1); setFormVisible(true); } : undefined} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
        />
      )}

      {/* زر إضافة عائم */}
      {canManage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('customers.add')}
          onPress={() => { setFormKey((k) => k + 1); setFormVisible(true); }}
          style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="add" size={28} color={colors.primaryContrast} />
        </Pressable>
      ) : null}

      <CustomerFormSheet
        key={formKey}
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={emptyDraft()}
        editing={false}
        onSave={handleCreate}
      />
    </Screen>
  );
}

// الشاشة الخارجية: تفرض صلاحية قراءة العملاء.
export function CustomersScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="customers.read">
      <CustomersManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: '800' },
  sub: { fontSize: fontSize.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  points: { fontSize: fontSize.xs, fontWeight: '800' },
  end: { alignItems: 'flex-end', gap: 2 },
  spent: { fontSize: fontSize.sm, fontWeight: '900' },
  orders: { fontSize: 10, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    end: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
