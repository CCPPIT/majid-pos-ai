/**
 * عقد الذكاء الاصطناعي — PHASE 32 · أقسام 24 · 46 · 67.
 *
 * مخرجات الذكاء غير موثوقة: لا تُقبل إلا بعد مرورها بمخطط Zod
 * (قسم 24). طلبات الذكاء تحمل بيانات الخصوصية (dataClassification ·
 * privacyLevel · requiresConsent) — قسم 67. الذكاء تجريبي جزئيًا (experimental).
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const AI_CONTRACT_NAME = contractName('ai', 'AIResult');
// النسخة الحالية.
export const AI_CONTRACT_VERSION = domainContractVersion('ai');
// مستوى الاستقرار: الذكاء يبقى تجريبيًا في بعض ميزاته (قسم 46).
export const AI_STABILITY = 'experimental' as const;

// مخطط مخرجات الذكاء الخام (مثال: اقتراح مساعد البيع).
export const aiAssistantOutputSchema = z.object({
  intent: z.string().min(1), // نيّة المستخدم المُصنَّفة.
  confidence: z.number().min(0).max(1), // درجة الثقة.
  // الإجراء المقترح قد يحتوي معرّف منتج/كمية (قيم متحقَّق منها).
  suggestedAction: z
    .object({
      type: z.enum(['add_product', 'open_sale', 'answer', 'unknown']), // نوع الإجراء.
      productId: z.string().optional(), // المنتج إن وُجد.
      quantity: z.number().int().positive().optional(), // الكمية.
    })
    .optional(),
  message: z.string().max(1000), // رسالة الرد.
});

// نوع مخرجات الذكاء المُتحقَّق منها (لا any — قسم 24).
export type AIAssistantOutput = z.infer<typeof aiAssistantOutputSchema>;

// مخطط طلب الذكاء مع بيانات الخصوصية (قسم 67).
export const aiRequestSchema = z.object({
  prompt: z.string().min(1).max(4000), // النص المدخل.
  tenantId: z.string().min(1), // المستأجر.
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']), // التصنيف.
  requiresConsent: z.boolean().default(false), // يتطلب موافقة؟
});

// نوع طلب الذكاء.
export type AIRequest = z.infer<typeof aiRequestSchema>;

// عقد مزوّد الذكاء المُنسَّخ (قسم 36).
export interface AIProviderContract {
  readonly providerVersion: string; // نسخة المزوّد.
  // يولّد مخرجات خامًا (تُتحقَّق لاحقًا عبر aiAssistantOutputSchema).
  generate(request: AIRequest): Promise<import('../core').ContractResult<unknown>>;
}
