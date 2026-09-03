/**
 * عقد تعدد المستأجرين — PHASE 32 · قسم 42.
 *
 * كل عقد حسّاس يحمل نطاقه (tenantId · organizationId · branchId ·
 * storeId)، والعقود لا تسمح بتجاوز حدود المستأجر (Tenant Boundary).
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const TENANCY_CONTRACT_NAME = contractName('tenancy', 'TenantScope');
// النسخة الحالية.
export const TENANCY_CONTRACT_VERSION = domainContractVersion('tenancy');

// مخطط النطاق الهرمي (قسم 42).
export const tenantScopeSchema = z.object({
  tenantId: z.string().min(1), // المستأجر (إلزامي).
  organizationId: z.string().optional(), // المؤسسة.
  branchId: z.string().optional(), // الفرع.
  storeId: z.string().optional(), // المتجر.
});

// نوع النطاق.
export type TenantScopeContract = z.infer<typeof tenantScopeSchema>;

// مخطط المتجر.
export const storeContractSchema = z.object({
  id: z.string().min(1), // المعرّف.
  tenantId: z.string().min(1), // المستأجر المالك.
  nameAr: z.string().trim().min(2).max(120), // الاسم العربي.
  currency: z.string().trim().length(3), // عملة المتجر.
  timezone: z.string().min(1), // المنطقة الزمنية.
});

// نوع المتجر.
export type StoreContract = z.infer<typeof storeContractSchema>;

/**
 * حارس أمان الحدود: يتحقق أن بيانات النطاق لا تتجاوز المستأجر الحالي.
 * أي اختلاف في tenantId يُعدّ انتهاكًا (TENANCY_BOUNDARY_VIOLATION).
 */
export const isWithinTenantBoundary = (
  data: { tenantId?: string },
  currentTenantId: string,
): boolean => data.tenantId === currentTenantId;
