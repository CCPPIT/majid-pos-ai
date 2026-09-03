/**
 * عقد العميل — PHASE 32 · أقسام 06 · 66.
 *
 * حقول الهوية (هاتف/بريد) حقول حساسة PII — تُوسَم في الخصوصية
 * metadata لتُقنَّع من السجلات (قسم 66).
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const CUSTOMER_CONTRACT_NAME = contractName('customers', 'Customer');
// النسخة الحالية.
export const CUSTOMER_CONTRACT_VERSION = domainContractVersion('customers');

// الحقول الحساسة في عقد العميل (تُقنَّع في السجلات — قسم 66).
export const CUSTOMER_SENSITIVE_FIELDS = ['phone', 'email', 'address'] as const;

// مخطط كيان العميل.
export const customerSchema = z.object({
  id: z.string().min(1), // المعرّف.
  nameAr: z.string().trim().min(2).max(120), // الاسم العربي.
  nameEn: z.string().trim().min(2).max(120).optional(), // الاسم الإنجليزي.
  phone: z.string().trim().max(20).optional(), // الهاتف (PII).
  email: z.string().trim().max(120).optional(), // البريد (PII).
  address: z.string().trim().max(300).optional(), // العنوان (PII).
  loyaltyPoints: z.number().int().nonnegative().default(0), // نقاط الولاء.
});

// نوع العميل المشتقّ.
export type Customer = z.infer<typeof customerSchema>;

// مخطط أمر إنشاء عميل (قسم 31).
export const createCustomerCommandSchema = customerSchema
  .omit({ id: true, loyaltyPoints: true })
  .extend({ commandVersion: z.literal(CUSTOMER_CONTRACT_VERSION) });

// نوع أمر الإنشاء.
export type CreateCustomerCommand = z.infer<typeof createCustomerCommandSchema>;

// مخطط استعلام عميل (قسم 32).
export const getCustomerQuerySchema = z.object({
  customerId: z.string().min(1), // المعرّف.
});

// نوع الاستعلام.
export type GetCustomerQuery = z.infer<typeof getCustomerQuerySchema>;
