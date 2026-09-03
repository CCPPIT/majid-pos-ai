/**
 * أنواع مجال العملاء وCRM والولاء (PHASE 19).
 * العميل يحمل رصيد ولاء مشتقًا من مشترياته المدفوعة، ويُصنّف في شريحة (Tier)
 * بناءً على إنفاقه التاريخي. كل الحسابات النقدية تتم في core/money.
 */
import type { ID, ISODateString, Auditable } from '@/core/types/domain';
import type { Money } from '@/core/money/money';

// نوع العميل (فرد/تاجر).
export type CustomerKind = 'individual' | 'business';

// شريحة الولاء (تُشتق من الإنفاق التراكمي).
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// قناة التواصل/التسويق.
export type ContactChannel = 'sms' | 'whatsapp' | 'email' | 'none';

// مرجع عملية شراء مُسجّلة على ملف العميل (لقطة من الطلب).
export interface CustomerPurchase {
  orderId: ID; // معرف الطلب.
  orderNumber: string; // رقم الطلب البشري.
  total: Money; // إجمالي الطلب.
  at: ISODateString; // لحظة الشراء.
}

// ملاحظة CRM على ملف العميل.
export interface CustomerNote {
  id: ID; // معرف الملاحظة.
  text: string; // النص.
  createdAt: ISODateString; // لحظة الإنشاء.
  createdBy?: ID; // الكاتب.
}

// كيان العميل.
export interface Customer extends Auditable {
  id: ID; // معرف العميل.
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  kind: CustomerKind; // فرد أم تجاري.
  fullName: string; // الاسم الكامل.
  phone?: string; // الهاتف (مُعرّف أساسي في نقاط البيع).
  email?: string; // البريد.
  address?: string; // العنوان.
  // ── الولاء والإحصائيات ──
  totalSpent: Money; // الإنفاق التراكمي (مبالغ الطلبات المدفوعة).
  orderCount: number; // عدد الطلبات المدفوعة.
  pointsBalance: number; // رصيد نقاط الولاء.
  totalPointsEarned: number; // إجمالي النقاط المكتسبة (لا ينقص بالاسترداد).
  tier: LoyaltyTier; // الشريحة المشتقة.
  preferredChannel: ContactChannel; // قناة التواصل المفضلة.
  tags: string[]; // وسوم CRM (مثل VIP / جملة).
  notes: CustomerNote[]; // ملاحظات CRM.
  purchases: CustomerPurchase[]; // سجل المشتريات (الأحدث أولًا).
  lastVisitAt?: ISODateString; // آخر زيارة/شراء.
  active: boolean; // نشط؟
}

// نموذج إدخال عميل (من الشاشة).
export interface CustomerDraft {
  kind: CustomerKind; // النوع.
  fullName: string; // الاسم.
  phone: string; // الهاتف.
  email: string; // البريد.
  address: string; // العنوان.
  preferredChannel: ContactChannel; // القناة.
  tags: string; // الوسوم كنص مفصول بفواصل.
}

// سياق إنشاء/تحديث عميل.
export interface CustomerContext {
  tenantId: ID; // المستأجر.
  organizationId?: ID; // المؤسسة.
  branchId?: ID; // الفرع.
  storeId?: ID; // المتجر.
  userId?: ID; // المنفّذ.
}

// معايير بحث/استعلام العملاء.
export interface CustomerQuery {
  search?: string; // بحث بالاسم/الهاتف.
  tier?: LoyaltyTier; // فلترة بالشريحة.
  tag?: string; // فلترة بوسم.
  storeId?: ID; // تضييق المتجر.
  branchId?: ID; // تضييق الفرع.
  limit?: number; // حد النتائج.
}

// إعداد برنامج الولاء.
export interface LoyaltyProgramConfig {
  pointsPerCurrency: number; // نقطة لكل وحدة عملة مُنفقة (مثلاً 1 لكل 1000).
  currencyDivisor: number; // مقام العملة (1000 = نقطة لكل 1000).
}
