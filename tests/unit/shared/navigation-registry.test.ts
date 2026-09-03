import {
  CASHIER_PERMISSIONS,
  STORE_MANAGER_PERMISSIONS,
} from '@/security/permissions/permission';
import { TABS, authorizedTabs, canAccess } from '@/shared/navigation/navigation-registry';

describe('navigation registry', () => {
  it('always includes home and more for every role', () => {
    const cashierTabs = authorizedTabs(CASHIER_PERMISSIONS).map((t) => t.name);
    expect(cashierTabs).toContain('index');
    expect(cashierTabs).toContain('more');
  });

  it('shows POS/orders/customers to cashier but hides reports', () => {
    const names = authorizedTabs(CASHIER_PERMISSIONS).map((t) => t.name);
    expect(names).toContain('pos');
    expect(names).toContain('orders');
    expect(names).toContain('customers');
    expect(names).not.toContain('reports');
  });

  it('shows reports to a store manager', () => {
    const names = authorizedTabs(STORE_MANAGER_PERMISSIONS).map((t) => t.name);
    expect(names).toContain('reports');
    expect(names).toHaveLength(TABS.length);
  });

  it('canAccess mirrors the permission kernel', () => {
    expect(canAccess(CASHIER_PERMISSIONS, 'reports.view')).toBe(false);
    expect(canAccess(STORE_MANAGER_PERMISSIONS, 'reports.view')).toBe(true);
  });
});
