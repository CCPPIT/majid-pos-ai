# دليل ترحيل العقود (Migration Guide) — PHASE 32

هذا الدليل يشرح كيف تتطوّر عقود ماجد SDK بأمان دون كسر المستهلكين أو
البيانات المخزّنة أو الأوامر غير المتصلة.

## قاعدة ذهبية

لا تغيّر عقدًا مستقرًا في مكانه. اتبع:

```
1) حدّد الأثر (Identify impact)
2) صنّف التغيير (Classify): إضافة اختيارية = MINOR · كسر = MAJOR
3) افحص التوافق (Compatibility)
4) ارفع النسخة (Version)
5) أنشئ ترحيلًا (Migration)
6) حدّث الاختبارات (Tests) — ومنها العقود الذهبية
7) حدّث الوثائق (Docs)
8) حدّث سجل التغييرات (Changelog)
```

## مثال مرجعي: Sale V1 → V2

### الشكل القديم (V1.0.0)

```ts
// الإجمالي رقم خام والعملة حقل منفصل.
type SaleV1 = {
  id: string;
  saleNumber: string;
  totalAmount: number;  // مهجور
  currency: string;
  customerName?: string;
};
```

### الشكل الجديد (V2.0.0)

```ts
// الإجمالي كائن Money منظم، وأضيف حقل اختياري customerNote.
type SaleV2 = {
  id: string;
  saleNumber: string;
  total: { amount: number; currency: string };
  customerName?: string;
  customerNote?: string;   // إضافة اختيارية = متوافقة
};
```

تحويل `totalAmount` (number) إلى `total` (Money) **كسر**، لذا رُفع
الرقم الرئيسي إلى `2.0.0` ووُفّر مسار ترحيل.

### الترحيل الحتمي

```ts
import { migrateSaleV1ToV2 } from '@/contracts/sales/sale.contract';

const v2 = migrateSaleV1ToV2(saleV1);
// نفس المدخل ينتج نفس المخرج دائمًا (deterministic).
```

أو عبر محرّك الترحيل المسجّل (يُستخدم تلقائيًا عند قراءة بيانات قديمة):

```ts
const result = sdk.contracts.migrate<SaleV2>(
  '@majid/contracts/sales/Sale',
  rawDataFromStorage,
  '1.0.0',  // النسخة المخزّنة
  '2.0.0',  // النسخة الحالية
);
if (!result.ok) {
  // result.errorCode = CONTRACT_MIGRATION_NOT_FOUND | CONTRACT_MIGRATION_FAILED
}
```

## تسجيل خطوة ترحيل جديدة

```ts
import { registerMigration } from '@/contracts/core';

registerMigration({
  contractName: '@majid/contracts/payments/Payment',
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  up: (v2) => ({ ...v2, /* تحويل الحقول */ }),
});
```

المحرّك يركّب السلاسل تلقائيًا (V1→V2→V3) ويفشل بوضوح إن انقطع المسار.

## تطوّر التعدادات (Enums)

- إضافة قيمة (مثل `wallet` لطرق الدفع) = **متوافق** (MINOR).
- حذف قيمة = **كاسر** (MAJOR).
- القيم المجهولة القادمة من مستقبل/مزوّد آخر لا تكسر القرّاء: المخطط
  يقبل النص ويُستخدم `isKnownPaymentMethod` للتفريق.

## تطوّر الحقول

- إضافة حقل **اختياري** (`customerNote?`) = متوافق.
- إضافة حقل **إلزامي** = كاسر (يلزم ترحيل/قيمة افتراضية).
- تحويل اختياري → إلزامي = كاسر.
- حذف/إعادة تسمية/تغيير نوع حقل = كاسر.

## الأوامر غير المتصلة

الأمر غير المتصل يحمل `commandVersion`. عند تنفيذ أمر قديم بعد ترقية:

```
Old Command ← Migration ← Current Command ← Execution
```

لا تُحذف الأوامر القديمة من الطابور دون مسار ترحيل (قسم 41).

## الأحداث

لا تُغيّر حمولة حدث مباشرة. أنشئ `SaleCompleted.v2` وسجّل **Upcaster**
يرفع الحمولة القديمة قبل تسليمها للمستهلك (قسم 34).

## الإهمال والإزالة

```
Active ↓ Deprecated ↓ Migration Window ↓ Removal Planned ↓ Removed (في MAJOR)
```

كل إهمال يحدد: `deprecatedSince` · `removeAfter` · `replacement` ·
`migrationGuide`. لا إهمال بلا بديل.
