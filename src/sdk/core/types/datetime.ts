/**
 * عقود التاريخ والوقت — PHASE 31 · قسم 49.
 * ممنوع استخدام Date بشكل عشوائي في كل مجال: كل لحظة تُمثَّل نصًّا بصيغة
 * ISO 8601، وكل نطاق زمني يُمثَّل بـDateRange. المنطقة الزمنية تُحمل في
 * السياق (SDKContext) استعدادًا لدعم Multi-Timezone في مرحلة لاحقة.
 */
import { ValidationError } from '../errors/sdk-error';
import { failure, success, type Result } from '../result/result';

// لحظة زمنية بصيغة ISO 8601 (مثال: 2026-09-03T10:30:00.000Z).
export type ISODateTime = string;

// تاريخ فقط بصيغة YYYY-MM-DD (مفتاح تجميع يومي مستقر).
export type ISODate = string;

// معرّف منطقة زمنية بصيغة IANA (مثال: Asia/Aden). الافتراضي UTC حتى PHASE لاحقة.
export type TimeZoneId = string;

// طابع زمني بالمللي ثانية منذ عصر يونكس (للفرز السريع فقط).
export type Timestamp = number;

// نطاق زمني مغلق الطرفين اختياريًا (غياب الطرف = بلا حد).
export interface DateRange {
  readonly from?: ISODateTime; // بداية النطاق (شاملة).
  readonly to?: ISODateTime; // نهاية النطاق (شاملة).
}

// فترات جاهزة شائعة في التقارير والتحليلات.
export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all';

// منفذ الساعة: يسمح بحقن وقت ثابت في الاختبارات بدل Date.now العشوائي.
export interface Clock {
  // اللحظة الحالية بصيغة ISO.
  now(): ISODateTime;
  // اللحظة الحالية بالمللي ثانية.
  timestamp(): Timestamp;
}

// ساعة النظام الحقيقية (التنفيذ الافتراضي في الإنتاج).
export const systemClock: Clock = {
  // نستخدم توقيت UTC دائمًا لتفادي اختلاف الأجهزة.
  now: () => new Date().toISOString(),
  // الطابع الرقمي المقابل للحظة نفسها.
  timestamp: () => Date.now(),
};

// ساعة ثابتة للاختبارات: تُعيد نفس اللحظة في كل استدعاء.
export const fixedClock = (iso: ISODateTime): Clock => ({
  // اللحظة الثابتة كما مُرّرت.
  now: () => iso,
  // الطابع الرقمي المشتق منها.
  timestamp: () => new Date(iso).getTime(),
});

// هل النص لحظة ISO صالحة؟ (حارس نوع يمنع تسرّب نصوص فاسدة للمجال).
export const isISODateTime = (value: unknown): value is ISODateTime => {
  // يجب أن يكون نصًّا أصلًا.
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  // نحاول تحليله كتاريخ.
  const parsed = new Date(value);
  // تاريخ غير صالح يُنتج NaN عند getTime.
  return !Number.isNaN(parsed.getTime());
};

// يتحقق من لحظة ISO ويُعيد Result بدل الرمي.
export const parseISODateTime = (value: string): Result<ISODateTime> =>
  // النص الصالح يمر كما هو؛ غير الصالح يُعيد خطأ تحقّق بحقل واضح.
  isISODateTime(value)
    ? success(value)
    : failure(new ValidationError('sdk.error.invalidDateTime', { value: 'sdk.validation.isoDateTime' }));

// يستخرج مفتاح اليوم (YYYY-MM-DD) من لحظة ISO — أساس التجميع اليومي.
export const toDateKey = (value: ISODateTime): ISODate => value.slice(0, 10);

// يبني نطاقًا زمنيًا من لحظتين مع التحقق أن البداية قبل النهاية.
export const makeDateRange = (from?: ISODateTime, to?: ISODateTime): Result<DateRange> => {
  // بداية موجودة لكنها غير صالحة → خطأ.
  if (from !== undefined && !isISODateTime(from)) {
    return failure(new ValidationError('sdk.error.invalidDateTime', { from: 'sdk.validation.isoDateTime' }));
  }
  // نهاية موجودة لكنها غير صالحة → خطأ.
  if (to !== undefined && !isISODateTime(to)) {
    return failure(new ValidationError('sdk.error.invalidDateTime', { to: 'sdk.validation.isoDateTime' }));
  }
  // ترتيب مقلوب (البداية بعد النهاية) خرق منطقي صريح.
  if (from !== undefined && to !== undefined && new Date(from).getTime() > new Date(to).getTime()) {
    return failure(new ValidationError('sdk.error.invalidDateRange', { from: 'sdk.validation.rangeOrder' }));
  }
  // النطاق صالح.
  return success({ from, to });
};

// هل اللحظة تقع داخل النطاق؟ (غياب الحد يعني عدم تقييده).
export const isWithinRange = (value: ISODateTime, range: DateRange): boolean => {
  // نحوّل اللحظة لرقم للمقارنة.
  const time = new Date(value).getTime();
  // لحظة غير صالحة لا تقع في أي نطاق.
  if (Number.isNaN(time)) return false;
  // حد أدنى موجود ويتجاوزه العنصر للأسفل → خارج النطاق.
  if (range.from !== undefined && time < new Date(range.from).getTime()) return false;
  // حد أعلى موجود ويتجاوزه العنصر للأعلى → خارج النطاق.
  if (range.to !== undefined && time > new Date(range.to).getTime()) return false;
  // ضمن الحدود.
  return true;
};

/**
 * يحوّل فترة جاهزة إلى نطاق زمني فعلي اعتمادًا على ساعة محقونة.
 * الحساب يتم على أساس اليوم المحلي للجهاز، وسيصبح واعيًا بالمنطقة الزمنية
 * في مرحلة Multi-Timezone دون تغيير هذا العقد.
 */
export const resolvePreset = (preset: DateRangePreset, clock: Clock = systemClock): DateRange => {
  // اللحظة المرجعية الحالية.
  const now = new Date(clock.now());
  // نسخة تمثل بداية اليوم الحالي (منتصف الليل).
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // دالة مساعدة تحوّل تاريخًا إلى ISO.
  const iso = (date: Date): ISODateTime => date.toISOString();
  // نفرّع حسب الفترة المطلوبة.
  switch (preset) {
    // اليوم: من منتصف ليل اليوم حتى اللحظة الحالية.
    case 'today':
      return { from: iso(startOfToday), to: iso(now) };
    // الأمس: يوم كامل سابق.
    case 'yesterday': {
      // بداية الأمس = بداية اليوم ناقص يوم واحد.
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      // نهاية الأمس = لحظة قبل بداية اليوم.
      return { from: iso(startOfYesterday), to: iso(new Date(startOfToday.getTime() - 1)) };
    }
    // الأسبوع: آخر سبعة أيام حتى الآن.
    case 'week':
      return { from: iso(new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)), to: iso(now) };
    // الشهر: من أول الشهر الحالي.
    case 'month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    // الربع: من بداية الربع الحالي (ثلاثة أشهر).
    case 'quarter':
      return { from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: iso(now) };
    // السنة: من أول يناير الحالي.
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    // الكل: بلا حدود زمنية.
    case 'all':
    default:
      return {};
  }
};
