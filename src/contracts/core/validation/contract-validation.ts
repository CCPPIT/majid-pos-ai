/**
 * تحقّق العقود في وقت التشغيل — PHASE 32 · أقسام 22 · 23 · 24.
 *
 * TypeScript يحمي وقت التطوير، وZod يحمي وقت التشغيل. كل الحدود
 * (استجابات API · أوامر · استعلامات · بيانات مُخزَّنة · مخرجات الذكاء)
 * تمرّ عبر هذه الدوال، فيستحيل تسلّل قيمة غير موصوفة إلى منطق المجال.
 *
 * التدفق للذكاء (قسم 24):
 *   AI Provider ← Raw Output ← Zod Schema ← Validation ← Typed Result
 * ممنوع: AI ← any ← Mutation.
 */
import { z } from 'zod';
import { ERROR_CODES } from '../errors/error-codes';
import type { ContractResult } from '../result/result';
import { fail, ok } from '../result/result';

// نتيجة تحقّق خام: النجاح يحمل البيانات، الفشل يحمل أخطاء الحقول.
export interface ContractValidationIssue {
  readonly field: string; // مسار الحقل.
  readonly message: string; // رسالة الخطأ.
}

// شكل فشل التحقّق برمز العقد الثابت.
export interface ContractValidationError {
  readonly code: typeof ERROR_CODES.CONTRACT_VALIDATION_FAILED;
  readonly message: string;
  readonly retryable: false;
  readonly errorVersion: string;
  readonly issues: readonly ContractValidationIssue[];
}

// يحوّل خطأ Zod إلى فشل عقد موصّف.
export const toContractValidationError = (error: z.ZodError): ContractValidationError => {
  const issues: ContractValidationIssue[] = error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root', // جذر المخطط إن لم يكن هناك مسار.
    message: issue.message,
  }));
  return Object.freeze({
    code: ERROR_CODES.CONTRACT_VALIDATION_FAILED,
    message: 'sdk.error.validation',
    retryable: false,
    errorVersion: '1.0.0',
    issues: Object.freeze(issues),
  });
};

/**
 * يتحقّق من قيمة خام مقابل مخطط Zod ويعيد ContractResult.
 * الدالة الأساسية لكل حدود النظام: لا تُرمى استثناءات.
 */
export const validateContract = <TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): ContractResult<z.infer<TSchema>, ContractValidationError> => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(toContractValidationError(parsed.error));
  }
  return ok(parsed.data);
};

/**
 * تحقّق مخرجات الذكاء الاصطناعي تحديدًا — قسم 24.
 * يفرض أن كل مخرجات المزوّد تمرّ بمخطط قبل لمس منطق الأعمال.
 */
export const validateAIOutput = <TSchema extends z.ZodType>(
  schema: TSchema,
  rawOutput: unknown,
): ContractResult<z.infer<TSchema>, ContractValidationError> => validateContract(schema, rawOutput);

// أدوات مخططات مشتركة تقلّل التكرار عبر العقود.

// نصّ مقصوص بطول محدد.
export const trimmedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

// معرّف نصي غير فارغ.
export const idString = () => z.string().trim().min(1).max(128);

// طابع زمني ISO (تحقّق شكلي مبسّط).
export const isoDateTime = () =>
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'sdk.validation.isoDateTime',
  });

// رقم موجب/غير سالب محدود بحدّ أقصى.
export const nonnegativeNumber = (max = Number.MAX_SAFE_INTEGER) =>
  z.number().finite().nonnegative().max(max);
