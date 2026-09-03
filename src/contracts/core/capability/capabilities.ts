/**
 * عقود القدرات (Capability Contracts) — PHASE 32 · أقسام 62 · 63 · 64.
 *
 * القدرة = ما يدعمه النظام (pos · inventory · ai …).
 * الصلاحية = ما يجوز للمستخدم فعله (RBAC).
 * القدرات ليست بديلًا عن الصلاحيات: sdk.capabilities.has('ai') يعني أن
 * المحرّك مركّب، أما «هل يُسمح لهذا المستخدم» فيبقى من قرار RBAC.
 */

// أسماء قدرات المنصّة القانونية (قسم 63).
export const CAPABILITIES = {
  POS: 'pos', // نقطة البيع.
  INVENTORY: 'inventory', // المخزون.
  FINANCE: 'finance', // المالية.
  PROCUREMENT: 'procurement', // المشتريات.
  CRM: 'crm', // إدارة العملاء.
  HR: 'hr', // الموارد البشرية.
  ANALYTICS: 'analytics', // التحليلات.
  AI: 'ai', // الذكاء الاصطناعي.
  OFFLINE: 'offline', // العمل دون اتصال.
  PAYMENTS: 'payments', // المدفوعات.
  NOTIFICATIONS: 'notifications', // الإشعارات.
} as const;

// نوع اسم القدرة.
export type CapabilityName = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// حالة القدرة (قسم 63).
export type CapabilityStatus =
  | 'available' // متاحة ومركّبة.
  | 'unavailable' // غير مركّبة في هذه البيئة.
  | 'experimental' // متاحة تجريبيًا (قسم 46).
  | 'disabled'; // معطّلة إداريًا.

// وصف قدرة واحدة بنسختها (قسم 63).
export interface Capability {
  readonly name: CapabilityName; // الاسم.
  readonly version: string; // نسخة عقد القدرة.
  readonly status: CapabilityStatus; // الحالة.
  readonly requiresConsent?: boolean; // هل تحتاج موافقة (قدرات الذكاء).
}

// واجهة اكتشاف القدرات التي يكشفها الـSDK (قسم 64).
export interface CapabilityDiscovery {
  // يُعيد كل القدرات المسجّلة.
  get(): readonly Capability[];
  // هل قدرة معيّنة متاحة (متاحة أو تجريبية)؟
  has(name: CapabilityName): boolean;
  // يجلب وصف قدرة.
  describe(name: CapabilityName): Capability | undefined;
}

// سجلّ قدرات بسيط يُركَّب في الـSDK.
export class CapabilityRegistry implements CapabilityDiscovery {
  private readonly capabilities = new Map<CapabilityName, Capability>();

  // يسجّل قدرة.
  register(capability: Capability): void {
    this.capabilities.set(capability.name, Object.freeze({ ...capability }));
  }

  // كل القدرات.
  get(): readonly Capability[] {
    return Object.freeze([...this.capabilities.values()]);
  }

  // متاحة؟ (متاحة فعلًا أو تجريبية).
  has(name: CapabilityName): boolean {
    const status = this.capabilities.get(name)?.status;
    return status === 'available' || status === 'experimental';
  }

  // وصف قدرة.
  describe(name: CapabilityName): Capability | undefined {
    return this.capabilities.get(name);
  }
}
