/**
 * واجهة العقود داخل الـSDK — PHASE 32 · أقسام 12 · 14 · 21 · 64.
 *
 * يُركَّب هذا الكائن داخل عميل ماجد SDK فيكشف للمستهلك:
 *   sdk.contracts.version()    — نسخ الـSDK والعقود.
 *   sdk.contracts.registry     — سجلّ العقود (الأسماء/النسخ/المدى).
 *   sdk.contracts.compatible() — فحص توافق مجموعة نسخ (قسم 14).
 *   sdk.contracts.migrate()    — ترحيل بيانات عقد قديم (قسم 21).
 *   sdk.capabilities.has('ai') — اكتشاف القدرات (قسم 64).
 *
 * لا ينفّذ هذا الملف أعمالًا خاصة بمجال؛ ينسّق طبقة العقود فقط.
 */
import {
  CAPABILITIES,
  CapabilityRegistry,
  checkCompatibility,
  contractRegistry,
  deprecationRegistry,
  DOMAIN_CONTRACT_VERSIONS,
  migrateContract,
  SDK_VERSION,
  API_VERSION,
  type Capability,
  type CapabilityDiscovery,
  type CapabilityName,
  type CompatibilityContext,
  type CompatibilityResult,
} from '@/contracts/core';
import { registerAllContracts } from '@/contracts/registry';
import { registerContractVersions } from '@/contracts/adapters';

// معلومات الإصدار التي يكشفها الـSDK.
export interface SDKContractVersionInfo {
  readonly sdkVersion: string; // نسخة الحزمة.
  readonly apiVersion: string; // نسخة الواجهة.
  readonly contractsVersion: string; // نسخة العقود الكلية.
  readonly domains: Readonly<Record<string, string>>; // نسخة كل مجال.
}

// واجهة كائن العقود المُركَّب.
export interface SDKContracts {
  readonly version: () => SDKContractVersionInfo; // معلومات الإصدار.
  readonly registry: typeof contractRegistry; // سجلّ العقود.
  readonly deprecations: typeof deprecationRegistry; // سجلّ الإهمال.
  readonly capabilities: CapabilityDiscovery; // اكتشاف القدرات (قسم 64).
  // فحص توافق مجموعتي نسخ (قسم 14).
  compatible(expected: CompatibilityContext, actual: CompatibilityContext): CompatibilityResult;
  // ترحيل بيانات عقد بين نسختين (قسم 21).
  migrate<T>(name: string, data: unknown, from: string, to: string): ReturnType<typeof migrateContract<T>>;
}

/**
 * يُركّب واجهة العقود ويُسجّل كل العقود مرة واحدة (idempotent).
 * القدرات تُمرَّر من تركيب الـSDK بحسب المزوّدين المتاحين.
 */
export const createSDKContracts = (options?: {
  readonly availableCapabilities?: readonly CapabilityName[]; // القدرات المتاحة فعلًا.
}): SDKContracts => {
  // نسجّل العقود ومدى النسخ (آمنة للتكرار).
  registerAllContracts();
  registerContractVersions();

  // سجلّ القدرات (قسم 63 و64).
  const capabilities = new CapabilityRegistry();
  // القدرات الأساسية متاحة دائمًا في المنصّة.
  const baseCapabilities: readonly Capability[] = [
    { name: CAPABILITIES.POS, version: DOMAIN_CONTRACT_VERSIONS.pos, status: 'available' },
    { name: CAPABILITIES.INVENTORY, version: DOMAIN_CONTRACT_VERSIONS.inventory, status: 'available' },
    { name: CAPABILITIES.PAYMENTS, version: DOMAIN_CONTRACT_VERSIONS.payments, status: 'available' },
    { name: CAPABILITIES.OFFLINE, version: '1.0.0', status: 'available' },
    { name: CAPABILITIES.NOTIFICATIONS, version: DOMAIN_CONTRACT_VERSIONS.notifications, status: 'available' },
    { name: CAPABILITIES.AI, version: DOMAIN_CONTRACT_VERSIONS.ai, status: 'experimental' },
    { name: CAPABILITIES.FINANCE, version: DOMAIN_CONTRACT_VERSIONS.finance, status: 'available' },
    { name: CAPABILITIES.PROCUREMENT, version: DOMAIN_CONTRACT_VERSIONS.procurement, status: 'available' },
    { name: CAPABILITIES.CRM, version: DOMAIN_CONTRACT_VERSIONS.crm, status: 'experimental' },
    { name: CAPABILITIES.HR, version: DOMAIN_CONTRACT_VERSIONS.hr, status: 'available' },
    { name: CAPABILITIES.ANALYTICS, version: DOMAIN_CONTRACT_VERSIONS.analytics, status: 'available' },
  ];
  // نسجّل القدرات الأساسية.
  for (const capability of baseCapabilities) capabilities.register(capability);
  // القدرات التي أبلغ التركيب أنها غير مركّبة نعلّمها كذلك.
  const available = new Set(options?.availableCapabilities ?? []);
  // إن مُرّرت قائمة صريحة، نضبط حالة القدرات الاختيارية (ai) بناءً عليها.
  if (options?.availableCapabilities) {
    for (const name of [CAPABILITIES.AI, CAPABILITIES.NOTIFICATIONS] as const) {
      if (!available.has(name)) {
        capabilities.register({ name, version: DOMAIN_CONTRACT_VERSIONS[name] ?? '1.0.0', status: 'unavailable' });
      }
    }
  }

  // نُعيد كائن العقود المُركَّب.
  return Object.freeze({
    // معلومات الإصدار.
    version: (): SDKContractVersionInfo =>
      Object.freeze({
        sdkVersion: SDK_VERSION,
        apiVersion: API_VERSION,
        contractsVersion: DOMAIN_CONTRACT_VERSIONS.core,
        domains: DOMAIN_CONTRACT_VERSIONS,
      }),
    registry: contractRegistry,
    deprecations: deprecationRegistry,
    capabilities,
    // فحص التوافق (قسم 14).
    compatible: (expected: CompatibilityContext, actual: CompatibilityContext) =>
      checkCompatibility(expected, actual),
    // ترحيل العقود (قسم 21).
    migrate: <T>(name: string, data: unknown, from: string, to: string) =>
      migrateContract<T>(name, data, from, to),
  });
};
