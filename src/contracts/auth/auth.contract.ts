/**
 * عقد المصادقة — PHASE 32 · أقسام 29 · 36.
 * بيانات الاعتماد لا تُسجَّل أبدًا (قسم 65 — لا أسرار في العقود).
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const AUTH_CONTRACT_NAME = contractName('auth', 'Session');
// النسخة الحالية.
export const AUTH_CONTRACT_VERSION = domainContractVersion('auth');

// مخطط طلب الدخول (كلمة المرور لا تُعاد في أي استجابة).
export const signInCommandSchema = z.object({
  phone: z.string().trim().min(5).max(20), // الهاتف/المعرّف.
  pin: z.string().trim().min(4).max(12), // الرمز السري (لا يُسجَّل).
  tenantId: z.string().min(1), // المستأجر.
});

// نوع أمر الدخول.
export type SignInCommand = z.infer<typeof signInCommandSchema>;

// مخطط الجلسة (بلا أي أسرار — قسم 65).
export const sessionContractSchema = z.object({
  userId: z.string().min(1), // المستخدم.
  tenantId: z.string().min(1), // المستأجر.
  tokenExpiresAt: z.string(), // انتهاء الرمز (لا الرمز نفسه يُخزَّن هنا).
  authenticated: z.boolean(), // هل الجلسة قائمة؟
});

// نوع الجلسة.
export type SessionContract = z.infer<typeof sessionContractSchema>;
