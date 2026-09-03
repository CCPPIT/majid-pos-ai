/**
 * الواجهة العلنية لمجال الذكاء الاصطناعي — PHASE 31 · قسم 51.
 */

// العقود والدوال النقية.
export {
  HIGH_RISK_ACTIONS,
  assessRisk,
  requiresFullPipeline,
  type AIIntent,
  type AIIntentType,
  type AIRiskLevel,
  type AIRequest,
  type AIRequestStatus,
  type AIActionPreview,
  type AIPreviewChange,
  type AIInsight,
  type AISuggestedAction,
  type AIProviderPort,
  type AIPromptContext,
} from './contracts/ai-contracts';

// خط الأمان (أهم مكوّن أمني في المجال).
export {
  AI_PIPELINE_STAGES,
  buildPreview,
  filterInsightsByPermission,
  gateConfirmation,
  gateIntent,
  gatePermission,
  gateValidation,
  runSafetyPipeline,
  type AIGateDecision,
  type AIPipelineStage,
  type AISafetyOutcome,
} from './safety/ai-safety-pipeline';

// الخدمة.
export {
  assertExecutable,
  createAIService,
  rejectRequest,
  type AIService,
  type AIServiceDependencies,
} from './services/ai-service';
