/**
 * الحاجز العلني لطبقة العقود — PHASE 32 · أقسام 44 · 73 · 74.
 *
 * هذا الملف نقطة الاستيراد الوحيدة للعقود: @/contracts.
 * التسلسل الهرمي: UI → Feature → SDK → Contracts → Domain → Repository.
 * القواعد:
 *  • لا تُصدَّر الأدوات/المحوّلات الداخلية إلا ما تحتاجه الطبقات (قسم 73).
 *  • العقود إطار-محايدة: لا React/RN/Zustand (قسم 76).
 *  • اتجاه الاستيراد واحد: لا شيء في contracts يستورد من sdk أو app (قسم 75).
 */

// ── النواة (كل ما هو مشترك) ──
export * from './core';

// ── تسجيل العقود والإهمالات (يُستدعى عند الإقلاع) ──
export { registerAllContracts } from './registry';

// ── المجالات: العقود الكاملة ──
export * as productsContract from './products/product.contract';
export * as salesContract from './sales/sale.contract';
export * as paymentsContract from './payments/payment.contract';
export * as inventoryContract from './inventory/inventory.contract';
export * as customersContract from './customers/customer.contract';
export * as cartContract from './cart/cart.contract';
export * as rbacContract from './rbac/rbac.contract';
export * as tenancyContract from './tenancy/tenancy.contract';
export * as authContract from './auth/auth.contract';
export * as posContract from './pos/pos.contract';
export * as aiContract from './ai/ai.contract';

// ── المجالات: بطاقات العقود (أساس مُنسَّخ) ──
export { IDENTITY_CONTRACT_NAME, IDENTITY_CONTRACT_VERSION, IDENTITY_CONTRACT_META } from './identity';
export { ORGANIZATION_CONTRACT_NAME, ORGANIZATION_CONTRACT_VERSION, ORGANIZATION_CONTRACT_META } from './organization';
export { STORE_CONTRACT_NAME, STORE_CONTRACT_VERSION, STORE_CONTRACT_META } from './store';
export { PROCUREMENT_CONTRACT_NAME, PROCUREMENT_CONTRACT_VERSION, PROCUREMENT_CONTRACT_META } from './procurement';
export { FINANCE_CONTRACT_NAME, FINANCE_CONTRACT_VERSION, FINANCE_CONTRACT_META } from './finance';
export { CRM_CONTRACT_NAME, CRM_CONTRACT_VERSION, CRM_CONTRACT_META } from './crm';
export { HR_CONTRACT_NAME, HR_CONTRACT_VERSION, HR_CONTRACT_META } from './hr';
export { ANALYTICS_CONTRACT_NAME, ANALYTICS_CONTRACT_VERSION, ANALYTICS_CONTRACT_META } from './analytics';
export { NOTIFICATIONS_CONTRACT_NAME, NOTIFICATIONS_CONTRACT_VERSION, NOTIFICATIONS_CONTRACT_META } from './notifications';

// ── المحوّلات (للتركيب والاختبارات) ──
export { adaptSaleToCurrent, registerContractVersions } from './adapters';
