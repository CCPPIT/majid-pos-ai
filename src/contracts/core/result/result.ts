/**
 * نمط النتيجة على مستوى العقود — PHASE 32 · قسم 77.
 *
 * كل عملية في الـSDK تُعيد نتيجة موصّفة صراحةً:
 *   { success: true, data }  |  { success: false, error }
 * فيستحيل الوصول للبيانات دون التعامل مع الفشل (لا انهيارات غير ممسوكة).
 *
 * هذه النسخة في طبقة العقود إطار-محايدة (لا تستورد أخطاء الـSDK)، أما
 * الـSDK فيبني فوقها نسخته الغنية (attempt/combine/…). النتيجة بنية عقد
 * واحدة مستقرة عبر كل الطبقات.
 */

// نتيجة ناجحة: البيانات فقط.
export interface ContractSuccess<T> {
  readonly success: true; // علامة التفريع المميّزة.
  readonly data: T; // القيمة الناتجة.
}

// نتيجة فاشلة: الخطأ فقط (شكل الخطأ متعمَّم لإبقاء العقود مستقلة).
export interface ContractFailure<E = ContractErrorShape> {
  readonly success: false; // علامة التفريع المميّزة.
  readonly error: E; // الخطأ المصنّف بكود ثابت.
}

// اتحاد مميَّز يُجبر على فحص success أولًا.
export type ContractResult<T, E = ContractErrorShape> =
  | ContractSuccess<T>
  | ContractFailure<E>;

/**
 * الشكل الأدنى الذي يجب أن يحققه أي خطأ يمرّ عبر العقود — قسم 29.
 * المستهلكون يتفرّعون على error.code الثابت لا على الرسالة (قسم 30).
 */
export interface ContractErrorShape {
  readonly code: string; // كود الخطأ المستقر (مثال: PAYMENT_DECLINED).
  readonly message: string; // رسالة/مفتاح ترجمة بشري (ليس للتفريع البرمجي).
  readonly retryable?: boolean; // هل يعيد المستهلك المحاولة؟
  readonly details?: Readonly<Record<string, unknown>>; // تفاصيل آمنة (بلا أسرار — قسم 65).
  readonly errorVersion?: string; // نسخة عقد الخطأ (قسم 29: الأخطاء عقود).
}

// يبني نتيجة ناجحة.
export const ok = <T>(data: T): ContractSuccess<T> => ({ success: true, data });

// يبني نتيجة فاشلة.
export const fail = <E = ContractErrorShape>(error: E): ContractFailure<E> => ({
  success: false,
  error,
});

// حارس نوع: هل النتيجة ناجحة؟ (يضيّق النوع تلقائيًا).
export const isOk = <T, E>(result: ContractResult<T, E>): result is ContractSuccess<T> =>
  result.success;

// حارس نوع: هل النتيجة فاشلة؟
export const isErr = <T, E>(result: ContractResult<T, E>): result is ContractFailure<E> =>
  !result.success;

// يحوّل بيانات النجاح بدالة، ويمرّر الفشل كما هو.
export const mapOk = <T, U, E>(
  result: ContractResult<T, E>,
  transform: (value: T) => U,
): ContractResult<U, E> => (result.success ? ok(transform(result.data)) : result);
