/**
 * شاشة الموارد البشرية (PHASE 21).
 * تبويبان: الموظفون (بيانات/راتب/حالة + بصمة دخول/خروج) والحضور
 * (سجل الدوام بالدقائق والساعات). الإدارة محمية بصلاحية hr.manage
 * والحضور بـ attendance.manage، والقراءة employees.read.
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
import { Tabs } from '@/design-system/primitives/Tabs';
import { Button } from '@/design-system/primitives/Button';
import { Avatar } from '@/design-system/primitives/Avatar';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors, type Tone } from '@/design-system/tokens/colors';
import { useTranslation } from '@/i18n/LocaleProvider';
import { hrRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import { employeeToDraft, type AttendanceRecord, type Employee } from '@/domain/hr';
import { EmployeeFormSheet, emptyEmployeeDraft } from './EmployeeFormSheet';

type ListStatus = 'loading' | 'ready' | 'error';
type TabKey = 'employees' | 'attendance';

// نغمة حالة الموظف.
function statusTone(status: Employee['status']): Tone {
  switch (status) {
    case 'active': return 'success';
    case 'on_leave': return 'warning';
    case 'terminated': return 'neutral';
  }
}

function HrManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency, formatDateTime } = useTranslation();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];

  // الصلاحيات (إخفاء + إنفاذ).
  const canManageHr = hasPermission(permissions, 'hr.manage');
  const canManageAttendance = hasPermission(permissions, 'attendance.manage');

  const [tab, setTab] = useState<TabKey>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListStatus>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const currency = tenancy.context?.currency ?? 'YER';

  // سياق المنفّذ.
  const actorCtx = {
    tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
    organizationId: tenancy.context?.organizationId,
    branchId: tenancy.context?.branchId,
    storeId: tenancy.context?.storeId,
    userId: state.session?.user?.id,
    currency,
  };

  // تحميل البيانات.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [empList, attList] = await Promise.all([
        hrRepository.listEmployees({ search: search.trim() || undefined, storeId: tenancy.context?.storeId, branchId: tenancy.context?.branchId }),
        hrRepository.listAttendance(),
      ]);
      setEmployees(empList);
      setAttendance(attList);
      setStatus('ready');
    } catch (error) {
      logger.error('HR load failed', { error: String(error) });
      setStatus('error');
    }
  }, [search, tenancy.context]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('HR effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // هل للموظف فترة مفتوحة؟ (لإظهار زر الخروج بدل الدخول).
  const openRecordFor = (employeeId: string) =>
    attendance.find((r) => String(r.employeeId) === employeeId && r.status === 'open');

  // بصمة دخول.
  const handleClockIn = async (employee: Employee) => {
    if (!canManageAttendance) { toast.show(t('accessDenied.message'), 'danger'); return; }
    setBusyId(String(employee.id));
    try {
      await hrRepository.clockIn(employee.id, actorCtx);
      toast.show(t('hr.clockedIn'), 'success');
      await load();
    } catch (error) {
      toast.show(t('hr.error.clockFailed'), 'danger');
      logger.error('Clock in failed', { error: String(error) });
    } finally {
      setBusyId(null);
    }
  };

  // بصمة خروج.
  const handleClockOut = async (record: AttendanceRecord) => {
    if (!canManageAttendance) { toast.show(t('accessDenied.message'), 'danger'); return; }
    setBusyId(String(record.id));
    try {
      await hrRepository.clockOut(record.id);
      toast.show(t('hr.clockedOut'), 'success');
      await load();
    } catch (error) {
      toast.show(t('hr.error.clockFailed'), 'danger');
      logger.error('Clock out failed', { error: String(error) });
    } finally {
      setBusyId(null);
    }
  };

  // حفظ موظف (إنشاء/تعديل).
  const handleSave = async (draft: import('@/domain/hr').EmployeeDraft) => {
    if (!canManageHr) { toast.show(t('accessDenied.message'), 'danger'); return; }
    if (editingEmployee) {
      await hrRepository.updateEmployee(editingEmployee, draft, actorCtx);
      toast.show(t('hr.updated'), 'success');
    } else {
      await hrRepository.createEmployee(draft, actorCtx);
      toast.show(t('hr.created'), 'success');
    }
    await load();
  };

  // صف موظف.
  const renderEmployee = ({ item }: { item: Employee }) => {
    const tone = statusTone(item.status);
    const openRecord = openRecordFor(String(item.id));
    return (
      <Card glass style={styles.card}>
        <View style={styles.row}>
          <Avatar name={item.fullName} size={46} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.fullName}</Text>
            <Text style={[styles.sub, { color: colors.textSubtle }]} numberOfLines={1}>{item.position}</Text>
            <View style={styles.badgeRow}>
              <Badge label={t(`hr.status.${item.status}`)} tone={tone} />
              <Text style={[styles.salary, { color: colors.primary }]}>
                {formatCurrency(item.baseSalary.amount, item.baseSalary.currency)}
              </Text>
            </View>
          </View>
        </View>
        {canManageAttendance && item.status === 'active' ? (
          <View style={styles.actions}>
            {openRecord ? (
              <Button
                label={t('hr.clockOut')}
                icon="log-out-outline"
                variant="danger"
                size="sm"
                loading={busyId === String(openRecord.id)}
                onPress={() => void handleClockOut(openRecord)}
                style={styles.actionFlex}
              />
            ) : (
              <Button
                label={t('hr.clockIn')}
                icon="log-in-outline"
                variant="success"
                size="sm"
                loading={busyId === String(item.id)}
                onPress={() => void handleClockIn(item)}
                style={styles.actionFlex}
              />
            )}
            {canManageHr ? (
              <Button
                label={t('hr.edit')}
                icon="create-outline"
                variant="secondary"
                size="sm"
                onPress={() => { setEditingEmployee(item); setFormKey((k) => k + 1); setFormVisible(true); }}
                style={styles.actionFlex}
              />
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  // صف سجل حضور.
  const renderAttendance = ({ item }: { item: AttendanceRecord }) => {
    const palette = toneColors(colors, item.status === 'open' ? 'warning' : 'success');
    return (
      <Card glass style={styles.attCard}>
        <View style={[styles.attIcon, { backgroundColor: palette.soft }]}>
          <Ionicons name={item.status === 'open' ? 'time-outline' : 'checkmark-circle-outline'} size={20} color={palette.strong} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.employeeName}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
            {formatDateTime(item.clockIn)}
            {item.clockOut ? ` → ${formatDateTime(item.clockOut)}` : ''}
          </Text>
        </View>
        <View style={styles.attEnd}>
          <Badge label={item.status === 'open' ? t('hr.open') : t('hr.closed')} tone={item.status === 'open' ? 'warning' : 'success'} />
          {typeof item.workedMinutes === 'number' ? (
            <Text style={[styles.hours, { color: colors.primary }]}>{t('hr.hoursValue', { hours: (Math.round((item.workedMinutes / 60) * 10) / 10).toFixed(1) })}</Text>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('hr.title')}</Text>
        </View>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            { key: 'employees', label: t('hr.tabEmployees') },
            { key: 'attendance', label: t('hr.tabAttendance') },
          ]}
        />
        {tab === 'employees' ? <SearchInput value={search} onChangeText={setSearch} placeholder={t('hr.searchPh')} /> : null}
        {canManageHr && tab === 'employees' ? (
          <Button label={t('hr.addEmployee')} icon="person-add-outline" variant="primary" onPress={() => { setEditingEmployee(null); setFormKey((k) => k + 1); setFormVisible(true); }} />
        ) : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>{[0, 1, 2].map((i) => <Skeleton key={i} height={96} radiusToken="lg" />)}</View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('hr.errorTitle')} description={t('hr.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : tab === 'employees' ? (
        employees.length === 0 ? (
          <View style={styles.stateWrap}>
            <EmptyState icon="people-outline" title={t('hr.emptyTitle')} description={t('hr.emptyDescription')}
              actionLabel={canManageHr ? t('hr.addEmployee') : undefined}
              onAction={canManageHr ? () => { setEditingEmployee(null); setFormKey((k) => k + 1); setFormVisible(true); } : undefined} />
          </View>
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEmployee}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
          />
        )
      ) : attendance.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="time-outline" title={t('hr.emptyAttendanceTitle')} description={t('hr.emptyAttendanceDescription')} />
        </View>
      ) : (
        <FlatList
          data={attendance}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAttendance}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
        />
      )}

      {/* ورقة الموظف (تُعاد التركيب بمفتاح لكل فتح) */}
      <EmployeeFormSheet
        key={formKey}
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={editingEmployee ? employeeToDraft(editingEmployee) : emptyEmployeeDraft()}
        editing={!!editingEmployee}
        onSave={handleSave}
      />
    </Screen>
  );
}

// الشاشة الخارجية: تفرض صلاحية قراءة الموظفين.
export function HrScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="employees.read">
      <HrManager />
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
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  attCard: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  attIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: '800' },
  sub: { fontSize: fontSize.xs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  salary: { fontSize: fontSize.sm, fontWeight: '900' },
  hours: { fontSize: fontSize.sm, fontWeight: '900' },
  attEnd: { alignItems: 'flex-end', gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionFlex: { flex: 1 },
});
