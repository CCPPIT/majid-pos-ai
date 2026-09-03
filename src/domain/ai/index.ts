/**
 * نقطة تصدير مجال الذكاء الاصطناعي / Copilot (PHASE 24).
 */
export * from './types'; // أنواع الرسائل/النية/البطاقات.
export {
  normalizeArabic,
  parseCopilotQuery,
  SUGGESTION_KEYS,
} from './intents'; // فهم اللغة النقي (NLU).
export { buildCopilotFacts } from './answers'; // مولّد الحقائق النقي.
export type { CopilotFacts, CopilotFactsInput, CopilotAnswerKind } from './answers';
