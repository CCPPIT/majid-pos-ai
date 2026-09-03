/**
 * نظام الفلترة العام — PHASE 31 · قسم 47.
 * فلاتر مُعرَّفة كبيانات (لا دوال) حتى تُنقل للخادم لاحقًا أو تُطبَّق محليًا،
 * وتُخزَّن، وتُسجَّل في التدقيق. المعامل والقيمة يُتحقق منهما قبل التطبيق.
 */

// المعاملات المدعومة في الفلترة.
export type FilterOperator =
  | 'equals' // يساوي تمامًا.
  | 'notEquals' // لا يساوي.
  | 'contains' // يحتوي نصًّا فرعيًا (غير حساس لحالة الأحرف).
  | 'startsWith' // يبدأ بنص.
  | 'endsWith' // ينتهي بنص.
  | 'greaterThan' // أكبر من (أرقام/تواريخ).
  | 'greaterOrEqual' // أكبر من أو يساوي.
  | 'lessThan' // أصغر من.
  | 'lessOrEqual' // أصغر من أو يساوي.
  | 'between' // بين قيمتين (شامل الطرفين).
  | 'in' // ضمن قائمة قيم.
  | 'notIn' // خارج قائمة قيم.
  | 'isNull' // القيمة غير موجودة.
  | 'isNotNull'; // القيمة موجودة.

// القيم المسموح بها في الفلتر (لا `any` — قسم 43).
export type FilterValue = string | number | boolean | null | readonly (string | number)[];

// شرط فلترة واحد على حقل محدد.
export interface Filter {
  readonly field: string; // اسم الحقل المستهدف (يدعم المسارات المتداخلة a.b).
  readonly operator: FilterOperator; // المعامل.
  readonly value?: FilterValue; // القيمة (تُترك فارغة مع isNull/isNotNull).
}

// كيفية دمج شروط المجموعة.
export type FilterCombinator = 'and' | 'or';

// مجموعة شروط قابلة للتداخل (شجرة فلاتر).
export interface FilterGroup {
  readonly combinator: FilterCombinator; // طريقة الدمج.
  readonly filters: readonly (Filter | FilterGroup)[]; // الشروط أو مجموعات فرعية.
}

// حارس نوع: هل العنصر مجموعة فلاتر (لا شرطًا مفردًا)؟
export const isFilterGroup = (value: Filter | FilterGroup): value is FilterGroup =>
  // وجود مفتاح combinator هو ما يميّز المجموعة.
  'combinator' in value;

// يبني شرط فلترة (مساعد قصير يحسّن قابلية القراءة في الاستدعاءات).
export const filter = (field: string, operator: FilterOperator, value?: FilterValue): Filter => ({
  field,
  operator,
  value,
});

// يبني مجموعة "و" (كل الشروط يجب أن تتحقق).
export const and = (...filters: readonly (Filter | FilterGroup)[]): FilterGroup => ({
  combinator: 'and',
  filters,
});

// يبني مجموعة "أو" (يكفي تحقق شرط واحد).
export const or = (...filters: readonly (Filter | FilterGroup)[]): FilterGroup => ({
  combinator: 'or',
  filters,
});

// يقرأ قيمة حقل من كائن بدعم المسارات المتداخلة (مثل "price.amount").
export const readField = (record: unknown, path: string): unknown => {
  // نبدأ من الكائن الجذر.
  let current: unknown = record;
  // نمرّ على أجزاء المسار المفصولة بنقطة.
  for (const segment of path.split('.')) {
    // أي جزء وسيط غير كائن يعني عدم وجود القيمة.
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    // ننزل مستوى واحدًا في الشجرة.
    current = (current as Record<string, unknown>)[segment];
  }
  // القيمة النهائية عند نهاية المسار.
  return current;
};

// يطبّع القيم النصية للمقارنة (حالة أحرف موحّدة + إزالة الفراغات الطرفية).
const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

// يحوّل قيمة لرقم قابل للمقارنة (يدعم التواريخ النصية أيضًا).
const toComparable = (value: unknown): number => {
  // الأرقام تُستخدم كما هي.
  if (typeof value === 'number') return value;
  // القيم المنطقية تُحوَّل إلى 1/0.
  if (typeof value === 'boolean') return value ? 1 : 0;
  // النصوص: نحاول رقمًا ثم تاريخًا.
  if (typeof value === 'string') {
    // محاولة تفسير النص كرقم.
    const asNumber = Number(value);
    // رقم صالح → نستخدمه.
    if (!Number.isNaN(asNumber) && value.trim() !== '') return asNumber;
    // وإلا نحاول تفسيره كتاريخ.
    const asDate = new Date(value).getTime();
    // تاريخ صالح → نستخدم طابعه الرقمي.
    if (!Number.isNaN(asDate)) return asDate;
  }
  // قيمة غير قابلة للمقارنة الرقمية.
  return Number.NaN;
};

/**
 * يقيّم شرط فلترة واحدًا على سجل.
 * دالة نقية تمامًا: نفس المدخلات تعطي نفس النتيجة دائمًا.
 */
export const evaluateFilter = (record: unknown, condition: Filter): boolean => {
  // القيمة الفعلية من السجل.
  const actual = readField(record, condition.field);
  // القيمة المتوقعة من الشرط.
  const expected = condition.value;
  // نفرّع حسب المعامل.
  switch (condition.operator) {
    // المساواة النصية المطبّعة (تعمل مع المعرّفات والأكواد).
    case 'equals':
      return normalize(actual) === normalize(expected);
    // النفي المباشر للمساواة.
    case 'notEquals':
      return normalize(actual) !== normalize(expected);
    // الاحتواء النصي.
    case 'contains':
      return normalize(actual).includes(normalize(expected));
    // البداية بنص.
    case 'startsWith':
      return normalize(actual).startsWith(normalize(expected));
    // النهاية بنص.
    case 'endsWith':
      return normalize(actual).endsWith(normalize(expected));
    // أكبر من (رقمي/زمني).
    case 'greaterThan':
      return toComparable(actual) > toComparable(expected);
    // أكبر أو يساوي.
    case 'greaterOrEqual':
      return toComparable(actual) >= toComparable(expected);
    // أصغر من.
    case 'lessThan':
      return toComparable(actual) < toComparable(expected);
    // أصغر أو يساوي.
    case 'lessOrEqual':
      return toComparable(actual) <= toComparable(expected);
    // بين قيمتين: القيمة المتوقعة مصفوفة من عنصرين [الأدنى، الأعلى].
    case 'between': {
      // نتأكد أن القيمة المتوقعة زوج صالح.
      if (!Array.isArray(expected) || expected.length !== 2) return false;
      // القيمة الفعلية كرقم قابل للمقارنة.
      const target = toComparable(actual);
      // الحدّان الأدنى والأعلى.
      const low = toComparable(expected[0]);
      const high = toComparable(expected[1]);
      // شامل الطرفين.
      return target >= low && target <= high;
    }
    // ضمن قائمة.
    case 'in':
      return Array.isArray(expected) && expected.some((item) => normalize(item) === normalize(actual));
    // خارج قائمة.
    case 'notIn':
      return Array.isArray(expected) && !expected.some((item) => normalize(item) === normalize(actual));
    // القيمة غير موجودة.
    case 'isNull':
      return actual === null || actual === undefined || actual === '';
    // القيمة موجودة.
    case 'isNotNull':
      return actual !== null && actual !== undefined && actual !== '';
    // معامل غير معروف: نرفض بدل السماح الصامت (Fail-Closed).
    default:
      return false;
  }
};

// يقيّم مجموعة فلاتر (وشروطها المتداخلة) على سجل.
export const evaluateFilterGroup = (record: unknown, group: FilterGroup): boolean => {
  // مجموعة فارغة لا تقيّد شيئًا (تُطابق الكل).
  if (group.filters.length === 0) return true;
  // دالة تقييم عنصر واحد (شرط أو مجموعة فرعية).
  const evaluateOne = (item: Filter | FilterGroup): boolean =>
    isFilterGroup(item) ? evaluateFilterGroup(record, item) : evaluateFilter(record, item);
  // "و" تتطلب تحقق الجميع؛ "أو" يكفيها واحد.
  return group.combinator === 'and' ? group.filters.every(evaluateOne) : group.filters.some(evaluateOne);
};

/**
 * يطبّق فلاتر على مصفوفة محمّلة محليًا.
 * التنفيذ البعيد سيترجم نفس بنية الفلاتر إلى استعلام خادم لاحقًا.
 */
export const applyFilters = <T>(items: readonly T[], filters?: FilterGroup | readonly Filter[]): T[] => {
  // بلا فلاتر → نسخة من القائمة كما هي.
  if (!filters) return [...items];
  // مصفوفة شروط بسيطة تُغلَّف كمجموعة "و".
  const group: FilterGroup = Array.isArray(filters) ? and(...filters) : (filters as FilterGroup);
  // نُبقي العناصر المطابقة فقط.
  return items.filter((item) => evaluateFilterGroup(item, group));
};
