/**
 * سجلّ العقود (Contract Version Registry) — PHASE 32 · أقسام 12 و13.
 *
 * السجلّ مصدر الحقيقة لحالة كل عقد علني:
 *   الاسم · النسخة الحالية · المدى المدعوم · النسخ المهجورة · مسار الترحيل.
 * يُستخدم في: فحص التوافق، اكتشاف الكسر، اختبارات بوابة الجودة، وتوليد
 * التوثيق. السجلّ بيانات فقط — لا منطق أعمال فيه.
 */
import { compareSemVer, isSemVer, semVerGreaterThan } from './semver';
import type { StabilityLevel } from '../metadata/metadata';

// مدى النسخ المدعومة لعقد ما — قسم 13.
export interface VersionSupport {
  readonly current: string; // النسخة الحالية.
  readonly minimumSupported: string; // أقدم نسخة ما زالت تُقرأ (تُرحَّل للأحدث).
  readonly maximumSupported: string; // أحدث نسخة مدعومة (تساوي current غالبًا).
}

// معلومة تسجيل عقد علني واحد.
export interface RegisteredContract {
  readonly name: string; // الاسم الموحّد (@majid/contracts/<domain>/<Entity>).
  readonly domain: string; // المجال المالك.
  readonly kind: ContractKind; // نوع العقد.
  readonly support: VersionSupport; // مدى الدعم.
  readonly stability: StabilityLevel; // مستوى الاستقرار.
  readonly deprecatedVersions: readonly string[]; // النسخ المهجورة (قسم 19).
  readonly migrationsAvailable?: readonly string[]; // مسارات ترحيل متاحة (قسم 21).
  readonly replacedBy?: string; // اسم العقد البديل إن كان العقد كله مهجورًا.
}

// أنواع العقود القانونية في المنصّة (قسم 06).
export type ContractKind =
  | 'entity' // كيان مجال (Product · Sale…).
  | 'dto' // كائن نقل بيانات (قسم 38).
  | 'command' // أمر كتابة (قسم 31).
  | 'query' // استعلام قراءة (قسم 32).
  | 'event' // حدث مجال (قسم 33).
  | 'result' // نتيجة عملية.
  | 'error' // عقد خطأ (قسم 29).
  | 'contract' // عقد سياسة/بنية (صلاحيات/نطاق…).
  | 'repository' // واجهة مستودع (قسم 35).
  | 'provider' // واجهة مزوّد (قسم 36).
  | 'api'; // عقد واجهة برمجية (قسم 59).

// خيارات تسجيل عقد جديد.
export interface RegisterContractOptions {
  readonly name: string; // الاسم الموحّد.
  readonly domain: string; // المجال.
  readonly kind: ContractKind; // النوع.
  readonly current?: string; // النسخة الحالية (افتراضي 1.0.0).
  readonly minimumSupported?: string; // أقدم نسخة مدعومة (افتراضي = current).
  readonly stability?: StabilityLevel; // مستوى الاستقرار (افتراضي stable).
  readonly deprecatedVersions?: readonly string[]; // نسخ مهجورة.
  readonly migrationsAvailable?: readonly string[]; // مسارات ترحيل.
  readonly replacedBy?: string; // عقد بديل.
}

/**
 * سجلّ العقود: خريطة اسم العقد ← تعريفه.
 * الكائن قابل للإنشاء عدة مرات (لا حالة عامة متغيرة)، لكن المنصّة
 * تستخدم نسخة وحيدة مشتركة (contractRegistry) لتوحيد التسجيل.
 */
export class ContractVersionRegistry {
  // الخريطة الداخلية (لا تُمسّ من الخارج).
  private readonly contracts = new Map<string, RegisteredContract>();

  // يسجّل عقدًا واحدًا ويتحقق من سلامة أرقامه.
  register(options: RegisterContractOptions): RegisteredContract {
    // النسخة الحالية (1.0.0 إن لم تُحدَّد).
    const current = options.current ?? '1.0.0';
    // أقدم نسخة مدعومة (تساوي current إن لم تُحدَّد).
    const minimumSupported = options.minimumSupported ?? current;
    // نتحقق أن كل أرقام النسخ قانونية.
    if (![current, minimumSupported].every(isSemVer)) {
      throw new Error(`[contracts] أرقام نسخ غير قانونية للعقد ${options.name}`);
    }
    // الحد الأدنى يجب ألا يكون أحدث من الحالية.
    if (semVerGreaterThan(minimumSupported, current)) {
      throw new Error(`[contracts] الحد الأدنى المدعوم أحدث من الحالية للعقد ${options.name}`);
    }
    // نبني سجلّ العقد.
    const registered: RegisteredContract = Object.freeze({
      name: options.name,
      domain: options.domain,
      kind: options.kind,
      support: Object.freeze({ current, minimumSupported, maximumSupported: current }),
      stability: options.stability ?? 'stable',
      deprecatedVersions: Object.freeze([...(options.deprecatedVersions ?? [])]),
      migrationsAvailable: options.migrationsAvailable
        ? Object.freeze([...options.migrationsAvailable])
        : undefined,
      replacedBy: options.replacedBy,
    });
    // نحفظه في الخريطة.
    this.contracts.set(options.name, registered);
    // نعيد السجلّ المجمّد.
    return registered;
  }

  // يجلب عقدًا بالاسم (أو undefined إن لم يُسجَّل).
  get(name: string): RegisteredContract | undefined {
    return this.contracts.get(name);
  }

  // هل العقد مسجّل؟
  has(name: string): boolean {
    return this.contracts.has(name);
  }

  // كل العقود المسجّلة (مصفوفة غير قابلة للتعديل).
  all(): readonly RegisteredContract[] {
    return Object.freeze([...this.contracts.values()]);
  }

  // عقود مجال معيّن.
  byDomain(domain: string): readonly RegisteredContract[] {
    return this.all().filter((c) => c.domain === domain);
  }

  // كل النسخ المهجورة عبر السجلّ (للتقارير والاختبارات).
  deprecated(): readonly RegisteredContract[] {
    return this.all().filter(
      (c) => c.stability === 'deprecated' || c.deprecatedVersions.length > 0,
    );
  }

  /**
   * هل نسخة معيّنة من العقد مدعومة؟ — قسم 13.
   * نسخة أقدم من الحد الأدنى غير مدعومة (ولا مسار ترحيل معروف).
   */
  isSupported(name: string, version: string): boolean {
    // نجلب العقد.
    const contract = this.contracts.get(name);
    // غير مسجّل → غير مدعوم.
    if (!contract) return false;
    // نقارن بالمدى: يجب ألا تسبق الحد الأدنى ولا تتجاوز الحالية.
    return (
      compareSemVer(version, contract.support.minimumSupported) >= 0 &&
      compareSemVer(version, contract.support.maximumSupported) <= 0
    );
  }

  // هل النسخة المعيّنة مهجورة؟ — قسم 19.
  isDeprecated(name: string, version: string): boolean {
    const contract = this.contracts.get(name);
    return contract?.deprecatedVersions.includes(version) ?? false;
  }
}

// النسخة المشتركة الوحيدة للسجلّ عبر المنصّة.
export const contractRegistry = new ContractVersionRegistry();
