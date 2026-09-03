/**
 * Navigation registry — permission-aware mobile navigation (Sections 52/53).
 *
 * Tabs are declared once with the permission they require and an i18n label
 * KEY (labels are resolved at render from the active locale — Section 46).
 * The tab layout filters tabs by the session's permissions. Hiding is UX
 * only — every guarded screen ALSO checks the permission (PermissionGuard).
 */
import { hasPermission } from '@/security/permissions/permission';

export interface TabDefinition {
  /** Route file name under (app)/(tabs)/ */
  name: 'index' | 'pos' | 'orders' | 'customers' | 'reports' | 'more';
  /** i18n key resolved at render time. */
  labelKey: string;
  /** Ionicons name — rendered in the tab bar. */
  icon: 'home' | 'cart' | 'receipt' | 'people' | 'bar-chart' | 'menu';
  /** Permission required to SEE and USE the tab. */
  permission: string;
  /** Always visible regardless of permissions. */
  alwaysAllow?: boolean;
}

export const TABS: readonly TabDefinition[] = [
  { name: 'index', labelKey: 'tabs.home', icon: 'home', permission: '', alwaysAllow: true },
  { name: 'pos', labelKey: 'tabs.pos', icon: 'cart', permission: 'pos.sale.create' },
  { name: 'orders', labelKey: 'tabs.orders', icon: 'receipt', permission: 'order.read' },
  { name: 'customers', labelKey: 'tabs.customers', icon: 'people', permission: 'customer.read' },
  { name: 'reports', labelKey: 'tabs.reports', icon: 'bar-chart', permission: 'reports.view' },
  { name: 'more', labelKey: 'tabs.more', icon: 'menu', permission: '', alwaysAllow: true },
];

/** Tabs a user with the given permissions may see. */
export const authorizedTabs = (permissions: readonly string[]): TabDefinition[] =>
  TABS.filter(
    (tab) => tab.alwaysAllow === true || hasPermission(permissions, tab.permission),
  );

export const canAccess = (permissions: readonly string[], permission: string): boolean =>
  hasPermission(permissions, permission);
