/**
 * ترقيم الصفحات — PHASE 31 · قسم 46.
 * يدعم النمطين: الترقيم بالصفحة (page/pageSize) والترقيم بالمؤشّر (cursor)
 * لقوائم كبيرة (كتالوجات ضخمة وسجلات مبيعات طويلة — قسم 66).
 */
import { ValidationError } from '../errors/sdk-error';
import { failure, success, type Result } from '../result/result';

// الحد الأدنى لعدد عناصر الصفحة.
export const MIN_PAGE_SIZE = 1;
// الحد الأقصى لعدد عناصر الصفحة (حماية ذاكرة الأجهزة الضعيفة — قسم 66).
export const MAX_PAGE_SIZE = 200;
// حجم الصفحة الافتراضي عند عدم التحديد.
export const DEFAULT_PAGE_SIZE = 25;

// مؤشّر ترقيم غير شفّاف (لا تفسّره الواجهة، تمرّره فقط).
export type Cursor = string;

// طلب ترقيم بالصفحة (الأنسب لقوائم قصيرة معروفة الطول).
export interface PageRequest {
  readonly page: number; // رقم الصفحة (يبدأ من 1).
  readonly pageSize: number; // عدد العناصر في الصفحة.
}

// طلب ترقيم بالمؤشّر (الأنسب للتمرير اللانهائي).
export interface CursorRequest {
  readonly cursor?: Cursor; // مؤشّر البداية (غيابه = من الأول).
  readonly pageSize: number; // عدد العناصر المطلوبة.
}

// طلب ترقيم موحّد: صفحة أو مؤشّر.
export type Pagination = PageRequest | CursorRequest;

// معلومات الصفحة الراجعة مع النتائج.
export interface PageInfo {
  readonly page: number; // رقم الصفحة الحالية.
  readonly pageSize: number; // حجم الصفحة المطبّق.
  readonly total: number; // إجمالي العناصر المطابقة قبل الترقيم.
  readonly totalPages: number; // عدد الصفحات الكلي.
  readonly hasNext: boolean; // هل توجد صفحة تالية؟
  readonly hasPrevious: boolean; // هل توجد صفحة سابقة؟
  readonly nextCursor?: Cursor; // مؤشّر الصفحة التالية (إن وُجدت).
}

// نتيجة مُرقَّمة: العناصر + معلومات الصفحة.
export interface PaginatedResult<T> {
  readonly items: readonly T[]; // عناصر الصفحة الحالية.
  readonly pageInfo: PageInfo; // بيانات الترقيم.
}

// حارس نوع: هل الطلب ترقيم بالمؤشّر؟
export const isCursorRequest = (value: Pagination): value is CursorRequest =>
  // وجود مفتاح cursor (ولو undefined) يميّز طلب المؤشّر عن طلب الصفحة.
  'cursor' in value || !('page' in value);

// يبني طلب صفحة بقيم افتراضية آمنة.
export const pageRequest = (page = 1, pageSize = DEFAULT_PAGE_SIZE): PageRequest => ({
  // لا نسمح برقم صفحة أقل من واحد.
  page: Math.max(1, Math.trunc(page)),
  // نحصر حجم الصفحة بين الحدين المسموحين.
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(pageSize))),
});

// يتحقق من صحة طلب الترقيم ويُعيد Result (لا يرمي).
export const validatePagination = (value: Pagination): Result<Pagination> => {
  // حجم الصفحة مشترك بين النمطين.
  const size = value.pageSize;
  // حجم غير رقمي أو خارج المدى → خطأ تحقّق واضح.
  if (!Number.isInteger(size) || size < MIN_PAGE_SIZE || size > MAX_PAGE_SIZE) {
    return failure(new ValidationError('sdk.error.invalidPageSize', { pageSize: 'sdk.validation.pageSize' }));
  }
  // في نمط الصفحة نتحقق من رقم الصفحة أيضًا.
  if (!isCursorRequest(value) && (!Number.isInteger(value.page) || value.page < 1)) {
    return failure(new ValidationError('sdk.error.invalidPage', { page: 'sdk.validation.page' }));
  }
  // الطلب صالح.
  return success(value);
};

// يبني مؤشّرًا من رقم إزاحة (تنفيذ محلي بسيط وقابل للاستبدال بمؤشّر الخادم).
export const encodeCursor = (offset: number): Cursor => `offset:${Math.max(0, Math.trunc(offset))}`;

// يفكّ المؤشّر إلى إزاحة رقمية (يُعيد صفرًا عند مؤشّر غير مفهوم).
export const decodeCursor = (cursor?: Cursor): number => {
  // غياب المؤشّر يعني البداية.
  if (!cursor) return 0;
  // نطابق الصيغة المتوقعة.
  const match = /^offset:(\d+)$/.exec(cursor);
  // مؤشّر غير مطابق يُعامل كبداية بدل رمي خطأ يعطّل القائمة.
  return match?.[1] !== undefined ? Number(match[1]) : 0;
};

/**
 * يطبّق الترقيم على مصفوفة محمّلة محليًا (Local Data Source).
 * التنفيذ البعيد سيستبدل هذه الدالة بترقيم الخادم دون تغيير أي عقد.
 */
export const paginate = <T>(items: readonly T[], pagination?: Pagination): PaginatedResult<T> => {
  // إجمالي العناصر قبل القص.
  const total = items.length;
  // بلا طلب ترقيم → صفحة واحدة تحوي كل العناصر.
  if (!pagination) {
    return {
      items,
      pageInfo: { page: 1, pageSize: total, total, totalPages: 1, hasNext: false, hasPrevious: false },
    };
  }
  // نحصر حجم الصفحة داخل المدى المسموح.
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(pagination.pageSize)));
  // نحسب الإزاحة حسب نمط الطلب (مؤشّر أو رقم صفحة).
  const offset = isCursorRequest(pagination)
    ? decodeCursor(pagination.cursor)
    : (Math.max(1, Math.trunc(pagination.page)) - 1) * pageSize;
  // نقتطع الشريحة المطلوبة.
  const slice = items.slice(offset, offset + pageSize);
  // نحسب رقم الصفحة الحالية من الإزاحة.
  const page = Math.floor(offset / pageSize) + 1;
  // عدد الصفحات الكلي (صفحة واحدة على الأقل حتى مع قائمة فارغة).
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // هل بقي عناصر بعد هذه الشريحة؟
  const hasNext = offset + slice.length < total;
  // نُرجع الشريحة مع بيانات الترقيم الكاملة.
  return {
    items: slice,
    pageInfo: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext,
      hasPrevious: offset > 0,
      nextCursor: hasNext ? encodeCursor(offset + slice.length) : undefined,
    },
  };
};

// يبني نتيجة مُرقَّمة فارغة (حالة \"لا بيانات\" الموحّدة).
export const emptyPage = <T>(pageSize = DEFAULT_PAGE_SIZE): PaginatedResult<T> => ({
  items: [],
  pageInfo: { page: 1, pageSize, total: 0, totalPages: 1, hasNext: false, hasPrevious: false },
});
