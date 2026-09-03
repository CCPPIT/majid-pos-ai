/**
 * محوّلات العقود (Adapters) — PHASE 32 · أقسام 17 · 18 · 38.
 *
 * تدفّق DTO الإصدارات: Old Consumer/DTO ← Adapter ← Current Contract.
 * المحوّلات تُسجَّل في محرّك الترحيل لتصبح قابلة للاستدعاء آليًا عند
 * قراءة بيانات قديمة (API/storage/offline).
 */
import {
  contractRegistry,
  migrateContract,
  migrationRegistry,
  registerMigration,
} from '../core';
import {
  SALE_V1,
  SALE_V2,
  migrateSaleV1ToV2,
  SALE_CONTRACT_NAME,
  type SaleV1,
  type SaleV2,
} from '../sales/sale.contract';

// ── محوّل Sale V1 → V2 (قسم 18 و78) ──
// نسجّل خطوة الترحيل في المحرّك لتُطبَّق تلقائيًا على البيانات القديمة.
registerMigration({
  contractName: SALE_CONTRACT_NAME, // العقد.
  fromVersion: SALE_V1, // المصدر.
  toVersion: SALE_V2, // الهدف.
  up: migrateSaleV1ToV2, // الدالة الخالصة الحتمية.
});

/**
 * يطبّق ترحيل فاتورة من نسختها المخزّنة إلى النسخة الحالية.
 * يُستخدم عند قراءة فواتير قديمة من التخزين المحلي أو الـAPI.
 */
export const adaptSaleToCurrent = (
  raw: unknown,
  fromVersion: string,
): import('../core').ContractResult<SaleV2> => {
  // نطلب من المحرّك الترحيل إلى V2.
  const result = migrateContract<SaleV2>(SALE_CONTRACT_NAME, raw, fromVersion, SALE_V2);
  // فشل الترحيل (لا مسار/خطأ) → نُعيد فشلًا بكود العقد.
  if (!result.ok || !result.value) {
    return {
      success: false,
      error: {
        code: result.errorCode ?? 'CONTRACT_MIGRATION_FAILED',
        message: result.reason ?? 'فشل ترحيل الفاتورة',
        retryable: false,
        errorVersion: '1.0.0',
      },
    };
  }
  // نجاح.
  return { success: true, data: result.value };
};

// يُسجّل مدى دعم النسخ لكل عقد في السجلّ (يُستدعى مرة عند الإقلاع).
export const registerContractVersions = (): void => {
  // فاتورة البيع: تدعم V1 (عبر ترحيل) وV2 (حالية).
  if (!contractRegistry.has(SALE_CONTRACT_NAME)) {
    contractRegistry.register({
      name: SALE_CONTRACT_NAME,
      domain: 'sales',
      kind: 'entity',
      current: SALE_V2,
      minimumSupported: SALE_V1, // تُقرأ V1 وتُرحَّل.
      stability: 'stable',
      deprecatedVersions: [SALE_V1], // V1 مهجورة لكن مدعومة قراءةً.
      migrationsAvailable: [`${SALE_V1}->${SALE_V2}`],
    });
  }
};

// مراجع أنواع للاستيراد من المحوّلات.
export type { SaleV1, SaleV2 };
export { migrationRegistry };
