/**
 * Role-personalized bottom tab bar (Sections 52/53), localized (PHASE 04).
 * Visible tabs come from the navigation registry filtered by permissions;
 * labels are resolved from i18n keys by the active locale.
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useSync } from '@/features/sync/sync-context';
import { TABS, authorizedTabs, type TabDefinition } from '@/shared/navigation/navigation-registry';

const ICON_SIZE = 22;

export default function TabsLayout() {
  const { state } = useBootstrap();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { summary, connectivity } = useSync();
  const permissions = state.session?.permissions ?? [];
  const visible = new Set(authorizedTabs(permissions).map((tab) => tab.name));
  // شارة على تبويب المزيد عند وجود طفرات معلّقة/فاشلة أو عدم اتصال.
  const pendingCount = summary.pending + summary.failed;
  const moreBadge = connectivity === 'offline' ? '•' : pendingCount > 0 ? pendingCount : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', writingDirection: undefined },
      }}
    >
      {TABS.map((tab: TabDefinition) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.labelKey),
            // null removes the tab button entirely for unauthorized roles.
            href: visible.has(tab.name) ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name={tab.icon} size={ICON_SIZE} color={color} />,
            tabBarBadge: tab.name === 'more' ? moreBadge : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
