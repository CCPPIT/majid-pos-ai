/**
 * عقد المؤسسة — PHASE 32 · أقسام 10 و42.
 * المؤسسة أعلى مستوى في الهرمية: المستأجر ← المؤسسة ← الفرع ← المتجر.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const ORGANIZATION_CONTRACT_NAME = contractName('organization', 'Organization');
// النسخة الحالية.
export const ORGANIZATION_CONTRACT_VERSION = domainContractVersion('organization');
// بطاقة العقد.
export const ORGANIZATION_CONTRACT_META = defineContractMetadata({
  contractName: ORGANIZATION_CONTRACT_NAME,
  contractVersion: ORGANIZATION_CONTRACT_VERSION,
  domain: 'organization',
  stability: 'stable',
  description: 'المؤسسة المالكة لعدة فروع/متاجر.',
});
