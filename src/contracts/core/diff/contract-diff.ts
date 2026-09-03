/**
 * فارق العقود (Contract Diff) — PHASE 32 · أقسام 16 و51.
 *
 * يقارن تعريفين لحقول عقد (نسخة A مقابل نسخة B) ويصنّف كل تغيير:
 *   • Added: حقل جديد (متوافق إن كان اختياريًا).
 *   • Removed: حقل محذوف (كاسر دائمًا).
 *   • TypeChanged: تغيّر نوع الحقل (كاسر غالبًا).
 *   • RequiredToggled: اختياري ← إلزامي (كاسر) أو العكس (متوافق).
 *   • EnumValueRemoved: قيمة تعداد محذوفة (كاسر — قسم 25).
 *
 * المخرجات تغذّي اختبار بوابة الجودة (قسم 52): أي تغيير كاسر بلا رفع
 * MAJOR يُفشل البناء.
 */

// وصف حقل في تعريف العقد (تمثيل مبسّط مقروء آليًا).
export interface FieldSpec {
  readonly name: string; // اسم الحقل.
  readonly type: string; // وصف النوع (number · string · Money · 'cash'|'card'…).
  readonly required: boolean; // هل هو إلزامي؟
  readonly enumValues?: readonly string[]; // قيم التعداد إن كان enum.
}

// تعريف عقد قابل للمقارنة (نسخة كاملة من حقوله).
export interface ContractShape {
  readonly name: string; // اسم العقد.
  readonly version: string; // نسخته.
  readonly fields: readonly FieldSpec[];
}

// نوع التغيير المُكتشَف.
export type DiffChangeKind =
  | 'field_added' // حقل أُضيف.
  | 'field_removed' // حقل حُذف.
  | 'type_changed' // تغيّر النوع.
  | 'became_required' // اختياري ← إلزامي (كاسر).
  | 'became_optional' // إلزامي ← اختياري (متوافق).
  | 'enum_value_added' // قيمة تعداد أُضيفت (متوافق).
  | 'enum_value_removed'; // قيمة تعداد حُذفت (كاسر).

// تغيير واحد بين النسختين.
export interface ContractChange {
  readonly kind: DiffChangeKind; // نوعه.
  readonly field: string; // الحقل المتأثر.
  readonly breaking: boolean; // هل هو كاسر؟
  readonly from?: string; // القيمة/الوصف القديم.
  readonly to?: string; // القيمة/الوصف الجديد.
}

// نتيجة المقارنة الكاملة.
export interface ContractDiff {
  readonly contractName: string; // العقد.
  readonly fromVersion: string; // النسخة القديمة.
  readonly toVersion: string; // النسخة الجديدة.
  readonly changes: readonly ContractChange[]; // كل التغييرات.
  readonly hasBreakingChanges: boolean; // أي كسر؟
  readonly breakingCount: number; // عدد الكسور.
}

// هل نوع التغيير كاسر؟ (قسم 16).
const BREAKING_KINDS: ReadonlySet<DiffChangeKind> = new Set<DiffChangeKind>([
  'field_removed', // حذف حقل يكسر المستهلكين القدامى.
  'type_changed', // تغيير النوع يكسر القرّاء.
  'became_required', // إلزامية حقل لم يكن إلزاميًا يكسر المنتِجين.
  'enum_value_removed', // حذف قيمة enum يكسر مستهلكيها.
]);

// يقارن نسختين من تعريف العقد ويُنتج الفارق.
export const diffContracts = (older: ContractShape, newer: ContractShape): ContractDiff => {
  // نفهرس الحقول بالاسم للوصول السريع.
  const oldFields = new Map(older.fields.map((f) => [f.name, f]));
  const newFields = new Map(newer.fields.map((f) => [f.name, f]));
  const changes: ContractChange[] = [];

  // (1) حقول أُضيفت أو تغيّرت.
  for (const field of newer.fields) {
    const old = oldFields.get(field.name);
    // حقل جديد تمامًا.
    if (!old) {
      // إضافة حقل إلزامي كاسر (قسم 27)؛ إضافة اختياري متوافق.
      changes.push({
        kind: 'field_added',
        field: field.name,
        breaking: field.required,
        to: field.type,
      });
      continue;
    }
    // تغيّر النوع.
    if (old.type !== field.type) {
      changes.push({
        kind: 'type_changed',
        field: field.name,
        breaking: true,
        from: old.type,
        to: field.type,
      });
    }
    // تغيّر حالة الإلزامية.
    if (old.required !== field.required) {
      changes.push({
        kind: field.required ? 'became_required' : 'became_optional',
        field: field.name,
        breaking: field.required, // اختياري→إلزامي كاسر؛ العكس متوافق.
        from: old.required ? 'required' : 'optional',
        to: field.required ? 'required' : 'optional',
      });
    }
    // تغيّرات التعداد (قسم 25).
    if (old.enumValues || field.enumValues) {
      const oldEnums = new Set(old.enumValues ?? []);
      const newEnums = new Set(field.enumValues ?? []);
      // قيمة أُضيفت (متوافق).
      for (const value of newEnums) {
        if (!oldEnums.has(value)) {
          changes.push({ kind: 'enum_value_added', field: field.name, breaking: false, to: value });
        }
      }
      // قيمة حُذفت (كاسر).
      for (const value of oldEnums) {
        if (!newEnums.has(value)) {
          changes.push({ kind: 'enum_value_removed', field: field.name, breaking: true, from: value });
        }
      }
    }
  }

  // (2) حقول حُذفت.
  for (const field of older.fields) {
    if (!newFields.has(field.name)) {
      changes.push({
        kind: 'field_removed',
        field: field.name,
        breaking: true,
        from: field.type,
      });
    }
  }

  // نحصي الكسور.
  const breakingCount = changes.filter((c) => BREAKING_KINDS.has(c.kind) && c.breaking).length;
  return Object.freeze({
    contractName: newer.name,
    fromVersion: older.version,
    toVersion: newer.version,
    changes: Object.freeze(changes),
    hasBreakingChanges: breakingCount > 0,
    breakingCount,
  });
};

/**
 * بوابة الجودة (قسم 52): يتحقق أن أي تغيير كاسر رافقه رفع الرقم الرئيسي.
 * يُعيد قائمة بمخالفات «كسر بلا MAJOR» (فارغة = البوابة ناجحة).
 */
export const assertVersionPolicy = (diff: ContractDiff): readonly string[] => {
  const violations: string[] = [];
  // لا كسور → السياسة محترمة.
  if (!diff.hasBreakingChanges) return violations;
  // نستخرج الرقم الرئيسي للنسختين.
  const oldMajor = Number(diff.fromVersion.split('.')[0]);
  const newMajor = Number(diff.toVersion.split('.')[0]);
  // كسر دون رفع رئيسي → مخالفة.
  if (newMajor <= oldMajor) {
    violations.push(
      `[contracts] ${diff.contractName}: تغيير كاسر (${diff.breakingCount}) من ${diff.fromVersion} ` +
        `إلى ${diff.toVersion} دون رفع MAJOR — يجب رفع الرقم الرئيسي أو إلغاء الكسر.`,
    );
  }
  return Object.freeze(violations);
};
