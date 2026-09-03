/**
 * فصل DTO الإصدارات — PHASE 32 · قسم 38.
 *
 * ثلاث طبقات منفصلة لا تختلط:
 *   API Response (خارجي، قد يتغيّر بين v1/v2)
 *     ↓ DTO خام يحمل نسخة الـAPI
 *   Version Adapter (يحوّل أي نسخة API إلى عقد الـSDK الحالي)
 *     ↓
 *   SDK Contract (مستقر داخليًا) → Domain Entity
 *
 * القاعدة: لا يُستخدم API DTO مباشرة ككيان مجال (أحد محظورات بوابة الجودة).
 * هذا الملف أساس بلا خادم (قسم 11): نعرّف الشكل والمحوّل فقط.
 */
import { z } from 'zod';
import { validateContract } from '../validation/contract-validation';
import type { ContractResult } from '../result/result';

// بادئة نسخة الـAPI على شكل DTO (تمييزها عن نسخة عقد المجال).
export type ApiDtoVersion = `v${number}`;

// غلاف DTO الخام القادم من أي نسخة API (قسم 38 و60).
export interface ApiDTO<TPayload> {
  readonly apiVersion: ApiDtoVersion; // نسخة الـAPI المنتِجة (v1 · v2…).
  readonly contractVersion: string; // نسخة العقد كما أبلغها الخادم.
  readonly payload: TPayload; // الحمولة الخام (تُتحقَّق قبل الاستخدام).
  readonly requestId: string; // معرّف الطلب للتتبّع.
}

// مخطط Zod للتحقق من غلاف DTO عند الحدود (قسم 23).
export const apiDtoSchema = <TSchema extends z.ZodType>(payloadSchema: TSchema) =>
  z.object({
    apiVersion: z.string().regex(/^v\d+$/, 'sdk.validation.apiVersion'),
    contractVersion: z.string().min(1),
    payload: payloadSchema,
    requestId: z.string().min(1),
  });

/**
 * محوّل إصدارات DTO: يسجّل دالة تحويل لكل (نسخة API · كيان).
 * يحوّل أي DTO خام إلى عقد الـSDK الحالي، فيتطوّر الخادم لـv2/v3
 * دون أن يلمس المستهلك الداخلي شيئًا.
 */
export class DtoVersionAdapter<TOutput> {
  // خريطة النسخة ← دالة التحويل.
  private readonly adapters = new Map<string, (payload: unknown) => TOutput>();

  // يسجّل محوّلًا لنسخة API محددة.
  register(apiVersion: ApiDtoVersion, adapt: (payload: unknown) => TOutput): void {
    this.adapters.set(apiVersion, adapt);
  }

  /**
   * يحوّل DTO خامًا إلى عقد الـSDK الحالي.
   * يفشل إن كانت نسخة الـAPI بلا محوّل مسجّل (لا استهلاك أعمى).
   */
  adapt(dto: ApiDTO<unknown>): ContractResult<TOutput> {
    // نبحث عن محوّل النسخة.
    const adapt = this.adapters.get(dto.apiVersion);
    // لا محوّل → نسخة API غير مدعومة.
    if (!adapt) {
      return {
        success: false,
        error: {
          code: 'CONTRACT_VERSION_UNSUPPORTED',
          message: `لا محوّل لنسخة API ${dto.apiVersion}`,
          retryable: false,
          errorVersion: '1.0.0',
        },
      };
    }
    // نطبّق التحويل داخل أمان النتيجة.
    try {
      return { success: true, data: adapt(dto.payload) };
    } catch (cause) {
      return {
        success: false,
        error: {
          code: 'CONTRACT_MIGRATION_FAILED',
          message: cause instanceof Error ? cause.message : String(cause),
          retryable: false,
          errorVersion: '1.0.0',
        },
      };
    }
  }
}

/**
 * يتحقق من غلاف DTO خام عند الحدود ثم يمرّره للمحوّل.
 * يجمع بين تحقق Zod (قسم 23) وتحويل الإصدار (قسم 38) في خطوة واحدة.
 */
export const parseAndAdaptDto = <TSchema extends z.ZodType, TOutput>(
  raw: unknown,
  payloadSchema: TSchema,
  adapter: DtoVersionAdapter<TOutput>,
): ContractResult<TOutput> => {
  // نتحقق من بنية الغلاف والحمولة.
  const parsed = validateContract(apiDtoSchema(payloadSchema), raw);
  // فشل التحقق يُمرَّر كما هو (خطأ العقد بنيته متوافقة).
  if (!parsed.success) return parsed as ContractResult<TOutput>;
  // نحوّل النسخة إلى عقد الـSDK الحالي (الحمولة المتحقَّق منها خام للمحوّل).
  const dto = parsed.data as unknown as ApiDTO<unknown>;
  return adapter.adapt(dto);
};
