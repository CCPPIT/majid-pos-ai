/**
 * شاشة المزيد — مركز التنقل + السياق النشط (المتجر/الفرع).
 * تعرض المتجر النشط مع زر تبديل حقيقي إن سمح نطاق الدور، وبوابة للإعدادات.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Screen, useTheme } from '@/design-system';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { canAccess } from '@/shared/navigation/navigation-registry';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { StoreSwitcher } from '@/features/tenancy/StoreSwitcher';

// عنصر تنقل في القائمة.
interface MoreItem {
  key: string; // معرّف العنصر.
  labelKey: string; // مفتاح الترجمة.
  icon: keyof typeof Ionicons.glyphMap; // الأيقونة.
  permission?: string; // الصلاحية المطلوبة (اختياري).
  href:
    | '/(app)/(tabs)/reports'
    | '/(app)/store-setup'
    | '/(app)/products'
    | '/(app)/inventory'
    | '/(app)/procurement'
    | '/(app)/customers'
    | '/(app)/finance'
    | '/(app)/hr'
    | '/(app)/sync'
    | '/(app)/copilot'
    | '/(app)/agents'
    | '/(app)/security'
    | '/(app)/audit'
    | '/(app)/about'; // الوجهة.
}

export default function MoreTab() {
  const router = useRouter(); // للتنقل.
  const { state, signOut } = useBootstrap(); // الجلسة وتسجيل الخروج.
  const { colors, spacing, textVariants } = useTheme(); // الثيم.
  const { t } = useTranslation(); // الترجمة.
  const { context, canSwitchStore } = useTenancy(); // سياق المستأجر.
  const permissions = state.session?.permissions ?? []; // صلاحيات الجلسة.
  const [switcherVisible, setSwitcherVisible] = useState(false); // حالة ورقة التبديل.

  // عناصر القائمة (التقارير تتطلب صلاحية).
  const ITEMS: MoreItem[] = [
    { key: 'copilot', labelKey: 'copilot.title', icon: 'sparkles', permission: 'reports.view', href: '/(app)/copilot' },
    { key: 'agents', labelKey: 'agents.title', icon: 'rocket-outline', permission: 'reports.view', href: '/(app)/agents' },
    { key: 'security', labelKey: 'security.title', icon: 'shield-checkmark-outline', href: '/(app)/security' },
    { key: 'audit', labelKey: 'audit.title', icon: 'list-circle-outline', permission: 'audit.read', href: '/(app)/audit' },
    { key: 'reports', labelKey: 'tabs.reports', icon: 'bar-chart', permission: 'reports.view', href: '/(app)/(tabs)/reports' },
    // إدارة المنتجات (PHASE 16) — تتطلب صلاحية قراءة المنتجات.
    { key: 'products', labelKey: 'products.title', icon: 'cube-outline', permission: 'products.read', href: '/(app)/products' },
    // المخزون (PHASE 17) — يتطلب صلاحية قراءة المخزون.
    { key: 'inventory', labelKey: 'inventory.title', icon: 'layers-outline', permission: 'inventory.read', href: '/(app)/inventory' },
    // المشتريات (PHASE 18) — تتطلب صلاحية قراءة المشتريات.
    { key: 'procurement', labelKey: 'procurement.title', icon: 'cart-outline', permission: 'procurement.read', href: '/(app)/procurement' },
    // العملاء وCRM والولاء (PHASE 19) — يتطلب صلاحية قراءة العملاء.
    { key: 'customers', labelKey: 'customers.title', icon: 'people-outline', permission: 'customers.read', href: '/(app)/customers' },
    // المالية والمحاسبة (PHASE 20) — يتطلب صلاحية قراءة المالية.
    { key: 'finance', labelKey: 'finance.title', icon: 'wallet-outline', permission: 'finance.read', href: '/(app)/finance' },
    // الموارد البشرية (PHASE 21) — يتطلب صلاحية قراءة الموظفين.
    { key: 'hr', labelKey: 'hr.title', icon: 'people-circle-outline', permission: 'employees.read', href: '/(app)/hr' },
    { key: 'sync', labelKey: 'sync.title', icon: 'cloud-upload-outline', permission: 'reports.view', href: '/(app)/sync' },
    { key: 'store-setup', labelKey: 'more.storeSettings', icon: 'storefront-outline', href: '/(app)/store-setup' },
    // عن التطبيق (متاح لكل المستخدمين دون صلاحية خاصة).
    { key: 'about', labelKey: 'more.about', icon: 'information-circle-outline', href: '/(app)/about' },
  ];

  return (
    <Screen>
      <View style={{ gap: spacing.xl, flex: 1 }}>
        <Text style={{ ...textVariants.heading, color: colors.text }}>{t('more.title')}</Text>

        {/* بطاقة المتجر النشط + التبديل */}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="storefront" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...textVariants.label, color: colors.textMuted }}>{t('tenancy.activeStore')}</Text>
              <Text style={{ ...textVariants.title, color: colors.text }}>{context?.storeName ?? '—'}</Text>
              <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
                {context?.branchName} · {context?.tenantName}
              </Text>
            </View>
          </View>
          {canSwitchStore ? (
            <Button
              label={t('tenancy.switchStore')}
              variant="secondary"
              size="sm"
              icon="swap-horizontal"
              onPress={() => setSwitcherVisible(true)}
            />
          ) : null}
        </Card>

        {/* قائمة الروابط */}
        <Card padded={false} elevation="sm">
          {ITEMS.map((item, index) => {
            const allowed = !item.permission || canAccess(permissions, item.permission);
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
                accessibilityState={{ disabled: !allowed }}
                disabled={!allowed}
                onPress={() => router.push(item.href as never)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.lg,
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: index < ITEMS.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name={item.icon} size={22} color={allowed ? colors.primary : colors.textSubtle} />
                <Text style={{ flex: 1, ...textVariants.bodyStrong, color: allowed ? colors.text : colors.textSubtle }}>
                  {t(item.labelKey)}
                </Text>
                <Ionicons
                  name={allowed ? 'chevron-forward' : 'lock-closed'}
                  size={18}
                  color={allowed ? colors.textSubtle : colors.danger}
                />
              </Pressable>
            );
          })}
        </Card>

        {/* تسجيل الخروج */}
        <Button label={t('common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
      </View>

      {/* ورقة تبديل المتجر */}
      <StoreSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
    </Screen>
  );
}
