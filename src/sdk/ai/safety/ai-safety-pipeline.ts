/**
 * خط أمان الذكاء الاصطناعي — PHASE 31 · قسم 48 (أشد بنود المرحلة صرامة).
 *
 * المسار الإلزامي لكل عملية ذكاء:
 *   1) Intent      — تصنيف النية.
 *   2) Permission  — فحص الصلاحية (Fail-Closed).
 *   3) Validation  — تحقق المعاملات بمخطط.
 *   4) Preview     — توليد معاينة الأثر.
 *   5) Confirmation— تأكيد بشري صريح.
 *   6) Action      — التنفيذ عبر خدمة المجال (لا وصول مباشر للمستودع).
 *   7) Audit       — أثر تدقيق لا يُحذف.
 *
 * البوابة أدناه لا تنفّذ شيئًا بنفسها: تُعيد قرارًا. التنفيذ يبقى مسؤولية
 * خدمة المجال المعنيّة، التي تُعيد فحص الصلاحية بدورها (دفاع بالعمق).
 */
import {
  AuthorizationError,
  ValidationError,
  failure,
  success,
  type Result,
} from '@/sdk/core';
import type { z } from 'zod';
import type { AIActionPreview, AIIntent, AIPreviewChange } from '../contracts/ai-contracts';
import { requiresFullPipeline } from '../contracts/ai-contracts';

// مراحل خط الأمان بالترتيب (تُستخدم في التتبّع والتدقيق).
export const AI_PIPELINE_STAGES = Object.freeze([
  'intent', // تصنيف النية.
  'permission', // فحص الصلاحية.
  'validation', // تحقق المعاملات.
  'preview', // توليد المعاينة.
  'confirmation', // التأكيد البشري.
  'action', // التنفيذ.
  'audit', // التدقيق.
] as const);

// نوع المرحلة المشتق من الفهرس.
export type AIPipelineStage = (typeof AI_PIPELINE_STAGES)[number];

// قرار البوابة: إما رفض بسبب، أو سماح بالانتقال للمرحلة التالية.
export interface AIGateDecision {
  readonly allowed: boolean; // هل يُسمح بالمتابعة؟
  readonly stage: AIPipelineStage; // المرحلة التي انتهى عندها القرار.
  readonly reasonKey?: string; // سبب الرفض (مفتاح ترجمة).
}

// نتيجة تمرير نية عبر خط الأمان كاملًا حتى ما قبل التنفيذ.
export interface AISafetyOutcome<TParams> {
  readonly intent: AIIntent; // النية بعد التصنيف.
  readonly parameters: TParams; // المعاملات بعد التحقق (مُقوَّمة الأنواع).
  readonly preview: AIActionPreview; // المعاينة المطلوب تأكيدها.
  readonly requiresConfirmation: true; // ثابت: لا تنفيذ بلا تأكيد.
}

// (1) بوابة النية: ترفض ما لا يُفهم.
export const gateIntent = (intent: AIIntent): AIGateDecision => {
  // النية غير المفهومة تُرفض (لا تخمين في عمليات مالية).
  if (intent.type === 'unknown') {
    return { allowed: false, stage: 'intent', reasonKey: 'sdk.ai.error.unknownIntent' };
  }
  // ثقة منخفضة تُرفض أيضًا (عتبة محافظة).
  if (intent.confidence < 0.6) {
    return { allowed: false, stage: 'intent', reasonKey: 'sdk.ai.error.lowConfidence' };
  }
  // النية مقبولة.
  return { allowed: true, stage: 'intent' };
};

// (2) بوابة الصلاحية: Fail-Closed — غياب الإذن يعني الرفض.
export const gatePermission = (intent: AIIntent, permissions: readonly string[]): AIGateDecision => {
  // القراءة والتنقّل لا يحتاجان إذنًا خاصًا هنا (تفرضه الخدمات لاحقًا).
  if (!requiresFullPipeline(intent)) return { allowed: true, stage: 'permission' };
  // نية بلا إذن معرّف تُرفض (لا افتراض سماح).
  if (intent.requiredPermission.trim().length === 0) {
    return { allowed: false, stage: 'permission', reasonKey: 'sdk.ai.error.noPermissionDefined' };
  }
  // فحص الامتلاك الصريح للإذن.
  if (!permissions.includes(intent.requiredPermission)) {
    return { allowed: false, stage: 'permission', reasonKey: 'sdk.ai.error.permissionDenied' };
  }
  // مسموح.
  return { allowed: true, stage: 'permission' };
};

// (3) بوابة التحقق: كل معامل يمر بمخطط قبل أي معاينة.
export const gateValidation = <TSchema extends z.ZodType>(
  schema: TSchema,
  parameters: unknown,
): Result<z.infer<TSchema>> => {
  // تحقق آمن بلا استثناءات.
  const parsed = schema.safeParse(parameters);
  // الفشل يُحوَّل لخطأ تحقق موصوف.
  if (!parsed.success) {
    // نبني خريطة الحقول من أخطاء المخطط.
    const fields: Record<string, string> = {};
    // أول رسالة لكل حقل تكفي للعرض.
    for (const issue of parsed.error.issues) {
      // مسار الحقل كنص.
      const path = issue.path.join('.') || 'value';
      // لا نستبدل رسالة مسجّلة مسبقًا.
      if (fields[path] === undefined) fields[path] = issue.message;
    }
    // خطأ تحقق يحمل تفاصيل الحقول.
    return failure(new ValidationError('sdk.ai.error.validationFailed', fields));
  }
  // المعاملات الصالحة.
  return success(parsed.data);
};

// (4) بوابة المعاينة: تبني وصفًا بشريًا للأثر قبل التنفيذ.
export const buildPreview = (input: {
  readonly summaryKey: string; // مفتاح الملخص.
  readonly summaryParams?: Readonly<Record<string, string | number>>; // معاملاته.
  readonly changes: readonly AIPreviewChange[]; // التغييرات.
  readonly warnings?: readonly string[]; // التحذيرات.
  readonly reversible?: boolean; // قابلية التراجع.
}): AIActionPreview => ({
  summaryKey: input.summaryKey,
  summaryParams: input.summaryParams ?? {},
  changes: input.changes,
  warnings: input.warnings ?? [],
  // الافتراض المحافظ: العملية غير قابلة للتراجع ما لم يُصرَّح بعكسه.
  reversible: input.reversible ?? false,
  // ثابت لا يقبل التعطيل — التأكيد إلزامي دائمًا.
  requiresConfirmation: true,
});

// (5) بوابة التأكيد: لا تنفيذ إلا بتأكيد بشري صريح لنفس المعاينة.
export const gateConfirmation = (confirmed: boolean, previewShown: boolean): AIGateDecision => {
  // معاينة لم تُعرض تعني أن المستخدم لم يرَ ما سيحدث.
  if (!previewShown) {
    return { allowed: false, stage: 'confirmation', reasonKey: 'sdk.ai.error.previewNotShown' };
  }
  // غياب التأكيد رفض (الصمت ليس موافقة).
  if (!confirmed) {
    return { allowed: false, stage: 'confirmation', reasonKey: 'sdk.ai.error.notConfirmed' };
  }
  // مؤكَّد.
  return { allowed: true, stage: 'confirmation' };
};

/**
 * يشغّل خط الأمان من النية حتى المعاينة (المراحل 1–4).
 * لا ينفّذ شيئًا: يُعيد ما يجب عرضه على المستخدم لتأكيده.
 */
export const runSafetyPipeline = <TSchema extends z.ZodType>(input: {
  readonly intent: AIIntent; // النية المستخرجة.
  readonly permissions: readonly string[]; // صلاحيات المستخدم.
  readonly schema: TSchema; // مخطط معاملات النية.
  readonly summaryKey: string; // مفتاح ملخص المعاينة.
  readonly changes: readonly AIPreviewChange[]; // التغييرات المتوقّعة.
  readonly warnings?: readonly string[]; // تحذيرات.
  readonly reversible?: boolean; // قابلية التراجع.
}): Result<AISafetyOutcome<z.infer<TSchema>>> => {
  // (1) النية.
  const intentGate = gateIntent(input.intent);
  // رفض النية يُعاد كخطأ تحقق موصوف بالمرحلة.
  if (!intentGate.allowed) {
    return failure(
      new ValidationError(intentGate.reasonKey ?? 'sdk.ai.error.unknownIntent', { stage: intentGate.stage }),
    );
  }
  // (2) الصلاحية.
  const permissionGate = gatePermission(input.intent, input.permissions);
  // الرفض هنا خطأ تفويض صريح (لا خطأ تحقق).
  if (!permissionGate.allowed) {
    // نمرّر الإذن الناقص والمورد في التفاصيل لأثر التدقيق.
    return failure(
      new AuthorizationError(permissionGate.reasonKey ?? 'sdk.ai.error.permissionDenied', {
        details: {
          requiredPermission: input.intent.requiredPermission,
          resource: input.intent.resource,
          stage: permissionGate.stage,
        },
      }),
    );
  }
  // (3) التحقق.
  const validated = gateValidation(input.schema, input.intent.parameters);
  // فشل التحقق يُمرَّر كما هو.
  if (!validated.success) return validated;
  // (4) المعاينة.
  const preview = buildPreview({
    summaryKey: input.summaryKey,
    changes: input.changes,
    warnings: input.warnings,
    reversible: input.reversible,
  });
  // النتيجة: كل ما يلزم لعرض التأكيد — بلا أي تنفيذ.
  return success({
    intent: input.intent,
    parameters: validated.data,
    preview,
    requiresConfirmation: true,
  });
};

/**
 * يفلتر الرؤى حسب صلاحيات المستخدم.
 * رؤية في مجال لا يملك المستخدم قراءته تُحذف كاملة (لا تسريب عبر العنوان).
 */
export const filterInsightsByPermission = <
  TInsight extends { readonly requiredPermission: string; readonly suggestedAction?: { readonly permission: string } },
>(
  insights: readonly TInsight[],
  permissions: readonly string[],
): { readonly visible: readonly TInsight[]; readonly hiddenCount: number } => {
  // الرؤى المسموح بها.
  const visible: TInsight[] = [];
  // عدّاد المحجوب.
  let hiddenCount = 0;
  // نمرّ على كل رؤية.
  for (const insight of insights) {
    // غياب صلاحية المجال يحجب الرؤية كليًا.
    if (!permissions.includes(insight.requiredPermission)) {
      hiddenCount += 1;
      continue;
    }
    // زر الإجراء يُزال وحده إن غابت صلاحيته (مع بقاء الرؤية).
    if (insight.suggestedAction && !permissions.includes(insight.suggestedAction.permission)) {
      visible.push({ ...insight, suggestedAction: undefined });
      continue;
    }
    // الرؤية كاملة.
    visible.push(insight);
  }
  // النتيجة.
  return { visible, hiddenCount };
};
