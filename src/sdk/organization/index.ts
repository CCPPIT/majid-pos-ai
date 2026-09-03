/**
 * مجال المؤسسة — PHASE 31 · قسم 13.
 * المؤسسة والفرع طبقتان في هرمية المستأجر: Tenant → Organization → Branch → Store.
 */
import type { AsyncResult, BranchId, OrganizationId, PaginatedResult, QueryOptions } from '@/sdk/core';
import type { Branch, Organization } from '@/sdk/tenancy';

/**
 * ملاحظة معمارية: كيانا `Organization` و`Branch` مُعرَّفان مرة واحدة في
 * مجال tenancy (هما جزء من هرمية المستأجر). هذا المجال يعيد تصديرهما
 * ويضيف عمليات الإدارة فوقهما — لا يُعرّف نسخة منافسة منهما.
 */
export type { Organization, Branch } from '@/sdk/tenancy';

// مستودع المؤسسات والفروع.
export interface OrganizationRepository {
  // يسرد المؤسسات.
  listOrganizations(query?: QueryOptions): AsyncResult<PaginatedResult<Organization>>;
  // يجلب مؤسسة.
  getOrganization(id: OrganizationId): AsyncResult<Organization>;
  // يسرد فروع مؤسسة.
  listBranches(organizationId: OrganizationId, query?: QueryOptions): AsyncResult<PaginatedResult<Branch>>;
  // يجلب فرعًا.
  getBranch(id: BranchId): AsyncResult<Branch>;
}
