/**
 * عقد الإشعارات — PHASE 32 · قسم 10.
 * الإشعارات أحداث مُنسَّخة تُدفع للمستخدم عبر قنوات مختلفة.
 */
import { contractName, defineContractMetadata, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const NOTIFICATIONS_CONTRACT_NAME = contractName('notifications', 'Notification');
// النسخة الحالية.
export const NOTIFICATIONS_CONTRACT_VERSION = domainContractVersion('notifications');
// بطاقة العقد.
export const NOTIFICATIONS_CONTRACT_META = defineContractMetadata({
  contractName: NOTIFICATIONS_CONTRACT_NAME,
  contractVersion: NOTIFICATIONS_CONTRACT_VERSION,
  domain: 'notifications',
  stability: 'stable',
  description: 'إشعار موجّه لمستخدم/متجر عبر قناة محددة.',
});
