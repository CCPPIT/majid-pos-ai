/**
 * عقد المالية — PHASE 32 · قسم 10.
 * المعاملات والحسابات عقود مُنسَّخة مستقلة.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const FINANCE_CONTRACT_NAME = contractName('finance', 'Transaction');
// النسخة الحالية.
export const FINANCE_CONTRACT_VERSION = domainContractVersion('finance');
// بطاقة العقد.
export const FINANCE_CONTRACT_META = defineContractMetadata({
  contractName: FINANCE_CONTRACT_NAME,
  contractVersion: FINANCE_CONTRACT_VERSION,
  domain: 'finance',
  stability: 'stable',
  description: 'معاملة مالية (إيراد/مصروف) مرتبطة بالمتجر.',
});
