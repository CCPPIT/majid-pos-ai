/**
 * نمط النتيجة (Result Pattern) — PHASE 31 · قسم 06.
 * كل عملية أعمال في الـSDK تُعيد Result بدل رمي استثناء، فتُجبَر الواجهة على
 * التعامل مع الفشل صراحةً (لا شاشات بيضاء ولا انهيارات غير ممسوكة).
 * الشكل مطابق للمواصفة: { success: true, data } | { success: false, error }.
 */
import { toSDKError, type SDKError } from '../errors/sdk-error';
import type { Result as LegacyResult } from '@/core/result/Result';
import { toAppError } from '@/core/errors/AppError';

// نتيجة ناجحة تحمل البيانات فقط.
export interface Success<T> {
  readonly success: true; // علامة التفريع المميّزة.
  readonly data: T; // القيمة الناتجة.
}

// نتيجة فاشلة تحمل الخطأ فقط.
export interface Failure<E = SDKError> {
  readonly success: false; // علامة التفريع المميّزة.
  readonly error: E; // الخطأ المصنّف.
}

// اتحاد مميّز (Discriminated Union) يُجبر على فحص success قبل الوصول للبيانات.
export type Result<T, E = SDKError> = Success<T> | Failure<E>;

// نتيجة غير متزامنة (اختصار شائع في تواقيع المستودعات والخدمات).
export type AsyncResult<T, E = SDKError> = Promise<Result<T, E>>;

// يبني نتيجة ناجحة.
export const success = <T>(data: T): Success<T> => ({ success: true, data });

// يبني نتيجة فاشلة.
export const failure = <E = SDKError>(error: E): Failure<E> => ({ success: false, error });

// حارس نوع: هل النتيجة ناجحة؟ (يضيّق النوع تلقائيًا إلى Success<T>).
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => result.success;

// حارس نوع: هل النتيجة فاشلة؟ (يضيّق النوع تلقائيًا إلى Failure<E>).
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => !result.success;

// يحوّل بيانات نتيجة ناجحة بدالة، ويمرّر الفشل كما هو دون تنفيذ الدالة.
export const map = <T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> =>
  result.success ? success(transform(result.data)) : result;

// يحوّل خطأ نتيجة فاشلة بدالة، ويمرّر النجاح كما هو.
export const mapError = <T, E, F>(result: Result<T, E>, transform: (error: E) => F): Result<T, F> =>
  result.success ? result : failure(transform(result.error));

// يسلسل عمليات تُعيد Result (Monadic bind): يتوقف عند أول فشل.
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  next: (value: T) => Result<U, E>,
): Result<U, E> => (result.success ? next(result.data) : result);

// نسخة غير متزامنة من flatMap لسلسلة عمليات await.
export const flatMapAsync = async <T, U, E>(
  result: Result<T, E>,
  next: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> => (result.success ? next(result.data) : result);

// يُرجع البيانات أو قيمة بديلة عند الفشل (لا يرمي أبدًا).
export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.success ? result.data : fallback;

// يُرجع البيانات أو يحسب البديل من الخطأ (بديل ديناميكي).
export const unwrapOrElse = <T, E>(result: Result<T, E>, fallback: (error: E) => T): T =>
  result.success ? result.data : fallback(result.error);

/**
 * يشغّل دالة قد ترمي ويلتقط الاستثناء كـResult فاشلة.
 * يُستخدم داخل الـSDK فقط لتغليف المنطق القديم الذي يرمي (قسم 75).
 */
export const attempt = <T>(fn: () => T): Result<T, SDKError> => {
  try {
    // ننفّذ الدالة ونغلّف الناتج كنجاح.
    return success(fn());
  } catch (error) {
    // أي استثناء يُحوَّل إلى خطأ SDK مصنّف.
    return failure(toSDKError(error));
  }
};

// نسخة غير متزامنة من attempt لتغليف الوعود التي قد تُرفض.
export const attemptAsync = async <T>(fn: () => Promise<T>): Promise<Result<T, SDKError>> => {
  try {
    // ننتظر الوعد ونغلّف الناتج كنجاح.
    return success(await fn());
  } catch (error) {
    // الرفض يُحوَّل إلى خطأ SDK مصنّف.
    return failure(toSDKError(error));
  }
};

/**
 * يجمع قائمة نتائج في نتيجة واحدة تحمل مصفوفة.
 * يفشل عند أول خطأ (Fail-Fast) حفاظًا على وضوح السبب.
 */
export const combine = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
  // مصفوفة تجميع القيم الناجحة.
  const values: T[] = [];
  // نمرّ على كل نتيجة بالترتيب.
  for (const result of results) {
    // أول فشل يُنهي التجميع ويُعاد كما هو.
    if (!result.success) return result;
    // النجاح يُضاف للمصفوفة.
    values.push(result.data);
  }
  // كل النتائج نجحت.
  return success(values);
};

// يحوّل نتيجة الـSDK إلى نتيجة الطبقة القديمة (توافق خلفي — قسم 75).
export const toLegacyResult = <T>(result: Result<T, SDKError>): LegacyResult<T> =>
  // النجاح: { ok: true, value } — الفشل: نغلّف SDKError كـAppError عبر toAppError.
  result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: toAppError(result.error) };

// يحوّل نتيجة الطبقة القديمة إلى نتيجة الـSDK (جسر تدريجي للهجرة — قسم 74).
export const fromLegacyResult = <T>(result: LegacyResult<T>): Result<T, SDKError> =>
  // ok:true → success، غير ذلك نحوّل AppError إلى SDKError مصنّف.
  result.ok ? success(result.value) : failure(toSDKError(result.error));
