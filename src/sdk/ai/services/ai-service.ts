/**
 * خدمة الذكاء الاصطناعي — PHASE 31 · أقسام 25 و26 و48.
 * الخدمة تنسّق خط الأمان وتسجّل كل خطوة في التدقيق. لا تملك صلاحية
 * تعديل أي بيانات: التنفيذ يُفوَّض لخدمة المجال بعد التأكيد البشري.
 */
import {
  BusinessRuleError,
  createAuditEvent,
  failure,
  success,
  systemClock,
  type AIRequestId,
  type AsyncResult,
  type AuditLogger,
  type Clock,
  type Result,
  type SDKContextStore,
} from '@/sdk/core';
import type { z } from 'zod';
import type { RbacService } from '@/sdk/rbac';
import {
  assessRisk,
  type AIInsight,
  type AIPreviewChange,
  type AIProviderPort,
  type AIRequest,
} from '../contracts/ai-contracts';
import {
  filterInsightsByPermission,
  gateConfirmation,
  runSafetyPipeline,
  type AISafetyOutcome,
} from '../safety/ai-safety-pipeline';

// الواجهة العلنية لخدمة الذكاء (sdk.ai).
export interface AIService {
  // يستقبل طلبًا نصيًّا ويُعيد نية مصنّفة (بلا تنفيذ).
  resolveIntent(prompt: string): AsyncResult<AIRequest>;
  // يمرّر نية عبر خط الأمان حتى المعاينة.
  prepare<TSchema extends z.ZodType>(input: {
    readonly request: AIRequest; // الطلب بنيّته.
    readonly schema: TSchema; // مخطط المعاملات.
    readonly summaryKey: string; // ملخص المعاينة.
    readonly changes: readonly AIPreviewChange[]; // التغييرات المتوقّعة.
    readonly warnings?: readonly string[]; // تحذيرات.
    readonly reversible?: boolean; // قابلية التراجع.
  }): AsyncResult<AISafetyOutcome<z.infer<TSchema>>>;
  // ينفّذ عملية مؤكَّدة عبر مُنفِّذ مُمرَّر (خدمة مجال) مع تدقيق كامل.
  execute<TParams, TResult>(input: {
    readonly outcome: AISafetyOutcome<TParams>; // نتيجة خط الأمان.
    readonly confirmed: boolean; // تأكيد المستخدم الصريح.
    readonly executor: (parameters: TParams) => AsyncResult<TResult>; // خدمة المجال المنفّذة.
  }): AsyncResult<TResult>;
  // يولّد رؤى مفلترة حسب صلاحيات المستخدم.
  getInsights(data: Readonly<Record<string, number>>): AsyncResult<readonly AIInsight[]>;
}

// تبعيات الخدمة.
export interface AIServiceDependencies {
  readonly provider: AIProviderPort; // مزوّد الذكاء (محلي أو بعيد).
  readonly rbac: RbacService; // الصلاحيات.
  readonly contextStore: SDKContextStore; // السياق.
  readonly audit: AuditLogger; // التدقيق (إلزامي — لا ذكاء بلا أثر).
  readonly clock?: Clock; // الساعة.
}

// عدّاد داخلي لمعرّفات الطلبات.
let requestSequence = 0;

// ينشئ خدمة الذكاء بالحقن.
export const createAIService = (deps: AIServiceDependencies): AIService => {
  // الساعة المستخدمة.
  const clock = deps.clock ?? systemClock;

  // بيانات التدقيق المشتركة.
  const auditBase = () => {
    // السياق الحالي.
    const context = deps.contextStore.get();
    // الحقول المشتركة.
    return {
      actor: context.userId ?? ('system' as const),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      branchId: context.branchId,
      storeId: context.storeId,
    };
  };

  return {
    // ── استخراج النية ──
    resolveIntent: async (prompt) => {
      // نص فارغ لا يُرسل للمزوّد أصلًا.
      if (prompt.trim().length === 0) {
        return failure(new BusinessRuleError('sdk.ai.error.emptyPrompt'));
      }
      // السياق المُمرَّر للمزوّد (بلا بيانات حساسة — لا معرّفات مستخدمين ولا مبالغ).
      const context = deps.contextStore.get();
      // نطلب التصنيف من المزوّد.
      const intent = await deps.provider.resolveIntent(prompt, {
        locale: context.locale,
        availableDomains: ['products', 'sales', 'inventory', 'customers', 'reports'],
        currency: context.currency,
      });
      // نعيد تقييم المخاطرة محليًا (لا نثق بتقييم المزوّد وحده).
      const riskLevel = assessRisk(intent.type, intent.action);
      // الطلب المبني.
      const request: AIRequest = {
        id: `ai-${(requestSequence += 1)}-${clock.timestamp().toString(36)}` as AIRequestId,
        userId: context.userId,
        prompt,
        intent: { ...intent, riskLevel },
        status: 'intent_resolved',
        createdAt: clock.now(),
      };
      // أثر تدقيق: كل طلب ذكاء يُسجَّل حتى لو كان قراءة.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'ai.intentResolved',
          resource: 'ai',
          resourceId: String(request.id),
          metadata: { type: intent.type, domain: intent.domain, risk: riskLevel },
        }),
      );
      // الطلب بنيّته.
      return success(request);
    },

    // ── التحضير عبر خط الأمان ──
    prepare: async (input) => {
      // غياب النية يعني طلبًا غير مصنّف.
      if (!input.request.intent) {
        return failure(new BusinessRuleError('sdk.ai.error.intentMissing'));
      }
      // نقرأ صلاحيات المستخدم الحالية.
      const permissionsResult = await deps.rbac.getPermissions();
      // فشل القراءة = بلا صلاحيات (Fail-Closed).
      const permissions = permissionsResult.success ? permissionsResult.data : [];
      // نشغّل خط الأمان (نية → صلاحية → تحقق → معاينة).
      const outcome = runSafetyPipeline({
        intent: input.request.intent,
        permissions,
        schema: input.schema,
        summaryKey: input.summaryKey,
        changes: input.changes,
        warnings: input.warnings,
        reversible: input.reversible,
      });
      // الرفض يُسجَّل في التدقيق قبل إعادته.
      if (!outcome.success) {
        deps.audit.record(
          createAuditEvent({
            ...auditBase(),
            action: 'ai.blocked',
            resource: 'ai',
            resourceId: String(input.request.id),
            result: 'denied',
            metadata: { reason: outcome.error.code, intent: input.request.intent.action },
          }),
        );
        return outcome;
      }
      // نجاح التحضير يُسجَّل أيضًا (المعاينة عُرضت).
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'ai.previewGenerated',
          resource: 'ai',
          resourceId: String(input.request.id),
          metadata: { changes: input.changes.length, risk: input.request.intent.riskLevel },
        }),
      );
      // نتيجة جاهزة للعرض والتأكيد.
      return outcome;
    },

    // ── التنفيذ بعد التأكيد ──
    execute: async (input) => {
      // (1) بوابة التأكيد: المعاينة عُرضت والمستخدم أكّد.
      const confirmation = gateConfirmation(input.confirmed, true);
      // الرفض يُسجَّل ويُعاد (لا تنفيذ صامت).
      if (!confirmation.allowed) {
        deps.audit.record(
          createAuditEvent({
            ...auditBase(),
            action: 'ai.executionRejected',
            resource: 'ai',
            result: 'denied',
            metadata: { reason: confirmation.reasonKey ?? 'sdk.ai.error.notConfirmed' },
          }),
        );
        return failure(
          new BusinessRuleError(confirmation.reasonKey ?? 'sdk.ai.error.notConfirmed', {
            details: { stage: confirmation.stage },
          }),
        );
      }
      // (2) التنفيذ يفوَّض لخدمة المجال — التي تُعيد فحص الصلاحية بنفسها.
      const result = await input.executor(input.outcome.parameters);
      // (3) أثر التدقيق النهائي بنتيجته الفعلية.
      deps.audit.record(
        createAuditEvent({
          ...auditBase(),
          action: 'ai.executed',
          resource: input.outcome.intent.resource,
          result: result.success ? 'success' : 'failure',
          metadata: {
            intentAction: input.outcome.intent.action,
            domain: input.outcome.intent.domain,
            risk: input.outcome.intent.riskLevel,
          },
        }),
      );
      // نتيجة خدمة المجال كما هي.
      return result;
    },

    // ── الرؤى ──
    getInsights: async (data) => {
      // نطلب الرؤى من المزوّد (قراءة فقط).
      const insights = await deps.provider.generateInsights(data);
      // نقرأ الصلاحيات لفلترتها.
      const permissionsResult = await deps.rbac.getPermissions();
      // Fail-Closed عند فشل القراءة.
      const permissions = permissionsResult.success ? permissionsResult.data : [];
      // نفلتر الرؤى وأزرارها حسب الصلاحيات.
      const filtered = filterInsightsByPermission(insights, permissions);
      // الرؤى المسموح بها فقط.
      return success(filtered.visible);
    },
  };
};

// يبني رفضًا موصوفًا لطلب ذكاء (يُستخدم في الواجهة لعرض السبب).
export const rejectRequest = (request: AIRequest, reasonKey: string, clock: Clock = systemClock): AIRequest => ({
  ...request,
  status: 'rejected',
  rejectionReasonKey: reasonKey,
  resolvedAt: clock.now(),
});

// يتحقق أن نتيجة خط الأمان ما زالت صالحة للتنفيذ (حارس إضافي).
export const assertExecutable = <TParams>(outcome: AISafetyOutcome<TParams>): Result<true> =>
  // المعاينة يجب أن تحمل علم التأكيد الإلزامي.
  outcome.preview.requiresConfirmation
    ? success(true)
    : failure(new BusinessRuleError('sdk.ai.error.previewInvalid'));
