/**
 * الواجهة العلنية لمجال تعدد المستأجرين — PHASE 31 · قسم 51.
 */

// عقود الهرمية والسياق النشط.
export {
  MIN_STORE_SWITCH_SCOPE,
  type Tenant,
  type TenantStatus,
  type Organization,
  type Branch,
  type Store,
  type TenancyHierarchy,
  type ActiveTenancy,
  type AccessibleStore,
  type TenantScopeFilter,
} from './contracts/tenancy-contracts';

// عقد المستودع.
export type { TenancyRepository } from './contracts/tenancy-repository';

// الخدمة وأدوات النطاق النقية.
export {
  createTenancyService,
  buildScopeFilter,
  matchesScope,
  filterByScope,
  type TenancyService,
  type TenancyServiceDependencies,
} from './services/tenancy-service';
