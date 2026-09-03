# AGENTS.md — قواعد التنفيذ الهندسي (MAJID POS AI)

## التقنية — قواعد صارمة

- React Native + Expo + Expo Router + TypeScript فقط.
- **ممنوع:** Next.js · React Web · HTML · CSS Web · Tailwind Web · Web Dashboard ·
  Admin Web Panel · Electron · PWA · Backend/Microservices/Docker/K8s داخل تطبيق الموبايل.
- كل التنقل عبر Expo Router (`src/app`). لا React Navigation يدوي.
- TypeScript Strict — لا `any` دون سبب موثق.

## قبل تعديل أي ملف

1. افحص البنية الحالية (`Inspect`).
2. لا تحذف ملفًا يعمل · لا تُعد بناء مكوّن موجود · أعد استخدام المتاح.
3. اعمل داخل المرحلة الحالية فقط؛ المراحل التالية تُستدعى بأمر.

## معمارية

- اتجاه التبعية: `app → features → domain → data`؛ `core` لا يعتمد على شيء.
- الـ UI لا يلمس Storage ولا يحسب مالًا: Use Cases + Repositories + `core/money`.
- Data Layer اليوم Mock/Local عبر Repository interfaces — قابلة للاستبدال بـ API
  دون تغيير أي مكوّن شاشة.
- State مقسم حسب Domain تحت `src/store/*` — لا Global Store ضخم.
- التواصل بين السياقات عبر `appEventBus` فقط.

## الجودة — كل Feature يجب أن يكون

Type-safe · Responsive · RTL · Dark/Light · Accessible (labels · touch targets ·
contrast · dynamic font · reduced motion) · Loading · Error · Empty · Offline ·
Retry · Permission-aware · Reusable · Tested.

## الأمان

- الحساسات: session/PIN/biometric في Secure Storage.
- لا تُسجّل بيانات حسابة (الـ logger يعتّم تلقائيًا — استخدمه).
- فحص الصلاحية عند تنفيذ الإجراء، لا عند إخفاء الزر فقط.
- AI: Intent → Permission → Validation → Preview → Confirm → Action.

## الصدق الوظيفي

- لا أزرار/تنقل/حسابات/صلاحيات وهمية. غير المنفذ = Placeholder صريح.
- الحسابات حقيقية: Subtotal → Discount → Tax → Total → Payment → Change → Stock.
- كل Input مُتحقق منه (price · quantity · discount · tax · payment · forms).

## الفحوصات قبل التسليم

```bash
npm run typecheck   # tsc --noEmit — صفر أخطاء
npm test            # Jest — كل الاختبارات خضراء
npm run lint        # ESLint
```
