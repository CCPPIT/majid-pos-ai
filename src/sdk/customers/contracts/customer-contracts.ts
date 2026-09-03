/**
 * عقود مجال العملاء والولاء — PHASE 31 · أقسام 21 و22.
 */
import { z } from 'zod';
import type {
  AsyncResult,
  AuditableFields,
  CustomerId,
  ISODateTime,
  Money,
  PaginatedResult,
  QueryOptions,
  SaleId,
  TenantScopedFields,
} from '@/sdk/core';

// نوع العميل.
export type CustomerKind = 'individual' | 'business';

// شريحة الولاء المشتقة من الإنفاق.
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// قناة التواصل المفضلة.
export type ContactChannel = 'sms' | 'whatsapp' | 'email' | 'none';

// مرجع شراء على ملف العميل.
export interface CustomerPurchaseRef {
  readonly saleId: SaleId; // الفاتورة.
  readonly saleNumber: string; // رقمها.
  readonly total: Money; // إجماليها.
  readonly at: ISODateTime; // لحظتها.
}

// كيان العميل.
export interface Customer extends TenantScopedFields, AuditableFields {
  readonly id: CustomerId; // المعرّف.
  readonly kind: CustomerKind; // فرد أم منشأة.
  readonly fullName: string; // الاسم الكامل.
  readonly phone?: string; // الهاتف (مُعرّف عملي في نقاط البيع).
  readonly email?: string; // البريد.
  readonly address?: string; // العنوان.
  readonly totalSpent: Money; // الإنفاق التراكمي.
  readonly orderCount: number; // عدد الطلبات.
  readonly pointsBalance: number; // رصيد النقاط.
  readonly totalPointsEarned: number; // إجمالي المكتسب.
  readonly tier: LoyaltyTier; // الشريحة.
  readonly preferredChannel: ContactChannel; // قناة التواصل.
  readonly tags: readonly string[]; // وسوم CRM.
  readonly purchases: readonly CustomerPurchaseRef[]; // سجل المشتريات.
  readonly lastVisitAt?: ISODateTime; // آخر زيارة.
  readonly active: boolean; // نشط؟
}

// عتبات شرائح الولاء (بالعملة الأساسية) — بيانات قابلة للضبط لا أرقام مبعثرة.
export const LOYALTY_THRESHOLDS = Object.freeze({
  bronze: 0, // الشريحة الافتراضية.
  silver: 50_000, // فضي.
  gold: 200_000, // ذهبي.
  platinum: 500_000, // بلاتيني.
});

// معدّل اكتساب النقاط (نقطة لكل وحدة عملة).
export const POINTS_PER_UNIT = 0.01;

// يشتق شريحة الولاء من الإنفاق التراكمي (دالة نقية).
export const deriveTier = (totalSpent: number): LoyaltyTier => {
  // نتحقق تنازليًا من الأعلى للأدنى.
  if (totalSpent >= LOYALTY_THRESHOLDS.platinum) return 'platinum';
  if (totalSpent >= LOYALTY_THRESHOLDS.gold) return 'gold';
  if (totalSpent >= LOYALTY_THRESHOLDS.silver) return 'silver';
  // الافتراضي.
  return 'bronze';
};

// يحسب النقاط المكتسبة من مبلغ شراء (دالة نقية).
export const calculatePoints = (amount: number): number =>
  // نقاط صحيحة لا كسرية.
  Math.max(0, Math.floor(amount * POINTS_PER_UNIT));

// أمر إنشاء عميل.
export interface CreateCustomerCommand {
  readonly fullName: string; // الاسم.
  readonly kind?: CustomerKind; // النوع.
  readonly phone?: string; // الهاتف.
  readonly email?: string; // البريد.
  readonly address?: string; // العنوان.
  readonly preferredChannel?: ContactChannel; // قناة التواصل.
  readonly tags?: readonly string[]; // الوسوم.
}

// أمر تعديل عميل.
export interface UpdateCustomerCommand extends Partial<CreateCustomerCommand> {
  readonly id: CustomerId; // المعرّف المستهدف.
  readonly active?: boolean; // تفعيل/تعطيل.
}

// استعلام سرد العملاء.
export interface CustomerListQuery extends QueryOptions {
  readonly tier?: LoyaltyTier; // تضييق بالشريحة.
  readonly activeOnly?: boolean; // النشطون فقط.
  readonly term?: string; // بحث بالاسم/الهاتف.
}

// مخطط إنشاء عميل.
export const createCustomerSchema = z.object({
  // الاسم إلزامي وضمن حد معقول.
  fullName: z.string().trim().min(2, 'sdk.validation.nameTooShort').max(120, 'sdk.validation.nameTooLong'),
  kind: z.enum(['individual', 'business']).optional(), // النوع.
  // الهاتف أرقام ورموز هاتفية فقط.
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/u, 'sdk.validation.invalidPhone')
    .optional(),
  email: z.email('sdk.validation.invalidEmail').optional(), // البريد.
  address: z.string().trim().max(300).optional(), // العنوان.
  preferredChannel: z.enum(['sms', 'whatsapp', 'email', 'none']).optional(), // القناة.
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(), // الوسوم.
});

// مخطط تعديل عميل.
export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().trim().min(1, 'sdk.validation.required'), // المعرّف.
  active: z.boolean().optional(), // الحالة.
});

// مستودع العملاء.
export interface CustomerRepository {
  // يسرد العملاء مُرقَّمين.
  list(query?: CustomerListQuery): AsyncResult<PaginatedResult<Customer>>;
  // يجلب عميلًا.
  get(id: CustomerId): AsyncResult<Customer>;
  // يبحث بالهاتف (مُعرّف عملي شائع في نقاط البيع).
  findByPhone(phone: string): AsyncResult<Customer | null>;
  // ينشئ عميلًا.
  create(command: CreateCustomerCommand): AsyncResult<Customer>;
  // يعدّل عميلًا.
  update(command: UpdateCustomerCommand): AsyncResult<Customer>;
  // يسجّل عملية شراء على ملفه (يحدّث الإنفاق والنقاط والشريحة).
  recordPurchase(id: CustomerId, purchase: CustomerPurchaseRef): AsyncResult<Customer>;
  // يستبدل نقاطًا برصيد (يخصم من الرصيد).
  redeemPoints(id: CustomerId, points: number): AsyncResult<Customer>;
}
