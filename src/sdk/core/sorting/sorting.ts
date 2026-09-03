/**
 * نظام الترتيب — PHASE 31 · قسم 48.
 * الترتيب يُعرَّف كبيانات { field, direction } فيُنقل للخادم أو يُطبَّق محليًا.
 * يدعم ترتيبًا متعدد المفاتيح ومقارنة عربية صحيحة للنصوص.
 */
import { readField } from '../filters/filters';

// اتجاه الترتيب.
export type SortDirection = 'asc' | 'desc';

// مفتاح ترتيب واحد.
export interface Sort {
  readonly field: string; // اسم الحقل (يدعم المسارات المتداخلة).
  readonly direction: SortDirection; // الاتجاه.
}

// يبني مفتاح ترتيب (افتراضيًا تصاعدي).
export const sort = (field: string, direction: SortDirection = 'asc'): Sort => ({ field, direction });

// ترتيب تنازلي بحقل الإنشاء — الافتراضي الأكثر استخدامًا في السجلات.
export const NEWEST_FIRST: Sort = { field: 'createdAt', direction: 'desc' };

/**
 * يقارن قيمتين خامتين مقارنة مستقرة ومحايدة للنوع.
 * النصوص تُقارن بمُقارِن عربي (Intl) ليصح ترتيب الأسماء العربية.
 */
export const compareValues = (left: unknown, right: unknown): number => {
  // القيم الغائبة تُدفع لآخر الترتيب دائمًا.
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;
  // كلاهما غائب → متساويان.
  if (leftMissing && rightMissing) return 0;
  // الغائب يأتي بعد الموجود.
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  // أرقام: فرق مباشر.
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  // منطقية: false قبل true.
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  // نصوص: نحاول تفسيرها كتاريخ أولًا (حقول ISO شائعة في المجال).
  const leftTime = new Date(String(left)).getTime();
  const rightTime = new Date(String(right)).getTime();
  // كلاهما تاريخ صالح → مقارنة زمنية.
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && /\d{4}-\d{2}-\d{2}/.test(String(left))) {
    return leftTime - rightTime;
  }
  // وإلا مقارنة نصية عربية-واعية (تُرتّب الألف قبل الباء… بشكل صحيح).
  return String(left).localeCompare(String(right), 'ar');
};

/**
 * يبني دالة مقارنة من قائمة مفاتيح ترتيب.
 * المفتاح الأول له الأولوية، ثم الذي يليه عند التساوي (ترتيب متعدد المستويات).
 */
export const comparatorFor = <T>(sorts: readonly Sort[]): ((left: T, right: T) => number) =>
  (left: T, right: T): number => {
    // نمرّ على المفاتيح بالترتيب.
    for (const key of sorts) {
      // نقرأ القيمتين من الحقل المطلوب.
      const result = compareValues(readField(left, key.field), readField(right, key.field));
      // أول مفتاح يفرّق يحسم النتيجة (مع عكسها عند التنازلي).
      if (result !== 0) return key.direction === 'desc' ? -result : result;
    }
    // كل المفاتيح متساوية → الحفاظ على الترتيب الأصلي.
    return 0;
  };

/**
 * يطبّق الترتيب على مصفوفة دون تعديل الأصل (Immutable).
 * الترتيب مستقر: العناصر المتساوية تبقى بترتيب ورودها.
 */
export const applySort = <T>(items: readonly T[], sorts?: Sort | readonly Sort[]): T[] => {
  // بلا ترتيب → نسخة كما هي.
  if (!sorts) return [...items];
  // نوحّد المدخل إلى مصفوفة مفاتيح.
  const keys = Array.isArray(sorts) ? sorts : [sorts as Sort];
  // قائمة فارغة من المفاتيح لا تغيّر شيئًا.
  if (keys.length === 0) return [...items];
  // نرتّب نسخة بدالة المقارنة المبنية.
  return [...items].sort(comparatorFor<T>(keys));
};
