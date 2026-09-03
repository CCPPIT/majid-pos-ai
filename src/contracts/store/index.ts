/**
 * عقد المتجر — PHASE 32 · أقسام 10 و42.
 * المتجر هو نقطة البيع الفعلية التي تُربط بها السلة والفواتير.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const STORE_CONTRACT_NAME = contractName('store', 'Store');
// النسخة الحالية.
export const STORE_CONTRACT_VERSION = domainContractVersion('store');
// بطاقة العقد.
export const STORE_CONTRACT_META = defineContractMetadata({
  contractName: STORE_CONTRACT_NAME,
  contractVersion: STORE_CONTRACT_VERSION,
  domain: 'store',
  stability: 'stable',
  description: 'متجر/نقطة بيع فعلية بعملتها ومنطقتها الزمنية.',
});
