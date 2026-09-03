/**
 * عقد الموارد البشرية — PHASE 32 · قسم 10.
 * الموظفون ووردياتهم عقود مُنسَّخة.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const HR_CONTRACT_NAME = contractName('hr', 'Employee');
// النسخة الحالية.
export const HR_CONTRACT_VERSION = domainContractVersion('hr');
// بطاقة العقد.
export const HR_CONTRACT_META = defineContractMetadata({
  contractName: HR_CONTRACT_NAME,
  contractVersion: HR_CONTRACT_VERSION,
  domain: 'hr',
  stability: 'stable',
  description: 'موظف مرتبط بدور وصلاحية ومتجر.',
});
