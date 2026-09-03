/**
 * App-wide constants — namespaced storage keys, locales, tax defaults.
 */
import Constants from 'expo-constants';

export const APP_NAME = 'MAJID POS AI';
export const APP_TAGLINE = 'AI-Native Smart POS · ERP · SaaS';

export const APP_VERSION: string =
  (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';

/** Supported locales (Section 46) — Arabic first (RTL), English (LTR). */
export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Key prefixes — secure storage for sensitive data, plain storage for prefs. */
export const STORAGE_PREFIX = '@majid_pos_ai:';
export const SECURE_STORAGE_PREFIX = 'secure:';

export const STORAGE_KEYS = {
  onboardingCompleted: `${STORAGE_PREFIX}onboarding_completed`,
  locale: `${STORAGE_PREFIX}locale`,
  theme: `${STORAGE_PREFIX}theme`,
  session: `${SECURE_STORAGE_PREFIX}session`,
  pinHash: `${SECURE_STORAGE_PREFIX}pin_hash`,
  pinSalt: `${SECURE_STORAGE_PREFIX}pin_salt`,
  biometricEnabled: `${SECURE_STORAGE_PREFIX}biometric_enabled`,
  securitySettings: `${STORAGE_PREFIX}security_settings`, // إعدادات القفل التلقائي (PHASE 26).
  auditLog: `${STORAGE_PREFIX}audit_log`, // سجل التدقيق (append-only) (PHASE 27).
  activeTenant: `${STORAGE_PREFIX}active_tenant`,
  activeStore: `${STORAGE_PREFIX}active_store`,
  storeSetupProfile: `${STORAGE_PREFIX}store_setup_profile`, // ملف إعداد المتجر (PHASE 09).
  orders: `${STORAGE_PREFIX}orders`, // طلبات البيع المخزنة (PHASE 13).
  ordersSequence: `${STORAGE_PREFIX}orders_sequence`, // آخر رقم تسلسلي للطلبات.
  payments: `${STORAGE_PREFIX}payments`, // سجل المدفوعات (PHASE 14).
  customProducts: `${STORAGE_PREFIX}custom_products`, // منتجات المستخدم المضافة/المعدلة (PHASE 16).
  productSequence: `${STORAGE_PREFIX}product_sequence`, // رقم تسلسل المنتجات المضافة.
  inventoryMovements: `${STORAGE_PREFIX}inventory_movements`, // سجل حركات المخزون (PHASE 17).
  inventorySequence: `${STORAGE_PREFIX}inventory_sequence`, // رقم تسلسل حركات المخزون.
  suppliers: `${STORAGE_PREFIX}suppliers`, // المورّدون (PHASE 18).
  purchaseOrders: `${STORAGE_PREFIX}purchase_orders`, // أوامر الشراء (PHASE 18).
  poSequence: `${STORAGE_PREFIX}po_sequence`, // رقم تسلسل أوامر الشراء.
  customers: `${STORAGE_PREFIX}customers`, // العملاء وCRM (PHASE 19).
  expenses: `${STORAGE_PREFIX}expenses`, // المصاريف اليدوية (PHASE 20).
  hrData: `${STORAGE_PREFIX}hr_data`, // الموظفون والحضور (PHASE 21).
  pendingMutationQueue: `${STORAGE_PREFIX}pending_mutations`,
} as const;

/** Non-sensitive boolean flags (AsyncStorage). Sensitive data uses SECURE_* keys. */
export const FLAG_KEYS = {
  onboardingCompleted: `${STORAGE_PREFIX}onboarding_completed_flag`,
  storeSetupCompleted: `${STORAGE_PREFIX}store_setup_completed_flag`,
} as const;

/** Fallback VAT/GST rate; can be overridden per tenant/store in setup. */
export const DEFAULT_TAX_RATE_PERCENT = 5;
