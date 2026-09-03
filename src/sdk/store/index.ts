/**
 * مجال المتجر — PHASE 31 · قسم 13.
 * المتجر أدنى وحدة تشغيلية: كل عملية بيع تنتمي لمتجر واحد،
 * ومنه تُشتق العملة ونسبة الضريبة المطبَّقة على السلة.
 */
import type { AsyncResult, CurrencyCode, PaginatedResult, QueryOptions, StoreId } from '@/sdk/core';
import type { Store } from '@/sdk/tenancy';

// إعدادات المتجر التشغيلية.
export interface StoreSettings {
  readonly currency: CurrencyCode; // عملة البيع.
  readonly taxRatePercent: number; // نسبة الضريبة.
  readonly taxInclusive: boolean; // هل الأسعار شاملة الضريبة؟
  readonly receiptFooterKey?: string; // مفتاح تذييل الإيصال.
  readonly lowStockThreshold: number; // حدّ تنبيه المخزون.
}

/**
 * ملاحظة معمارية: كيان `Store` مُعرَّف مرة واحدة في مجال tenancy (هو ورقة
 * هرمية المستأجر ويحمل العملة ونسبة الضريبة). هذا المجال يعيد تصديره
 * ويضيف الإعدادات التشغيلية فوقه — لا يُعرّف نسخة منافسة منه.
 */
export type { Store } from '@/sdk/tenancy';

// مستودع المتاجر.
export interface StoreRepository {
  // يسرد المتاجر.
  list(query?: QueryOptions): AsyncResult<PaginatedResult<Store>>;
  // يجلب متجرًا.
  get(id: StoreId): AsyncResult<Store>;
  // يقرأ إعدادات متجر (تُغذّي السلة بالعملة والضريبة).
  getSettings(id: StoreId): AsyncResult<StoreSettings>;
  // يحدّث الإعدادات.
  updateSettings(id: StoreId, settings: Partial<StoreSettings>): AsyncResult<StoreSettings>;
}

// الإعدادات الافتراضية حين لا يوفّرها المتجر (قيم محافظة).
export const DEFAULT_STORE_SETTINGS: StoreSettings = Object.freeze({
  currency: 'YER' as CurrencyCode, // العملة الأساسية للتطبيق.
  taxRatePercent: 0, // بلا ضريبة افتراضيًا (يضبطها المتجر).
  taxInclusive: false, // الأسعار غير شاملة افتراضيًا.
  lowStockThreshold: 10, // حدّ التنبيه الافتراضي.
});
