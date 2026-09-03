/**
 * عقد التحليلات — PHASE 32 · قسم 10.
 * التقارير ومؤشرات الأداء استعلامات مُنسَّخة (قراءة فقط).
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const ANALYTICS_CONTRACT_NAME = contractName('analytics', 'Report');
// النسخة الحالية.
export const ANALYTICS_CONTRACT_VERSION = domainContractVersion('analytics');
// بطاقة العقد.
export const ANALYTICS_CONTRACT_META = defineContractMetadata({
  contractName: ANALYTICS_CONTRACT_NAME,
  contractVersion: ANALYTICS_CONTRACT_VERSION,
  domain: 'analytics',
  stability: 'stable',
  description: 'تقرير/مؤشر أداء للوحة التحكم.',
});
