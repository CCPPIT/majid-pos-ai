/**
 * عقد المشتريات — PHASE 32 · قسم 10.
 * أوامر الشراء وطلباتها عقود مُنسَّخة مستقلة عن المخزون.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const PROCUREMENT_CONTRACT_NAME = contractName('procurement', 'PurchaseOrder');
// النسخة الحالية.
export const PROCUREMENT_CONTRACT_VERSION = domainContractVersion('procurement');
// بطاقة العقد.
export const PROCUREMENT_CONTRACT_META = defineContractMetadata({
  contractName: PROCUREMENT_CONTRACT_NAME,
  contractVersion: PROCUREMENT_CONTRACT_VERSION,
  domain: 'procurement',
  stability: 'stable',
  description: 'أمر شراء للمورّدين ودورة استلامه.',
});
