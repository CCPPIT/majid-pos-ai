/**
 * الإصدار الدلالي (Semantic Versioning) — PHASE 32 · أقسام 07.
 *
 * القاعدة المعتمدة في كل عقود ماجد:
 *   MAJOR.MINOR.PATCH  — مثل: 1.0.0 · 1.1.0 · 1.1.1 · 2.0.0
 *
 *  • PATCH: إصلاح خلل بلا أي تغيير في العقد (1.0.0 ← 1.0.1).
 *  • MINOR: إضافة متوافقة خلفيًا (1.0.0 ← 1.1.0).
 *  • MAJOR: تغيير كاسر في العقد (1.0.0 ← 2.0.0).
 *
 * هذه الطبقة إطار-محايدة (Framework-Agnostic): لا React ولا RN ولا Zod —
 * أنواع ودوال خالصة فقط (قسم 76) حتى تستوردها العقود بأمان.
 */

// رقم إصدار دلالي مفكوك إلى أجزائه الثلاثة (كلها أعداد غير سالبة).
export interface SemVer {
  readonly major: number; // الرقم الرئيسي — يتغيّر عند أي كسر.
  readonly minor: number; // الرقم الثانوي — يتغيّر عند إضافة متوافقة.
  readonly patch: number; // رقم الإصلاح — يتغيّر عند إصلاح بلا تغيير عقد.
}

// نوع مستوى التغيير بين إصدارين (يستخدمه محرك التوافق والـDiff).
export type BumpKind = 'major' | 'minor' | 'patch' | 'none';

// نمط الصيغة القانونية: ثلاثة أعداد موجبة/صفرية مفصولة بنقاط.
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

// يفكّ نصّ الإصدار إلى أجزائه، ويرمي بخطأ واضح عند صيغة غير قانونية.
export const parseSemVer = (version: string): SemVer => {
  // نطابق الصيغة على النص بعد إزالة فراغات الأطراف.
  const match = SEMVER_PATTERN.exec(version.trim());
  // لا تطابق → الصيغة غير قانونية ويجب أن يفشل التسجيل بوضوح.
  if (!match) {
    throw new Error(`[contracts] إصدار دلالي غير قانوني: "${version}" (الصيغة المتوقعة X.Y.Z)`);
  }
  // نعيد الأجزاء الثلاثة كأعداد.
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
};

// يحاول فكّ الإصدار ويعيد null بدل الرمي (للاستخدام مع مدخلات خارجية).
export const tryParseSemVer = (version: string): SemVer | null => {
  // نلتغلّب على الرمي من parseSemVer ونحوّله إلى قيمة فارغة.
  try {
    return parseSemVer(version);
  } catch {
    return null;
  }
};

// يفحص هل النص صيغة إصدار دلالي قانونية (حارس للتحقق وقت التشغيل).
export const isSemVer = (version: string): boolean => tryParseSemVer(version) !== null;

// يحوّل الإصدار المفكوك إلى نصّه القانوني.
export const formatSemVer = (version: SemVer): string =>
  // نلصق الأرقام الثلاثة بنقاط.
  `${version.major}.${version.minor}.${version.patch}`;

// يقارن إصدارين: سالب إن كان a أقدم، صفر عند التطابق، موجب إن كان a أحدث.
export const compareSemVer = (a: string, b: string): number => {
  // نفكّ الطرفين.
  const left = parseSemVer(a);
  const right = parseSemVer(b);
  // نقارن الرئيسي أولًا.
  if (left.major !== right.major) return left.major - right.major;
  // ثم الثانوي.
  if (left.minor !== right.minor) return left.minor - right.minor;
  // ثم الإصلاح.
  return left.patch - right.patch;
};

// حارس: هل الإصداران متساويان تمامًا؟
export const semVerEquals = (a: string, b: string): boolean => compareSemVer(a, b) === 0;

// حارس: هل الإصدار a أحدث من b؟
export const semVerGreaterThan = (a: string, b: string): boolean => compareSemVer(a, b) > 0;

// حارس: هل الإصدار a أقدم من أو يساوي b؟
export const semVerLessThanOrEqual = (a: string, b: string): boolean => compareSemVer(a, b) <= 0;

/**
 * يحدّد نوع القفزة بين إصدارين (لاختبارات بوابة الجودة — قسم 52).
 * يُستخدم للتأكد أن أي تغيير كاسر رافقه رفع MAJOR.
 */
export const bumpKind = (from: string, to: string): BumpKind => {
  // تطابق تام → لا قفزة.
  if (semVerEquals(from, to)) return 'none';
  // نفكّ الطرفين لقراءة الأجزاء.
  const older = parseSemVer(from);
  const newer = parseSemVer(to);
  // اختلاف الرقم الرئيسي → قفزة كاسرة.
  if (older.major !== newer.major) return 'major';
  // اختلاف الثانوي مع ثبات الرئيسي → قفزة متوافقة.
  if (older.minor !== newer.minor) return 'minor';
  // عدا ذلك تغيّر رقم الإصلاح فقط.
  return 'patch';
};

/**
 * قاعدة التوافق الدلالي للإصدارات المنتِجة (Provider):
 * الإصدار المنتِج `current` متوافق مع المستهلِك الذي يطلب `required`
 * عندما يتشاركان نفس الرقم الرئيسي ويكون المنتِج أحدث أو مساويًا.
 * مثال: مُنتِج 1.5.0 يخدم مستهلِكًا يتوقع 1.2.0، ولا يخدم من يتوقع 2.0.0.
 */
export const isSemVerCompatible = (required: string, current: string): boolean => {
  // نفكّ الطرفين.
  const needed = parseSemVer(required);
  const actual = parseSemVer(current);
  // اختلاف الرقم الرئيسي كسر لا يمكن تجسيره.
  if (needed.major !== actual.major) return false;
  // ضمن نفس الرئيسي: المنتِج يجب ألا يكون أقدم مما طلبه المستهلِك.
  return compareSemVer(current, required) >= 0;
};

// هل الإصدار target يقع ضمن المجال [min, max]؟ (لقسم 13 — النسخ المدعومة).
export const isWithinRange = (target: string, min: string, max: string): boolean =>
  // يجب ألا يكون أقدم من الحد الأدنى ولا أحدث من الحد الأقصى.
  compareSemVer(target, min) >= 0 && compareSemVer(target, max) <= 0;
