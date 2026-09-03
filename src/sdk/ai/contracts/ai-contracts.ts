/**
 * عقود مجال الذكاء الاصطناعي — PHASE 31 · أقسام 25 و26 و48.
 *
 * القاعدة الحاكمة التي لا تُخترق:
 *   User → AI → Intent → Permission → Validation → Preview → Confirmation → Action → Audit
 * ممنوع منعًا باتًا: AI → Direct Mutation.
 * الذكاء يقترح فقط؛ التنفيذ يحتاج نية مصنّفة، وصلاحية، وتحققًا، ومعاينة،
 * وتأكيدًا بشريًا صريحًا، وأثر تدقيق. غياب أي حلقة يُبطل العملية.
 */
import type { AIRequestId, ISODateTime, UserId } from '@/sdk/core';

// نوع النية المستخرجة من طلب المستخدم.
export type AIIntentType =
  | 'query' // استعلام قراءة فقط (آمن).
  | 'navigate' // تنقّل داخل التطبيق (آمن).
  | 'report' // توليد تقرير (قراءة).
  | 'suggest' // اقتراح بلا تنفيذ.
  | 'mutate' // طلب تعديل بيانات (يتطلب المسار الكامل).
  | 'unknown'; // نية غير مفهومة (تُرفض).

// مستوى المخاطرة المحسوب للنية.
export type AIRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

// حالة طلب الذكاء عبر خط الأمان.
export type AIRequestStatus =
  | 'received' // استُلم الطلب.
  | 'intent_resolved' // فُهمت النية.
  | 'permission_denied' // رُفض لغياب صلاحية.
  | 'validation_failed' // فشل التحقق.
  | 'awaiting_confirmation' // بانتظار تأكيد المستخدم.
  | 'confirmed' // أكّده المستخدم.
  | 'executed' // نُفّذ.
  | 'rejected' // رفضه المستخدم.
  | 'failed'; // فشل التنفيذ.

// نية مستخرجة موصوفة بالكامل.
export interface AIIntent {
  readonly type: AIIntentType; // نوعها.
  readonly domain: string; // المجال المستهدف (products/sales/inventory…).
  readonly action: string; // الفعل المطلوب.
  readonly resource: string; // المورد المستهدف.
  readonly parameters: Readonly<Record<string, unknown>>; // معاملات مستخرجة (غير موثوقة قبل التحقق).
  readonly confidence: number; // ثقة الاستخراج (0..1).
  readonly requiredPermission: string; // الصلاحية اللازمة للتنفيذ.
  readonly riskLevel: AIRiskLevel; // مستوى المخاطرة.
}

// معاينة الأثر قبل التنفيذ (يراها المستخدم ويؤكّدها).
export interface AIActionPreview {
  readonly summaryKey: string; // مفتاح ملخص العملية.
  readonly summaryParams: Readonly<Record<string, string | number>>; // معاملات الملخص.
  readonly changes: readonly AIPreviewChange[]; // التغييرات المتوقّعة حقلًا حقلًا.
  readonly warnings: readonly string[]; // تحذيرات (مفاتيح ترجمة).
  readonly reversible: boolean; // هل العملية قابلة للتراجع؟
  readonly requiresConfirmation: true; // ثابت: كل تعديل يتطلب تأكيدًا (نوع حرفي).
}

// تغيير مفرد في المعاينة.
export interface AIPreviewChange {
  readonly field: string; // الحقل المتأثر.
  readonly currentValue: string; // القيمة الحالية (منسّقة للعرض).
  readonly proposedValue: string; // القيمة المقترحة.
}

// طلب ذكاء كامل عبر دورة حياته.
export interface AIRequest {
  readonly id: AIRequestId; // معرّف الطلب.
  readonly userId?: UserId; // صاحب الطلب.
  readonly prompt: string; // النص الأصلي.
  readonly intent?: AIIntent; // النية المستخرجة.
  readonly preview?: AIActionPreview; // المعاينة المولّدة.
  readonly status: AIRequestStatus; // الحالة.
  readonly rejectionReasonKey?: string; // سبب الرفض.
  readonly createdAt: ISODateTime; // لحظة الاستلام.
  readonly resolvedAt?: ISODateTime; // لحظة الحسم.
}

// رؤية يقترحها الذكاء (قراءة فقط).
export interface AIInsight {
  readonly id: string; // معرّفها.
  readonly agentId: string; // الوكيل المصدر.
  readonly severity: 'info' | 'good' | 'warning' | 'critical'; // خطورتها.
  readonly titleKey: string; // عنوانها.
  readonly bodyKey: string; // نصها.
  readonly params: Readonly<Record<string, number>>; // معاملات الترجمة.
  readonly requiredPermission: string; // صلاحية رؤيتها.
  readonly suggestedAction?: AISuggestedAction; // إجراء مقترح (تنقّل فقط).
  readonly createdAt: ISODateTime; // لحظة توليدها.
}

// إجراء مقترح على رؤية (تنقّل لا كتابة).
export interface AISuggestedAction {
  readonly labelKey: string; // نص الزر.
  readonly permission: string; // صلاحية إظهاره.
  readonly route: string; // الوجهة داخل التطبيق.
}

// عقد مزوّد الذكاء (Port) — أي محرّك (محلي/بعيد) ينفّذه.
export interface AIProviderPort {
  readonly id: string; // معرّف المزوّد.
  // يستخرج النية من نص المستخدم (لا ينفّذ شيئًا).
  resolveIntent(prompt: string, context: AIPromptContext): Promise<AIIntent>;
  // يولّد رؤى من بيانات مُجمّعة (قراءة فقط).
  generateInsights(input: Readonly<Record<string, number>>): Promise<readonly AIInsight[]>;
}

// سياق يُمرَّر للمزوّد (بلا بيانات حساسة).
export interface AIPromptContext {
  readonly locale: string; // لغة المستخدم.
  readonly availableDomains: readonly string[]; // المجالات المتاحة له.
  readonly currency: string; // العملة النشطة.
}

// الأفعال المصنّفة عالية الخطورة (تتطلب أعلى درجات التحقق).
export const HIGH_RISK_ACTIONS: readonly string[] = Object.freeze([
  'delete', // حذف.
  'refund', // استرجاع مالي.
  'void', // إبطال.
  'adjust', // تسوية مخزون.
  'transfer', // تحويل.
  'approve', // اعتماد.
  'payout', // صرف.
]);

// يحسب مستوى المخاطرة من نوع النية وفعلها (دالة نقية).
export const assessRisk = (type: AIIntentType, action: string): AIRiskLevel => {
  // القراءة والتنقّل بلا مخاطرة.
  if (type === 'query' || type === 'navigate' || type === 'report' || type === 'suggest') return 'none';
  // النية غير المفهومة تُعامل كخطر أقصى (رفض افتراضي).
  if (type === 'unknown') return 'critical';
  // الأفعال المصنّفة عالية الخطورة.
  if (HIGH_RISK_ACTIONS.some((risky) => action.toLowerCase().includes(risky))) return 'high';
  // أي تعديل آخر متوسط الخطورة.
  return 'medium';
};

// هل تتطلب النية المرور بخط الأمان الكامل؟
export const requiresFullPipeline = (intent: AIIntent): boolean =>
  // كل تعديل أو نية غامضة يمر بالمسار الكامل.
  intent.type === 'mutate' || intent.type === 'unknown' || intent.riskLevel !== 'none';
