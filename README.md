# MAJID POS AI

> **AI-Native Smart POS + ERP + SaaS Mobile Platform**
> React Native · Expo · Expo Router · TypeScript
> يبدأ من السوق اليمني (عربي / RTL) — مصمم للتوسع عالميًا.

هذا **تطبيق موبايل حقيقي** (وليس Web App وليس Prototype). المنصة الوحيدة المستهدفة:

| Android | iOS | Web | Desktop |
| :-----: | :-: | :-: | :-----: |
|    ✅    |  ✅ (لاحقًا عبر Expo Go / EAS)  |  ❌ ممنوع |  ❌ ممنوع |

## التقنيات (القاعدة الإجبارية)

- **React Native** عبر **Expo (SDK 57)** — Managed Workflow
- **Expo Router** — التنقل الرسمي (File-based, Typed Routes)
- **TypeScript** — Strict Mode بالكامل
- لا يوجد Next.js / React Web / HTML / CSS Web / Tailwind Web / Electron / PWA / Backend داخل التطبيق.

## التشغيل

```bash
npm install        # تثبيت الاعتمادات
npm start          # تشغيل Expo Dev Server (امسح QR بتطبيق Expo Go)
npm run android    # تشغيل على Android Emulator
npm run typecheck  # فحص الأنواع TypeScript
npm test           # اختبارات Jest
npm run lint       # ESLint
```

متطلبات: Node.js 20+، وتطبيق **Expo Go** على الهاتف (أو Android Emulator).

## خارطة البناء (30 مرحلة)

العمل يسير بالتتابع — كل مرحلة تُبنى على التي قبلها ولا تُعاد كتابة ما يعمل:

```
PHASE 01  ✅ Mobile Foundation
PHASE 02  ✅ Expo Router (Route Groups + Guards + تنقل حسب الدور)
PHASE 03  ✅ Design System (17 Primitive + Tokens + Dark/Light)
PHASE 04  ✅ Theme persistence + RTL + i18n (ar/en · أرقام/عملة/تاريخ)
PHASE 05  ✅ Onboarding (8 شاشات · تقدم · تخطي · حركة)
PHASE 06  ✅ Authentication (Phone/Email → OTP → PIN → Biometric · Secure Storage)
PHASE 07  ✅ RBAC (100 Role · Permissions · Policies · Scopes · Widgets)
PHASE 08  ✅ Multi-Tenant Context (Scope Engine · Hierarchy · Store Switcher)
PHASE 09  ✅ Store Setup (معالج 6 خطوات: عمل · دولة · ضريبة · فرع · متجر · مراجعة)
PHASE 10  ✅ Dynamic Dashboard (14 Widget · Permission-Filtered · Live Metrics)
PHASE 11  ✅ POS Core (Catalog · Search · Barcode · Categories)
PHASE 12  ✅ Cart Engine (Money Math · Tax · Discount · Quantities)
PHASE 13  ✅ Checkout (Sale Order · Customer · Orders List)
PHASE 14  ✅ Payments (Cash/Card/QR/Wallet · Provider-Neutral)
PHASE 15  ✅ Receipts (Receipt · Share · Print-ready)
PHASE 16  ✅ Products Management (Catalog CRUD · Categories · Barcode)
PHASE 17  ✅ Inventory (Movements Ledger · Receive · Adjust · Transfer)
PHASE 18  ✅ Procurement (Suppliers · Purchase Orders · Receive→Stock)
PHASE 19  ✅ Customers + CRM + Loyalty (Profiles · Tiers · Points · CRM Notes)
PHASE 20  ✅ Finance & Accounting (Derived Ledger · Revenue · Profit · Expenses)
PHASE 21  ✅ HR (Employees · Attendance · Clock In/Out)
PHASE 22  ✅ Reports & Analytics (Sales KPIs · Methods · Top Sellers · Share)
PHASE 23  ✅ Offline-First (Outbox Queue · Connectivity · Sync Status)
PHASE 24  ✅ AI Copilot (On-device NLU · Store Q&A · Chat)
PHASE 25  ✅ AI Agents (7 Rule-based Agents · Action Safety Pipeline)
PHASE 26  ✅ Security (Auto-Lock · Biometric Unlock · Device Trust · Settings)
PHASE 27  ✅ Audit Trail (Append-only Log · Event Capture · Review Screen)
PHASE 28  ✅ Testing (371 unit/integration · i18n parity · E2E plan)
PHASE 29  ✅ Performance (FlatList windowing · memoized rows · stable keys)
PHASE 30  ✅ Production Polish (Error Boundary · config hardening · verify)

  🎉 اكتملت المراحل الـ30 كاملة — تطبيق MAJID POS AI جاهز. 🎉
PHASE 18  ⬜ Procurement
PHASE 19  ⬜ Customers + CRM + Loyalty
PHASE 20  ⬜ Finance & Accounting (POS ↔ Transaction ↔ Financial Event)
PHASE 21  ⬜ HR
PHASE 22  ✅ Reports & Analytics
PHASE 23  ✅ Offline-First (Outbox Queue · Connectivity · Sync Status)
PHASE 24  ✅ AI Copilot (On-device Rule-based NLU · Real Store Data)
PHASE 25  ✅ AI Agents (7 rule-based agents · read-only · action safety pipeline)
PHASE 26  ✅ Security (Secure Storage / Auto-Lock / Biometric / Device Trust)
PHASE 27  ✅ Audit Trail (append-only · event capture · review)
PHASE 28  ✅ Testing (371 unit/integration tests · e2e plan documented)
PHASE 29  ✅ Performance (FlatList windowing / memoized rows / stable keys)
PHASE 30  ✅ Production Polish (Error Boundary / config hardening / verified)
```

التفاصيل الكاملة: [`docs/PHASES.md`](docs/PHASES.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## بنية المشروع (PHASE 01)

```
majid-pos-ai/
├── app.json                  # إعدادات Expo (اسم، scheme، splash، plugins)
├── .env.example              # متغيرات البيئة (EXPO_PUBLIC_*)
├── src/
│   ├── app/                  # ⬛ Expo Router (File-based routes)
│   │   ├── _layout.tsx       # Root Layout — مقدمو الخدمات العامة
│   │   └── index.tsx         # شاشة الإقلاع / Bootstrap
│   ├── core/                 # لب التطبيق — لا يعتمد على أي Feature
│   │   ├── config/           # env مُتحقق منه بـ Zod + ثوابت
│   │   ├── errors/           # AppError hierarchy (Validation / Permission / Offline ...)
│   │   ├── result/           # Result<T,E> — معالجة أخطاء صريحة وآمنة
│   │   ├── types/            # معرفات Branded + Multi-Tenant + حالات Async
│   │   ├── money/            # حساب مالي حقيقي (Subtotal/Tax/Discount/Total)
│   │   ├── events/           # EventBus + أحداث Domain (SaleCreated ...)
│   │   └── logging/          # Logger مع تعتيم تلقائي للبيانات الحساسة
│   ├── domain/               # 18 Bounded Context (identity, tenancy, sales, ...)
│   ├── design-system/        # tokens / theme / primitives / business-components
│   ├── i18n/                 # ar (RTL) · en (LTR) · numbers · currency · date-time
│   ├── offline/              # database / queue / mutations / sync / conflicts
│   ├── security/             # secure-storage / session / biometric / audit
│   ├── store/                # State مقسم حسب Domain (لا Global Store ضخم)
│   ├── features/             # UI ← Feature ← Use Case ← Repository
│   ├── data/                 # repositories + sources (Mock اليوم / API غدًا)
│   └── shared/
└── tests/
    ├── unit/                 # ✅ اختبارات Money / Result / EventBus / Logger
    ├── integration/
    └── e2e/
```

## التنقل الحالي (PHASE 02)

```
app/index.tsx (Bootstrap Guard — قرار التوجيه)
├── (onboarding)/welcome      ← مستخدم جديد (8 شاشات تعريف متحركة ✅)
├── (auth)/sign-in → otp → pin → biometric   ← تدفق مصادقة حقيقي (✅) بلا خادم
└── (app)/
    ├── store-setup           ← معالج إعداد المتجر (6 خطوات · PHASE 09)
    └── (tabs)/               ← الرئيسية · نقطة البيع · الطلبات · العملاء · التقارير* · المزيد
                               *تظهر فقط لمن يملك reports.view (مدير المتجر+)
```

- **دخول تجريبي** بدور «كاشير» (صراحةً كمؤقت) يُظهر إخفاء تبويب التقارير ومنع الوصول إليه بـ `PermissionGuard`.
- كل مرحلة غير منفذة تُعرض كـ **Placeholder صادق** يذكر المرحلة المستهدفة — لا أزرار وهمية.

## نظام التصميم (PHASE 03)

`src/design-system/` — Tokens + Theme + 17 Primitive، جميعها Dark/Light ومُصممة للجوال (Premium/Futuristic):

```
tokens/   colors (Dark/Light + glow) · spacing(4pt) · radius · typography · shadows
theme/    ThemeProvider + useTheme  (system/light/dark + toggle)
primitives/
  Button · IconButton-via-Button · Input · SearchInput · Card · Badge · Chip ·
  Avatar · Modal · BottomSheet · Dialog · Toast(Provider+useToast) · Alert ·
  Tabs · Progress (Reanimated) · Skeleton (pulse) · Spinner · EmptyState · Screen
```

- إمكانية وصول: `accessibilityRole/Label/Hint/State` + أهداف لمس ≥44px + progressbar/alert.
- الاستيراد الموحّد: `import { Button, Card, useTheme } from '@/design-system'`.
- مكوّنات POS الخاصة (ProductCard · CartItem · CartSummary · ReceiptPreview …) تُبنى فوقها في PHASE 11+.

## اللغة والاتجاه (PHASE 04)

- **عربي = RTL** (افتراضي للسوق اليمني) · **English = LTR** — التبديل يفرض الاتجاه عبر `I18nManager` ويعيد التحميل ليعمل انعكاس التخطيط كاملًا بلا كسر.
- **النصوص خارج المكونات** (Section 46): كاتالوجا `src/i18n/ar` و`src/i18n/en` بمفاتيح ثابتة، تُستهلك عبر `useTranslation()` → `t('key')` مع استبدال متغيرات وجمع عربي (zero/one/two/many).
- **التنسيق المحلي**: أرقام (عربية مشرقية للعربية)، عملة YER/USD/SAR، تواريخ وأوقات ونسب — عبر `Intl`.
- **الإعدادات محفوظة**: اللغة والثيم (light/dark/system) يُخزَّنان على الجهاز عبر PreferencesRepository.
- `AppGate` ينتظر جاهزية اللغة والثيم قبل الرسم فلا ومضة اتجاه/لون. جرّب زر اللغة في شاشة الترحيب أو الرئيسية.

## الأدوار والصلاحيات (PHASE 07)

- **100 دور حقيقي** في `src/domain/security/roles-catalog.ts` (10 فئات)، كل دور بكود ثابت واسم عربي/إنجليزي ونطاق أقصى.
- **النطاقات الستة**: `own < store < branch < organization < tenant < global` مع محرك تغطية (النطاق الأوسع يغطي الأضيق).
- **محرك تفويض موحّد** `authorize(granted, required, scope)` + `can()` + حزم صلاحيات قابلة لإعادة الاستخدام (الكاشير، مدير المتجر، المالية…).
- **سجل عناصر لوحة التحكم** (`dashboard-widgets.ts`): العناصر تُفلتر بالصلاحية — الكاشير يرى بيع/سلة/طلبات، ومدير المتجر يرى الإيراد/المخزون، ومدير AI يرى الوكلاء/التنبؤ.
- **إخفاء العنصر ليس أمانًا**: الفحص يتم في المحرك عند الوصول للشاشة/الإجراء أيضًا.

## سياق الاستئجار (PHASE 08)

- **الهرمية كاملة** في `src/domain/tenancy`: Tenant → Organization → Branch → Store (مع العملة، نسبة الضريبة، الإحداثيات، الحالة).
- **محرك نطاق الاستعلام** `scope.ts`: نطاق دور المستخدم يحدد حقول التضييق تلقائيًا — الكاشير يرى متجره فقط، مدير الفرع يرى فرعه، مدير المنظمة يرى كل فروعها.
- **`TenancyProvider`** (`src/features/tenancy`): يحمّل الهرمية + المتاجر المسموحة بعد تسجيل الدخول، ويعرّض السياق النشط (tenant/org/branch/store) + queryScope لأي شاشة.
- **تبديل المتجر**: متاح فقط لمن نطاق دوره `branch` فأعلى (مدير الفرع/المنظمة)؛ الكاشير مقيّد بمتجره. الاختيار يُحفظ على الجهاز.
- **بيانات تجريبية يمنية**: متاجر ماجد — فرعا صنعاء وعدن، 4 متاجر (حدة، الزبيري، كريتر، المنصورة) برموز SNH-01/SNZ-02/ADC-03/ADM-04، العملة YER، ضريبة 5%.
- شاشة "المزيد" تعرض بطاقة المتجر النشط (الاسم · الفرع · السلسلة) وورقة تبديل المتاجر.

## إعداد المتجر (PHASE 09)

- **معالج من 6 خطوات** (`src/features/setup`): العمل (الاسم + نوع النشاط) ← الدولة والعملة ← الضريبة ← الفرع والمتجر ← المدير (اختياري) ← المراجعة.
- **اقتراحات محلية ذكية**: اختيار الدولة يضبط العملة ونسبة الضريبة تلقائيًا (اليمن → ريال/5%، السعودية → ريال/15%…) مع إمكانية التعديل.
- **تحقق في طبقة المجال** (`domain/setup/validation.ts`): أسماء غير فارغة، كود متجر بحروف لاتينية/أرقام/شرطات، ضريبة 0–100 — الأزرار مفعّلة فقط عند صحة الخطوة.
- **الملف التعريفي يُبنى إلى هرمية مستأجر** (`builder.ts`) بمعرّفات ثابتة حتمية؛ يحفظ على الجهاز ويصبح مصدر بيانات المستأجرين بدل البيانات التجريبية.
- بعد الإتمام يُوضع علَم الإعداد وينتقل المستخدم للوحة، وسياق الاستئجار يحمّل المتجر الجديد تلقائيًا.

## لوحة التحكم الديناميكية (PHASE 10)

- **لوحة واحدة تتكيف بالدور** من سجل العناصر الـ14 (PHASE 07): الكاشير يرى بيع/سلة/طلبات/مبيعات، والمدير يرى الإيراد/المخزون/الموظفين/المالية، ومدير AI يرى الرؤى/التنبؤ/الوكلاء — **فلترة صلاحيات حقيقية** لا 100 لوحة.
- **مؤشرات حية** (مالية مختصرة بالعملة/أعداد/أسهم اتجاه) تُجلب عبر مستودع اللوحة وتُنطق بنطاق الاستعلام الحالي (المتجر/الفرع/المنظمة).
- **حالات كاملة**: هياكل عظمية للتحميل · خطأ مع إعادة محاولة · فراغ · سحب للتحديث · تحديث يدوي.
- **نقرة صادقة**: العناصر الجاهزة تنتقل لتبويباتها الحقيقية (POS/الطلبات/العملاء/التقارير)، وغير المنفذة تظهر لافتة تذكر المرحلة — **لا أزرار وهمية**.
- البيانات حاليًا تجريبية (مذكورة بوضوح في تذييل اللوحة) ومصدرها قابل للاستبدال بـ API تحليلات دون لمس الشاشة.

## نقطة البيع (PHASE 11)

- **كتالوج منتجات حقيقي** (`src/domain/products`): 15 سلعة تجزئة يمنية بالريال اليمني، بسعر **كائن Money حقيقي** (لا floating خام) وباركود و SKU وتصنيف وحالة مخزون.
- **بحث وفلترة نقية** (تُختبر مباشرة): الاسم عربي/إنجليزي · الباركود · SKU · التصنيف · نطاق المتجر/الفرع · استبعاد النافد.
- **شاشة POS**: شبكة منتجات بعمودين، بحث فوري، شريط تصنيفات أفقي، وبطاقات بحالة المخزون (متوفر/منخفض/نافد — النافد غير قابل للإضافة).
- **إدخال باركود يدوي** عبر ورقة سفلية مع تغذية نجاح/فشل؛ الماسح بالكاميرا يأتي لاحقًا مع `expo-camera` (مذكور بوضوح).
- **السلة حقيقية (PHASE 12)**: زر الإضافة يضيف فعليًا لسلة بكميات ومخزون؛ الدفع لا يزال لافتة صادقة بالمرحلتين 13-14.

## محرك السلة (PHASE 12)

- **حسابات نقدية حقيقية** حصريًا عبر `core/money` (لا floating خام في الواجهة): إجمالي البنود · الضريبة · الخصم · الإجمالي النهائي.
- **ضريبة صحيحة للحالتين**: الأسعار الشاملة تُستخرج منها الضريبة، وغير الشاملة تُضاف فوقها؛ الخصم يُوزّع نسبيًا وتُعاد الضريبة.
- **قواعد عمل** تُرمى كأخطاء مجالية وتُترجم محليًا: تجاوز المخزون، الكمية غير الصالحة، اختلاف العملة، الخصم خارج 0–100.
- `CartProvider` يستمد العملة/الضريبة/المتجر من سياق الاستئجار ويُصفّر السلة تلقائيًا عند تبديل المتجر.
- **واجهة حية**: شريط سفلي بعدد الأصناف والإجمالي الحقيقي، ورقة مراجعة بكميات (−/+) وإزالة وخصم سريع (0/5/10٪) وإجماليات، وشارة كمية على كل بطاقة منتج.
- **إتمام البيع والطلبات (PHASE 13)**: زر "متابعة الدفع" ينتقل لشاشة مراجعة تنشئ طلب بيع حقيقيًا (رقم متسلسل، عميل زائر/باسم، إجماليات)، يُخزَّن محليًا ويظهر في تبويب الطلبات؛ التحصيل النقدي يأتي في PHASE 14.

## إتمام البيع والطلبات (PHASE 13)

- **طلب بيع حقيقي** يُولَّد من السلة (`src/domain/sales`): لقطة بنود وأسعار وإجماليات Money، رقم طلب بشري متسلسل (ORD-0001)، الكاشير والعميل والمتجر.
- **تخزين محلي Offline-First** عبر مستودع الطلبات (`orders.repository`) بمصدر JSON على الجهاز + رقم تسلسلي محفوظ؛ الترتيب الأحدث أولًا والتضييق بنطاق المتجر/الفرع.
- **شاشة إتمام البيع**: مراجعة البنود والإجماليات، اختيار العميل (زائر افتراضي أو باسم)، شاشة نجاح برقم الطلب، ثم تصفير السلة.
- **تبويب الطلبات الحقيقي**: قائمة الطلبات المحفوظة (رقم · عميل · عدد أصناف · إجمالي · شارة حالة الدفع) مع حالات تحميل/خطأ/فراغ وسحب للتحديث.
- **الطلب يُنشأ "بانتظار الدفع"**؛ التحصيل في PHASE 14.

## المدفوعات (PHASE 14)

- **تصميم مزود-محايد**: طريقة الدفع (نقدي/بطاقة/QR/محفظة) تُعالَج عبر واجهة `PaymentProvider` واحدة؛ المزود اليوم محاكى (`SimulatedPaymentProvider`) والبوابة الحقيقية تُضاف لاحقًا بلا تغيير الشاشات.
- **حسابات نقدية حقيقية** عبر `core/money`: القبض والباقي للنقدي (`computeTender`) مع فئات سريعة، ورفض القبض غير الكافٍ.
- **مستودع المدفوعات ينسّق**: المعالجة عبر المزود → تخزين سجل الدفعة (Offline-First) → تحديث حالة الطلب إلى "مدفوع".
- **شاشة التحصيل** (`/(app)/payment?orderId=`): المبلغ المطلوب كبير، اختيار الطريقة، إدخال القبض والباقي لحظيًا، وشاشة نجاح تعرض الطريقة/المُسلَّم/الباقي/رقم العملية.
- **الربط الكامل**: زر "متابعة الدفع" بعد إنشاء الطلب، وضغط أي طلب غير مدفوع في تبويب الطلبات يفتح التحصيل؛ المدفوع يظهر بشارة "مدفوع".
- الإيصال يُبنى في PHASE 15 (مشاركة جاهزة، طباعة حرارية لاحقًا).

## الإيصالات (PHASE 15)

- **بناء نقي في المجال** (`src/domain/receipts`): الإيصال يُجمّع من الطلب (+الدفعة) عبر منسّق مبالغ وتسميات مترجمة تُمرر من الواجهة — المجال مستقل عن i18n.
- **نص جاهز للطابعة الحرارية** (`receiptToText`): تنسيق 32 عمودًا مع فواصل وتوسيط، يُشارك عبر `Share` المدمج (واتساب/أي تطبيق) ويسلَّم لطابعة المتجر لاحقًا.
- **شاشة إيصال منسّقة** (`/(app)/receipt?orderId=`): ترويسة المتجر/الفرع، الأصناف، الإجماليات والضريبة، الدفع (طريقة/مُسلَّم/باقٍ/مرجع)، حالة الدفع.
- **الربط**: زر "عرض الإيصال" بعد التحصيل، وضغط أي طلب مدفوع في تبويب الطلبات يفتح إيصاله؛ غير المدفوع يفتح التحصيل.
- الطباعة الحرارية المباشرة لافتة صادقة (ربط الطابعة لاحقًا) — لا وظائف وهمية.

## المبادئ الحاكمة

1. **لا وظائف وهمية** — أي زر أو تنقل أو حساب غير منفذ يظهر كـ Placeholder صريح.
2. **الحسابات في Domain Layer** — الـ UI لا يحسب شيئًا بنفسه.
3. **الـ UI لا يلمس Storage مباشرة** — كل شيء عبر Repository.
4. **RBAC = Permissions وليس نسخ شاشات** — 100 دور تشترك بنفس الشاشات بصلاحيات مختلفة.
5. **إخفاء العنصر ليس أمانًا** — الصلاحيات تُفحص عند الوصول للشاشة/الإجراء أيضًا.
6. **كل شاشة**: Loading · Success · Error · Empty · Offline · Retry.
7. **Offline-First** — POS/Cart/Products/Inventory/Receipts تعمل دون اتصال ثم تُزامن.
8. **AI آمن** — User ← AI ← Intent ← Permission ← Validation ← Preview ← Confirm ← Action.

قواعد التنفيذ للوكلاء الهندسيين: [`AGENTS.md`](AGENTS.md)
#   m a j i d - p o s - a i  
 