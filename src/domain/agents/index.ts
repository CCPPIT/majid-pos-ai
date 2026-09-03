/**
 * نقطة تصدير مجال الوكلاء الأذكياء (PHASE 25).
 */
export * from './types'; // أنواع الرؤى/الوكلاء/الإجراءات ومدخلات البيانات.
export { AGENTS, AGENT_BY_ID } from './agents-catalog'; // فهرس الوكلاء السبعة.
export { runAgents } from './rules'; // محرّك القواعد النقي.
export { applySafetyPipeline } from './safety'; // خط أمان الإجراءات.
export type { SafeInsights } from './safety';
