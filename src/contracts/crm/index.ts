/**
 * عقد إدارة علاقات العملاء (CRM) — PHASE 32 · قسم 10.
 * العملاء المحتملون والحملات عقود مُنسَّخة مستقلة عن العملاء المسجّلين.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const CRM_CONTRACT_NAME = contractName('crm', 'Lead');
// النسخة الحالية.
export const CRM_CONTRACT_VERSION = domainContractVersion('crm');
// بطاقة العقد.
export const CRM_CONTRACT_META = defineContractMetadata({
  contractName: CRM_CONTRACT_NAME,
  contractVersion: CRM_CONTRACT_VERSION,
  domain: 'crm',
  stability: 'experimental',
  description: 'عميل محتمل/فرصة بيع قبل التسجيل.',
});
