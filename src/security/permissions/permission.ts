/**
 * Permission primitives + wildcard matching.
 *
 * Permission string format: `<resource>.<action>` e.g. 'pos.sale.create'.
 * Wildcards: 'pos.*' grants every action on resource pos;
 *            '*' (super-admin) grants everything.
 *
 * Full RBAC (roles → permissions → policies → scopes) is built in PHASE 07;
 * this module is the authorization kernel every later phase will reuse.
 */
import { BusinessRuleViolationError } from '@/core/errors/AppError';

export type PermissionString = string;

const WILDCARD = '*';
const SEGMENT_SEPARATOR = '.';

const normalize = (permission: string): string[] =>
  permission.trim().toLowerCase().split(SEGMENT_SEPARATOR).filter(Boolean);

/**
 * Does a granted permission cover a required permission?
 *
 * granted: 'pos.*'       required: 'pos.sale.create'   → true
 * granted: 'pos.sale.*'  required: 'pos.sale.create'   → true
 * granted: 'pos.sale.create' required: 'pos.sale.read' → false
 */
export const permissionMatches = (granted: string, required: string): boolean => {
  const g = normalize(granted);
  const r = normalize(required);
  if (g.length === 0 || r.length === 0) return false;
  if (g[0] === WILDCARD) return true;

  const min = Math.min(g.length, r.length);
  for (let i = 0; i < min; i += 1) {
    const grantedSegment = g[i];
    if (grantedSegment === WILDCARD) return true;
    if (grantedSegment !== r[i]) return false;
  }
  return g.length === r.length;
};

/** Returns true when ANY granted permission covers the required one. */
export const hasPermission = (granted: readonly string[], required: string): boolean =>
  granted.some((p) => permissionMatches(p, required));

/**
 * Throws `BusinessRuleViolationError`(→ permission denied) when missing.
 * Used by screens AND action handlers — hiding UI is NOT security (Section 52).
 */
export const assertPermission = (granted: readonly string[], required: string): void => {
  if (!hasPermission(granted, required)) {
    throw new BusinessRuleViolationError(`Access denied: requires ${required}`, {
      requiredPermission: required,
    });
  }
};

/**
 * Cashier permission set (Section 14 example) — used by the Phase-02 mock
 * session to demonstrate role-personalized navigation.
 */
export const CASHIER_PERMISSIONS: readonly PermissionString[] = [
  'pos.sale.create',
  'pos.cart.read',
  'pos.cart.update',
  'payment.create',
  'receipt.create',
  'customer.read',
  'order.read',
  'order.manage',
  'products.read',
];

export const STORE_MANAGER_PERMISSIONS: readonly PermissionString[] = [
  'pos.*',
  'inventory.*',
  'products.*',
  'sales.*',
  'order.*', // orders live under the sales/orders domain
  'customers.*',
  'customer.*', // singular resource form used by the cashier role spec
  'reports.*',
  'employees.read',
];
