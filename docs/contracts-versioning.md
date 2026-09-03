# معمارية العقود والإصدارات — PHASE 32

طبقة العقود (`src/contracts/`) تحوّل ماجد SDK إلى منصّة عقود **مستقرة
مُنسَّخة متوافقة خلفيًا مدفوعة بالعقود** (Contract-Driven).

## التسلسل الهرمي

```
UI → Feature → Application → MAJID SDK → VERSIONED CONTRACTS → Domain → Repository → Data Source
```

اتجاه الاستيراد واحد: العقود **لا** تستورد من SDK أو UI أو Zustand
(إطار-محايدة — قسم 76). لا دورات استيراد (قسم 75).

## البنية

```
src/contracts/
├── core/                       # النواة المشتركة (إطار-محايدة)
│   ├── versioning/             # semver · versions · registry
│   ├── compatibility/          # مصفوفة التوافق وتفاوض النسخ
│   ├── deprecation/            # نظام الإهمال
│   ├── migration/              # محرّك الترحيل
│   ├── diff/                   # فارق العقود وبوابة الجودة
│   ├── metadata/               # بطاقات العقد والخصوصية والاستجابة
│   ├── validation/             # تحقق Zod وقت التشغيل
│   ├── errors/                 # أكواد الأخطاء المستقرة
│   ├── result/                 # نمط النتيجة على مستوى العقد
│   ├── events/                 # الأحداث المُنسَّخة + Upcaster
│   ├── offline/                # الأوامر غير المتصلة المُنسَّخة
│   ├── api/                    # عقود API أساسية (بلا خادم)
│   ├── capability/             # القدرات واكتشافها
│   └── primitives/             # المعرّفات الموسومة
├── products/  sales/  payments/  inventory/  customers/
├── cart/  pos/  auth/  rbac/  tenancy/  ai/
├── identity/ organization/ store/ procurement/ finance/
├── crm/ hr/ analytics/ notifications/
├── adapters/                   # محوّلات V1→V2
├── registry/                   # تسجيل كل العقود والإهمالات
└── index.ts                    # الحاجز العلني الوحيد (@/contracts)
```

## كل مجال يفصل

`Contract · Schema (Zod) · DTO · Command · Query · Result · Error ·
Event · Mapper` — والنسخة مستقلة لكل مجال (قسم 10).

## الإصدار الدلالي

| القفزة | المعنى | مثال |
|--------|--------|------|
| PATCH | إصلاح بلا تغيير عقد | 1.0.0 → 1.0.1 |
| MINOR | إضافة متوافقة (حقل اختياري/قيمة enum) | 1.0.0 → 1.1.0 |
| MAJOR | تغيير كاسر | 1.0.0 → 2.0.0 |

## ما الذي يُعدّ كسرًا (Breaking)

حذف حقل · تغيير نوع حقل · تحويل حقل إلى إلزامي · إضافة حقل إلزامي ·
حذف قيمة enum · حذف/تغيير توقيع أسلوب · تغيير عقد خطأ · تغيير بنية أمر.

بوابة الجودة (`assertVersionPolicy`) تفشل البناء إن وُجد كسر بلا رفع
الرقم الرئيسي (قسم 52).

## واجهة الـSDK

```ts
const sdk = createMajidSDK({ repositories, providers });

sdk.contracts.version();        // نسخ SDK/العقود/المجالات
sdk.contracts.registry;         // سجلّ العقود
sdk.contracts.compatible(a, b); // فحص التوافق
sdk.contracts.migrate(name, data, from, to); // الترحيل
sdk.capabilities.has('ai');     // اكتشاف القدرات (≠ الصلاحيات)
```

القدرة = ما يدعمه النظام. الصلاحية (RBAC) = ما يجوز للمستخدم.

## التعامل مع الأخطاء (قسم 77)

```ts
const result = await sdk.sales.create(command);
if (!result.success) {
  switch (result.error.code) {
    case 'PAYMENT_DECLINED': break;
    case 'INVENTORY_INSUFFICIENT_STOCK': break;
    default: break;
  }
}
```

التفرّع على `code` الثابت لا على الرسالة (قسم 30).

## بوابات الجودة (Definition of Done)

- كل عقد علني مُنسَّخ ومسجّل.
- كل كسر يرافقه رفع MAJOR + ترحيل + اختبار.
- كل إهمال له بديل وموعد إزالة.
- كل حمولة خارجية (API/تخزين/ذكاء) تمرّ بمخطط Zod.
- أكواد الأخطاء مستقرة.
- لا دورات استيراد ولا اعتماد العقود على أطر الواجهة.
```
