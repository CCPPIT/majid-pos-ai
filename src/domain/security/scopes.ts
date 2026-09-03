/**
 * نطاقات الصلاحيات (Scopes) — قسم 15 من الموجهات.
 * النطاق يحدد مستوى البيانات الذي يغطيه الإذن، من الأضيق إلى الأوسع.
 */

// الأنواع الستة للنطاق المعتمدة في النظام (من الأضيق للأوسع).
export type Scope =
  | 'own' // بيانات المستخدم نفسه فقط (مثل: سجل حضوره).
  | 'store' // على مستوى المتجر.
  | 'branch' // على مستوى الفرع (يضم عدة متاجر).
  | 'organization' // على مستوى المؤسسة (تضم عدة فروع).
  | 'tenant' // على مستوى المستأجر بالكامل (SaaS).
  | 'global'; // على مستوى المنصة كلها (مالك المنصة فقط).

// ترتيب النطاقات رقميًا: الأكبر = الأوسع تغطيةً.
export const SCOPE_RANK: Record<Scope, number> = {
  own: 0, // أضيق نطاق.
  store: 1, // متجر.
  branch: 2, // فرع.
  organization: 3, // مؤسسة.
  tenant: 4, // مستأجر.
  global: 5, // المنصة كاملة.
};

// كل النطاقات كقائمة (للتحقق والعرض).
export const ALL_SCOPES: readonly Scope[] = [
  'own',
  'store',
  'branch',
  'organization',
  'tenant',
  'global',
];

/**
 * هل النطاق الممنوح يغطّي النطاق المطلوب؟
 * القاعدة: النطاق الأوسع يغطي كل النطاقات الأضيق منه.
 * مثال: دور بنطاق 'branch' يستطيع الوصول لبيانات 'store' و'own'.
 */
export const scopeCovers = (granted: Scope, required: Scope): boolean => {
  // نقارن الرتبة: رتبة الممنوح ≥ رتبة المطلوب تعني التغطية.
  return SCOPE_RANK[granted] >= SCOPE_RANK[required];
};
