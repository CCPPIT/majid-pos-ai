/**
 * نظام الإهمال (Deprecation) — PHASE 32 · أقسام 19 و20 و70.
 *
 * لا يُحذف أي API علني مباشرة. دورة الحياة:
 *   Active ↓ Deprecated ↓ Migration Window ↓ Removal Planned ↓ Removed (في MAJOR)
 *
 * كل عنصر مهجور يحمل: منذ أي نسخة · يُزال بعد أي نسخة · البديل · دليل
 * الترحيل. الاستخدام لا يكسر التطبيق، لكن يُسجَّل للتتبّع (قسم 70).
 */
import { ERROR_CODES } from '../errors/error-codes';

// مراحل دورة حياة العقد/الحقل/الأسلوب — قسم 20.
export type DeprecationLifecycle =
  | 'active' // نشط ومدعوم.
  | 'deprecated' // مهجور: يعمل لكن عليه تحذير.
  | 'migration_window' // نافذة ترحيل مفتوحة.
  | 'removal_planned' // الإزالة مجدولة في MAJOR قادم.
  | 'removed'; // أُزيل (محفوظ للتوثيق التاريخي).

// وصف عنصر مهجور (حقل/أسلوب/نسخة/عقد كامل).
export interface DeprecationNotice {
  readonly kind: 'contract' | 'field' | 'method' | 'version' | 'enum_value'; // نوع العنصر.
  readonly owner: string; // العقد/المجال المالك.
  readonly target: string; // اسم العنصر المهجور.
  readonly deprecatedSince: string; // النسخة التي هُجر منذها (قسم 19).
  readonly removeAfter: string; // النسخة التي يُزال بعدها (قسم 19).
  readonly replacement?: string; // البديل المقترح (إلزامي عمليًا — جودة).
  readonly migrationGuide?: string; // دليل/رابط الترحيل.
  readonly lifecycle: DeprecationLifecycle; // المرحلة الحالية.
  readonly message?: string; // رسالة موجهة للمستهلك.
}

// سجلّ مركزي للإهمالات (يُملأ عند تعريف العقود).
class DeprecationRegistry {
  // الخريطة الداخلية: مفتاح فريد owner:target ← الإشعار.
  private readonly notices = new Map<string, DeprecationNotice>();
  // مُستقبِل أحداث الاستخدام المهجور (تتبّع/قياس — قسم 70).
  private telemetry: (usage: DeprecatedUsage) => void = () => {};

  // يسجّل إهمالًا جديدًا ويتحقق من اكتمال بياناته.
  deprecate(notice: DeprecationNotice): void {
    // قاعدة الجودة: لا إهمال بلا بديل (إلا لنسخة كاملة يحددها العقد البديل).
    if (!notice.replacement && notice.kind !== 'version') {
      throw new Error(`[contracts] إهمال ${notice.owner}.${notice.target} بلا بديل (قسم 19)`);
    }
    // المفتاح الفريد يجمع المالك والعنصر.
    this.notices.set(`${notice.owner}:${notice.target}`, Object.freeze({ ...notice }));
  }

  // يجلب إشعار إهمال لعنصر إن وُجد.
  lookup(owner: string, target: string): DeprecationNotice | undefined {
    return this.notices.get(`${owner}:${target}`);
  }

  // كل الإشعارات المسجّلة.
  all(): readonly DeprecationNotice[] {
    return Object.freeze([...this.notices.values()]);
  }

  // كل الإشعارات المقرّر إزالتها قبل/عند نسخة معيّنة (لبوابة الجودة).
  removalsDueBy(version: string): readonly DeprecationNotice[] {
    return this.all().filter((n) => compareLoose(n.removeAfter, version) <= 0);
  }

  // يعيّن مستمع تتبّع الاستخدام المهجور (قسم 70).
  onDeprecatedUsage(handler: (usage: DeprecatedUsage) => void): void {
    this.telemetry = handler;
  }

  /**
   * يُستدعى عند استهلاك عنصر مهجور: لا يكسر، بل يُعلم ويُسجّل.
   * يُعيد الإشعار ليعرضه المستهلك في التطوير/السجلات.
   */
  reportUsage(owner: string, target: string, caller?: string): DeprecationNotice | undefined {
    const notice = this.lookup(owner, target);
    // غير مهجور → لا شيء.
    if (!notice) return undefined;
    // نمرّر حدث الاستخدام للتتبّع (بلا بيانات حساسة — قسم 65).
    this.telemetry(
      Object.freeze({
        code: ERROR_CODES.CONTRACT_DEPRECATED_USED,
        owner,
        target,
        currentVersion: notice.deprecatedSince,
        suggestedReplacement: notice.replacement,
        caller,
      }),
    );
    // نعيد الإشعار ليحذّر المستهلك.
    return notice;
  }
}

// حدث تتبّع استخدام عنصر مهجور — قسم 70.
export interface DeprecatedUsage {
  readonly code: typeof ERROR_CODES.CONTRACT_DEPRECATED_USED; // كود ثابت.
  readonly owner: string; // المالك.
  readonly target: string; // العنصر.
  readonly currentVersion: string; // النسخة الحالية.
  readonly suggestedReplacement?: string; // البديل.
  readonly caller?: string; // المستدعي (اختياري، للتطوير).
}

// مقارنة نصّية فضفاضة للنسخ في سجلّ الإهمال (تقبل v1 و1.0.0).
const compareLoose = (a: string, b: string): number => {
  // نطبّع كلا الطرفين بإزالة حرف v البادئ وإكمال .0.
  const norm = (v: string) => v.replace(/^v/i, '').split('.').map(Number);
  const [aa, bb] = [norm(a), norm(b)];
  for (let i = 0; i < 3; i += 1) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// النسخة المشتركة لسجلّ الإهمال.
export const deprecationRegistry = new DeprecationRegistry();
