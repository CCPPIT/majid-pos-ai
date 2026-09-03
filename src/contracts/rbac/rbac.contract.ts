/**
 * عقد الصلاحيات (RBAC) — PHASE 32 · أقسام 43 · 64.
 *
 * الأدوار والصلاحيات والسياسات والنطاق عقود مُنسَّخة، فتغيير بنية
 * الصلاحيات لا يكسر كل الميزات (قسم 43). نتيجة التفويض تحمل قرارًا
 * ثابتًا تتفرّع عليه الواجهة.
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const RBAC_CONTRACT_NAME = contractName('rbac', 'Authorization');
// النسخة الحالية.
export const RBAC_CONTRACT_VERSION = domainContractVersion('rbac');

// قرار التفويض.
export const AUTHORIZATION_DECISIONS = ['allow', 'deny'] as const;

// مخطط طلب التفويض (قسم 43).
export const authorizationRequestSchema = z.object({
  userId: z.string().min(1), // المستخدم.
  permission: z.string().min(1), // الصلاحية المطلوبة (مثل: sale.create).
  tenantId: z.string().min(1), // المستأجر (لا عبور للحدود).
  storeId: z.string().optional(), // المتجر.
});

// نوع الطلب.
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;

// مخطط نتيجة التفويض (قسم 43).
export const authorizationResultSchema = z.object({
  decision: z.enum(AUTHORIZATION_DECISIONS), // القرار.
  permission: z.string(), // الصلاحية المطلوبة.
  reason: z.string().optional(), // سبب المنع (للعرض).
  contractVersion: z.literal(RBAC_CONTRACT_VERSION), // نسخة العقد.
});

// نوع النتيجة.
export type AuthorizationResult = z.infer<typeof authorizationResultSchema>;

// مخطط تعريف الدور.
export const roleContractSchema = z.object({
  id: z.string().min(1), // المعرّف.
  code: z.string().min(1), // الكود الثابت (cashier · manager…).
  permissions: z.array(z.string().min(1)), // الصلاحيات الممنوحة.
});

// نوع الدور.
export type RoleContract = z.infer<typeof roleContractSchema>;
