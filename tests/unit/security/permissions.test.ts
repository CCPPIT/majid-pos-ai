import {
  CASHIER_PERMISSIONS,
  assertPermission,
  hasPermission,
  permissionMatches,
} from '@/security/permissions/permission';
import { BusinessRuleViolationError } from '@/core/errors/AppError';

describe('permission kernel', () => {
  it('matches exact permissions case-insensitively', () => {
    expect(permissionMatches('pos.sale.create', 'POS.SALE.CREATE')).toBe(true);
    expect(permissionMatches('pos.sale.create', 'pos.sale.read')).toBe(false);
  });

  it('matches resource wildcards', () => {
    expect(permissionMatches('pos.*', 'pos.sale.create')).toBe(true);
    expect(permissionMatches('reports.*', 'reports.view')).toBe(true);
    expect(permissionMatches('reports.*', 'pos.sale.create')).toBe(false);
  });

  it('matches the global wildcard', () => {
    expect(permissionMatches('*', 'anything.at.all')).toBe(true);
  });

  it('does not grant via partial action overlap', () => {
    expect(permissionMatches('pos.sale.create', 'pos.sale.read')).toBe(false);
  });

  it('checks lists with hasPermission', () => {
    expect(hasPermission(CASHIER_PERMISSIONS, 'pos.sale.create')).toBe(true);
    expect(hasPermission(CASHIER_PERMISSIONS, 'reports.view')).toBe(false);
  });

  it('assertPermission throws on missing permission', () => {
    expect(() => assertPermission(CASHIER_PERMISSIONS, 'reports.view')).toThrow(
      BusinessRuleViolationError,
    );
    expect(() => assertPermission(CASHIER_PERMISSIONS, 'pos.cart.read')).not.toThrow();
  });
});
