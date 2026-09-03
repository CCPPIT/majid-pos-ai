/**
 * Identity domain — minimal types introduced for session-aware routing.
 * The full RBAC model (100 roles, policies, role/permission entities) lands
 * in PHASE 07. These types define the shape every later phase must satisfy.
 */
import { type ID, type TenantScoped } from '@/core/types/domain';

export type UserId = ID;

export interface User extends TenantScoped {
  id: UserId;
  fullName: string;
  /** Phone in E.164 or email — both supported at login (Section 19). */
  phone?: string;
  email?: string;
  roleId: ID;
  /** كود الدور في فهرس RBAC (مثل 'cashier') لاشتقاق النطاق. */
  roleCode?: string;
  roleName: string;
  avatarUrl?: string;
}

export interface Session {
  /** Opaque session token (stored in Secure Storage from PHASE 06 onward). */
  token: string;
  user: User;
  /** Flattened permission strings, e.g. 'pos.sale.create', 'reports.*'. */
  permissions: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface BootstrapState {
  onboardingCompleted: boolean;
  storeSetupCompleted: boolean;
  session: Session | null;
}
