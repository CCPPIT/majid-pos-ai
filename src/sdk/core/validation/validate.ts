/**
 * جسر التحقق المشترك بين Zod ونظام أخطاء الـSDK — PHASE 31 · قسم 42.
 *
 * موقع هذا الملف مقصود: التحقق سلوك تملكه النواة لا مجال بعينه.
 * كل مجال (منتجات · مبيعات · مدفوعات · مخزون · عملاء) يستدعيه، فلو سكن
 * أحد المجالات لأصبح بقية المجالات مقترنة به أفقيًا بلا سبب — وهو ما
 * تمنعه قاعدة الطبقات: العقد يُعرَّف في أدنى طبقة تملكه.
 */
import type { z } from 'zod';
import { ValidationError } from '../errors/sdk-error';
import { failure, success, type Result } from '../result/result';

/**
 * يحوّل أخطاء Zod إلى `ValidationError` بخريطة حقول جاهزة للنموذج.
 * مصدر واحد لسلوك التحقق في الـSDK كله.
 */
export const toValidationError = (error: z.ZodError): ValidationError => {
  // نبني خريطة: مسار الحقل ← رسالة/مفتاح الخطأ.
  const fieldErrors: Record<string, string> = {};
  // نمرّ على كل مشكلة أبلغ عنها Zod.
  for (const issue of error.issues) {
    // نركّب اسم الحقل من مساره (يدعم الحقول المتداخلة).
    const field = issue.path.join('.') || 'root';
    // أول رسالة لكل حقل تكفي للعرض.
    if (fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
  }
  // نُعيد خطأ تحقّق مُصنَّفًا.
  return new ValidationError('sdk.error.validation', fieldErrors);
};

/**
 * يشغّل مخطط Zod ويُعيد `Result` بدل رمي استثناء (قسم 06).
 * كل أوامر الـSDK تمر عبر هذه الدالة قبل تنفيذ أي منطق، فيستحيل
 * أن يصل أمر غير مُتحقَّق منه إلى قاعدة عمل أو مستودع.
 */
export const validateWith = <TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): Result<z.infer<TSchema>> => {
  // نستخدم safeParse فلا يُرمى استثناء أبدًا.
  const parsed = schema.safeParse(input);
  // الفشل يُحوَّل إلى ValidationError بخريطة حقول.
  if (!parsed.success) return failure(toValidationError(parsed.error));
  // النجاح يُعيد البيانات المُطبَّعة (بعد trim وغيره).
  return success(parsed.data);
};
