/**
 * عقد الهوية — PHASE 32 · قسم 10.
 * يُسجَّل نطاق الهوية بنسخته المستقلة؛ التفاصيل الموسّعة تأتي في
 * المراحل التالية دون كسر العقد (إضافات اختيارية = MINOR).
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const IDENTITY_CONTRACT_NAME = contractName('identity', 'Identity');
// النسخة الحالية.
export const IDENTITY_CONTRACT_VERSION = domainContractVersion('identity');
// بطاقة العقد للوثائق والسجلّ.
export const IDENTITY_CONTRACT_META = defineContractMetadata({
  contractName: IDENTITY_CONTRACT_NAME,
  contractVersion: IDENTITY_CONTRACT_VERSION,
  domain: 'identity',
  stability: 'stable',
  description: 'هوية المستخدم داخل المنصّة (ملف/مواصفات) — أساس مُنسَّخ.',
});
