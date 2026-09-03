/**
 * محرّك ترحيل العقود (Migration Engine) — PHASE 32 · أقسام 17 و21 و39 و41.
 *
 * العقود لا تتغيّر فجأة (price: number → price: Money). بدل الكسر يُسجَّل
 * مسار ترحيل: Old Contract ← Adapter ← New Contract. المحرّك:
 *   • يدقّق خطوة ترحيل (V1→V2, V2→V3) لكل عقد.
 *   • يركّب سلسلة خطوات للقفز بين نسختين.
 *   • يطبّق الترحيل على بيانات قديمة (استجابة API · تخزين محلي · أمر غير متصل).
 *
 * الترحيل حتمي (deterministic): نفس المدخل ينتج نفس المخرج (قسم 78).
 */

// خطوة ترحيل من نسخة إلى التي تليها مباشرة.
export interface MigrationStep<TFrom = unknown, TTo = unknown> {
  readonly contractName: string; // اسم العقد.
  readonly fromVersion: string; // نسخة المصدر.
  readonly toVersion: string; // نسخة الهدف.
  // دالة التحويل الخالصة (لا آثار جانبية، لا اعتماد على حالة خارجية).
  readonly up: (input: TFrom) => TTo;
}

// مسار ترحيل مُركَّب من عدة خطوات.
interface RegisteredMigration {
  readonly contractName: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly up: (input: unknown) => unknown;
}

// نتيجة محاولة ترحيل.
export interface MigrationResult<T> {
  readonly ok: boolean; // هل نجح؟
  readonly value?: T; // القيمة بعد الترحيل (عند النجاح).
  readonly fromVersion?: string; // النسخة المصدر.
  readonly toVersion?: string; // النسخة الهدف.
  readonly errorCode?: string; // كود الخطأ عند الفشل (CONTRACT_MIGRATION_*).
  readonly reason?: string; // سبب الفشل.
}

/**
 * سجلّ خطوات الترحيل + المشغّل.
 * كل خطوة تُسجَّل مرة واحدة بمفتاح (العقد · المصدر · الهدف).
 */
export class MigrationRegistry {
  private readonly steps = new Map<string, RegisteredMigration>();

  // مفتاح الخريطة.
  private key(name: string, from: string, to: string): string {
    return `${name}@${from}->${to}`;
  }

  // يسجّل خطوة ترحيل واحدة.
  register<TFrom, TTo>(step: MigrationStep<TFrom, TTo>): void {
    this.steps.set(this.key(step.contractName, step.fromVersion, step.toVersion), {
      contractName: step.contractName,
      fromVersion: step.fromVersion,
      toVersion: step.toVersion,
      up: step.up as (input: unknown) => unknown,
    });
  }

  // يبني سلسلة الخطوات للترحيل من نسخة إلى أخرى (قفزات متتالية).
  private plan(name: string, from: string, to: string): RegisteredMigration[] | null {
    // نسختان متطابقتان: لا ترحيل.
    if (from === to) return [];
    const chain: RegisteredMigration[] = [];
    let current = from;
    // نحاول السير عبر الخطوات المسجّلة (حماية من الحلقات بعدد محاولات).
    for (let guard = 0; guard < 100; guard += 1) {
      // نبحث عن خطوة تبدأ من النسخة الحالية.
      const step = [...this.steps.values()].find(
        (s) => s.contractName === name && s.fromVersion === current,
      );
      // لا خطوة → مسار مقطوع.
      if (!step) return null;
      chain.push(step);
      current = step.toVersion;
      // وصلنا للنسخة الهدف.
      if (current === to) return chain;
    }
    // تجاوز حدّ الحماية → حلقة لا نهائية محتملة.
    return null;
  }

  // هل يوجد مسار ترحيل بين النسختين؟ (يفيد في التوافق واختبارات الجودة).
  hasPath(name: string, from: string, to: string): boolean {
    return this.plan(name, from, to) !== null;
  }

  /**
   * يرحّل بيانات عقد من نسخة إلى أخرى — قسم 21.
   * يُعيد نتيجة موصّفة بدل الرمي (تُغلَّف في Result عند الحدود).
   */
  migrate<T>(name: string, data: unknown, fromVersion: string, toVersion: string): MigrationResult<T> {
    // نفس النسخة: نُعيد البيانات كما هي.
    if (fromVersion === toVersion) {
      return { ok: true, value: data as T, fromVersion, toVersion };
    }
    // نبني خطة الترحيل.
    const chain = this.plan(name, fromVersion, toVersion);
    // لا مسار معروف.
    if (chain === null) {
      return {
        ok: false,
        fromVersion,
        toVersion,
        errorCode: 'CONTRACT_MIGRATION_NOT_FOUND',
        reason: `لا مسار ترحيل للعقد ${name} من ${fromVersion} إلى ${toVersion}`,
      };
    }
    // نطبّق الخطوات بالتسلسل مع التقاط أي فشل.
    try {
      const migrated = chain.reduce<unknown>((acc, step) => step.up(acc), data);
      return { ok: true, value: migrated as T, fromVersion, toVersion };
    } catch (cause) {
      return {
        ok: false,
        fromVersion,
        toVersion,
        errorCode: 'CONTRACT_MIGRATION_FAILED',
        reason: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }
}

// النسخة المشتركة لسجلّ الترحيل.
export const migrationRegistry = new MigrationRegistry();

/**
 * دالة مساعدة لتسجيل خطوة ترحيل بسهولة عند تعريف العقود.
 * مثال: registerMigration('@…/Sale', '1.0.0', '2.0.0', (v1) => ({…v1, …}))
 */
export const registerMigration = <TFrom, TTo>(step: MigrationStep<TFrom, TTo>): void => {
  migrationRegistry.register(step);
};

// يرحّل ويرمي نتيجة خام (تستخدمه المحوّلات/الطبقات التي تفضّل Result).
export const migrateContract = <T>(
  name: string,
  data: unknown,
  fromVersion: string,
  toVersion: string,
): MigrationResult<T> => migrationRegistry.migrate<T>(name, data, fromVersion, toVersion);
