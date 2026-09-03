# خطة المراحل — Delivery Phases

حلقة التنفيذ لكل مرحلة:
**Inspect → Understand → Plan → Implement → Integrate → Run Checks → Fix Errors → Test → Polish**

> قاعدة: لا حذف لملفات تعمل · لا إعادة بناء لمكوّنات موجودة · إعادة استخدام أولًا.

## ✅ PHASE 01 — Mobile Foundation

- [x] مشروع Expo SDK 57 حقيقي + TypeScript Strict
- [x] Expo Router مفعّل (Typed Routes) — Root Layout + شاشة Bootstrap
- [x] بنية المجلدات المعمارية كاملة (domain 18 / design-system / i18n / offline / security / store / features / data)
- [x] `core/`: env مُتحقق منه (Zod) · ثوابت · AppError hierarchy · Result · Money · EventBus · Logger آمن
- [x] أنواع Multi-Tenant + حالات Async الموحدة
- [x] Jest + jest-expo مع اختبارات وحدوية للنواة
- [x] توثيق: README · ARCHITECTURE · PHASES · AGENTS

## ✅ PHASE 02 — Expo Router

- [x] Route groups: `(onboarding)/welcome` · `(auth)/sign-in` · `(app)/(tabs)/*` + `store-setup`
- [x] Bootstrap guard (pure, tested): Onboarding? → Auth? → Store Setup? → Main
- [x] Guards دفاعية داخل كل مجموعة (re-entry / deep links)
- [x] Repositories: Session + Preferences (AsyncStorage) — mock قابل للاستبدال بـ API
- [x] نواة صلاحيات: wildcard matching (`pos.*`, `*`) + `hasPermission` / `assertPermission`
- [x] Navigation registry: تبويبات تُفلتر بالصلاحيات + PermissionGuard عند الوصول للشاشة
- [x] Mock Cashier session (دخول تجريبي صادق) — يخفي التقارير ويمنع الوصول لها
- [x] Typed Routes مفعّلة + 41 اختبار (routing / permissions / navigation / repositories)

## ⬜ PHASE 03 — Design System

## ✅ PHASE 03 — Design System

- [x] Tokens: colors (Dark/Light Premium) · spacing (4pt) · radius · typography · shadows + brand glow
- [x] ThemeProvider + useTheme (system/light/dark + toggle) — persistence في PHASE 04
- [x] 17 Primitive: Button · Input · SearchInput · Card · Badge · Chip · Avatar ·
      Modal · BottomSheet · Dialog · Toast (Provider+useToast) · Alert · Tabs ·
      Progress (Reanimated) · Skeleton (pulse) · Spinner · EmptyState + Screen shell
- [x] إمكانية وصول كاملة: roles · labels · hints · touch targets ≥44 · progressbar/alert roles
- [x] مكوّنات التنقل الحالية أعيد بناؤها فوق النظام (شاشات/تبويبات/حراس/Placeholder)
- [x] 53 اختبار (tokens · theme · primitives) + مبنى Android أخضر

## ✅ PHASE 04 — Theme persistence + RTL + i18n

- [x] LocaleProvider: عربي (RTL) / إنجليزي (LTR) · كشف لغة الجهاز · حفظ الاختيار
- [x] فرض RTL/LTR عبر I18nManager + إعادة تحميل عند التبديل (expo-updates)
- [x] كاتالوجا ترجمة ar/en خارج المكونات · `t()` مع استبدال متغيرات + جمع عربي
- [x] تنسيق: أرقام (أرقام عربية مشرقية) · عملة YER/USD/SAR · تاريخ/وقت/نسب
- [x] حفظ الثيم (light/dark/system) في PreferencesRepository
- [x] كل الشاشات والـ primitives مهجّرة للترجمة (لا نصوص داخل المكونات)
- [x] AppGate ينتظر جاهزية اللغة/الثيم لتفادي ومضة اتجاه/لون
- [x] 68 اختبار (translate · plural · format · direction · حفظ الإعدادات)

## ✅ PHASE 05 — Onboarding

- [x] الشاشات الثماني: welcome · smart-pos · ai-copilot · smart-inventory ·
      offline · payments · intelligence · get-started
- [x] Pager أفقي (FlatList) بنقر الصفحات + Next/Back/Skip + شريط تقدم ونقاط متحركة
- [x] حركة Parallax (scale/opacity/translate) لكل سلايد عبر Reanimated
- [x] ثنائي اللغة بالكامل + RTL (inverted pager) + Dark/Light + أزرار تبديل لغة/ثيم
- [x] إكمال/تخطي يحفظ العلم الحقيقي ويكمل لتسجيل الدخول (لا وهم)
- [x] 72 اختبار (ترتيب/محتوى السلايدات في اللغتين + رسم التدفق + Skip)

## ⬜ PHASE 06 — Authentication

## ⬜ PHASE 04 — Theme + RTL + i18n

- [ ] Dark/Light themes · i18next ar + en · RTL/LTR switch بلا كسر Layout
- [ ] numbers · currency (YER/USD/SAR) · date-time formatting

## ⬜ PHASE 05 — Onboarding (8 شاشات)

welcome · smart-pos · ai-copilot · smart-inventory · offline · payments ·
intelligence · get-started — مع Next/Back/Skip/Progress/Animation

## ✅ PHASE 06 — Authentication

- [x] تدفق حقيقي: معرف (هاتف يمني/بريد) → OTP (4 أرقام، تجريبي يُعرض بصدق) → PIN → بصمة
- [x] تحقق إدخال نقي (domain/identity/validation): هوية، OTP، PIN قوي (رفض 0000/1234)، تطبيع E.164
- [x] Secure Storage (expo-secure-store) للجلسة + تجزئة PIN (SHA-256 + salt) + علم البصمة
- [x] SecureSessionSource فوق SecureStorage مع استرجاع/فتح عبر PIN عبر SessionRepository
- [x] خدمة Biometric (expo-local-authentication): كشف جهاز + مطالبة + تخطي سليم
- [x] 4 شاشات (sign-in · otp · pin · biometric) + CodeInput (صناديق أرقام) ثنائية اللغة/RTL
- [x] عدّ إعادة إرسال OTP · حالات تحميل/خطأ · حماية الوصول المباشر للشاشات
- [x] 84 اختبار (تحقق هوية/OTP/PIN + تدفق التسجيل الكامل + استمرار الجلسة + فتح PIN)

## ✅ PHASE 07 — RBAC (100 دور)

- [x] النطاقات الستة own/store/branch/organization/tenant/global + مقارنة تغطية
- [x] أنواع: Role · Permission · UserRole · Policy · Action · Scope · AuthorizationResult
- [x] كيانات الهرمية: Tenant · Organization · Branch · Store (domain/tenancy)
- [x] فهرس صلاحيات قانوني (الموارد/الأفعال/النطاقات) + 13 حزمة صلاحيات قابلة لإعادة الاستخدام
- [x] فهرس الأدوار الـ100 بالترتيب المعتمد (أكواد فريدة + أسماء عربي/إنجليزي + فئة + نطاق)
- [x] محرك تفويض: can/authorize/collectPermissions/effectiveScope (إذن + نطاق)
- [x] سجل عناصر لوحة التحكم (Widget Registry) — 14 عنصرًا تُفلتر بالصلاحية
- [x] صلاحيات الكاشير تُشتق من فهرس الأدوار (مصدر واحد)
- [x] 99 اختبار (15 لـ RBAC: العدد/التفرد/الصلاحيات/النطاقات/التفويض/العناصر/اتساق الفهرس)

## ✅ PHASE 08 — Multi-Tenant Context

- [x] مجال نطاق الاستعلام: `buildQueryScope` (tenant/org/branch/store) + `matchesQueryScope` + `filterByScope`
- [x] مصدر بيانات المستأجر التجريبي: متاجر ماجد — منظمتان/فرعان/4 متاجر يمنية (SNH/SNZ/ADC/ADM)
- [x] مستودع الاستئجار: الهرمية + المتاجر المسموحة + بناء السياق + المتجر النشط
- [x] نطاق الدور يُشتق من `roleCode` عبر فهرس أدوار RBAC (لا منطق أعمال في الأدوار)
- [x] تبديل المتجر: صلاحيات تبديل حسب رتبة النطاق (الفرع فأعلى)، يُحفظ في التفضيلات
- [x] `TenancyProvider` في جذر التطبيق: يُحمّل بعد الجلسة + اكتمال الإعداد؛ حالات تحميل/خطأ
- [x] شاشة "المزيد": بطاقة المتجر النشط (الفرع/السلسلة) + ورقة تبديل المتاجر
- [x] مفاتيح ترجمة tenancy.* (ar/en) — لا نصوص خام في المكونات
- [x] 111 اختبارًا (12 لـ tenancy: ترتيب الرتب/النطاق/السياق/التبديل/الصلاحيات) + مبنى Android أخضر

## ✅ PHASE 09 — Store Setup (معالج إعداد المتجر)

- [x] مجال الإعداد: أنواع الملف التعريفي · 6 خطوات · دوال تحقق نقية · قوائم خيارات (8 أنشطة/6 دول/5 عملات)
- [x] اقتراحات تلقائية: العملة ونسبة الضريبة تُضبط حسب الدولة (YE→YER/5%، SA→SAR/15%…)
- [x] مُحوّل الملف التعريفي → هرمية مستأجر (معرّفات ثابتة حتمية + تطبيع كود المتجر)
- [x] طبقة بيانات: مصدر الإعداد المحلي (JSON على الجهاز) + مستودع الإعداد (يرفض الملف الناقص)
- [x] مصدر المستأجرين يبني الهرمية من ملف الإعداد إن وُجد، وإلا البيانات التجريبية
- [x] معالج واجهة كامل: شريط تقدم متحرك · Chips للاختيار · تحقق لكل خطوة · شاشة مراجعة · حالات تحميل/خطأ
- [x] بعد الإتمام: حفظ الملف + علَم الإعداد + الانتقال للوحة (الكاشير يبدأ على متجره الجديد)
- [x] ~70 مفتاح ترجمة setup.* (ar/en) — لا نصوص خام
- [x] 125 اختبارًا (14 لـ setup: تحقق/خيارات/بناء/مستودع/مصدر) + مبنى Android أخضر

## ✅ PHASE 10 — Dynamic Dashboard

- [x] مجال اللوحة: MetricValue/MetricTrend/MetricTone + DashboardSnapshot + حالات موحدة (loading/ready/error/empty)
- [x] مصدر تجريبي للمؤشرات بقيم شبه ثابتة (بصمة النطاق) — تتغير حسب المتجر/الفرع لتوضيح التضييق
- [x] مستودع اللوحة (Mock اليوم / API تحليلات غدًا) عبر حاوية تركيب مشتركة
- [x] خطاف useDashboard: العناصر المفلترة بالصلاحية + المؤشرات بنطاق الاستعلام + الحالة الموحدة
- [x] شبكة عناصر: كبيرة بعرض كامل (بيع جديد/الإيرادات/المالية/رؤى AI) والبقية أزواج؛ قيم مالية/عددية/نصية + أسهم اتجاه
- [x] إجراءات العناصر: تنقّل حقيقي لتبويبات قائمة (pos/orders/customers/reports) أو لافتة صادقة بالمرحلة (المخزون/الموارد البشرية/المالية/AI)
- [x] شاشة كاملة: ترويسة (تحية + المتجر/الفرع النشط + تحديث) · هياكل عظمية للتحميل · حالة خطأ مع إعادة محاولة · حالة فراغ · سحب للتحديث
- [x] الكاشير يرى بيع/سلة/طلبات/مبيعات؛ المدير يرى الإيراد/المخزون/الموظفين/المالية/الـ AI — فلترة حقيقية لا إخفاء شكلي
- [x] ~35 مفتاح ترجمة dashboard.* (ar/en) — لا نصوص خام
- [x] 136 اختبارًا (11 لـ dashboard: الفلترة/النطاق/المستودع/الإجراءات) + مبنى Android أخضر

## ✅ PHASE 11 — POS Core

- [x] مجال المنتجات: Product (سعر Money حقيقي · باركود · SKU · تصنيف · حالة مخزون) + ProductQuery/Result
- [x] بحث/فلترة نقية: الاسم (ar/en) · الباركود · SKU · التصنيف · نطاق المتجر/الفرع · استبعاد النافد
- [x] مصدر تجريبي: 15 سلعة تجزئة يمنية (مشروبات/غذاء/خفيفة/منزلية/إلكترونيات) بالريال اليمني + 5 تصنيفات
- [x] مستودع المنتجات مع تخزين مؤقت للكتالوج + بحث بالباركود + قائمة التصنيفات
- [x] شاشة نقطة البيع: شبكة منتجات بعمودين · بحث فوري · شريط تصنيفات أفقي · بطاقات بحالة المخزون (متوفر/منخفض/نافد)
- [x] إدخال باركود يدوي (BottomSheet) مع تغذية نجاح/فشل — الماسح بالكاميرا لاحقًا مع expo-camera (لافتة صادقة)
- [x] حالات كاملة: تحميل (هياكل عظمية) · خطأ مع إعادة محاولة · لا نتائج · سحب للتحديث
- [x] زر الإضافة والسلة والدفع: لافتات صادقة بالمرحلتين 12-13 (لا وظائف وهمية)؛ النافد غير قابل للإضافة
- [x] ~25 مفتاح ترجمة pos.* (ar/en) — لا نصوص خام
- [x] 146 اختبارًا (10 لـ products: البحث/الفلترة/الباركود/التصنيفات/المصدر/المستودع/حالة المخزون) + مبنى Android أخضر

## ✅ PHASE 12 — Cart Engine

- [x] محرك سلة نقي في طبقة المجال (Immutable): إضافة/دمج بنود · زيادة/إنقاص/تعيين كمية · إزالة · خصم إجمالي · تصفير
- [x] كل الحسابات عبر core/money (لا floating خام): إجمالي بند · إجمالي قبل الضريبة · خصم · ضريبة · إجمالي نهائي
- [x] ضريبة صحيحة للحالتين: أسعار شاملة (تُستخرج الضريبة) وغير شاملة (تُضاف)؛ الخصم يُوزّع نسبيًا ويُعاد حساب الضريبة
- [x] قواعد عمل تُرمى كـ ValidationError بسبب آلي: تجاوز المخزون · كمية غير صالحة · اختلاف العملة · خصم خارج النطاق
- [x] CartProvider فوق سياق الاستئجار: يستمد العملة/الضريبة/المتجر، ويُصفّر السلة تلقائيًا عند تغيّر المتجر (بلا effect)
- [x] الواجهة: شريط سلة سفلي حي (عدد الأصناف + الإجمالي الحقيقي) · ورقة مراجعة (كميات/إزالة/خصم سريع/الإجماليات) · شارة كمية على بطاقة المنتج
- [x] رسائل أخطاء السلة تُترجم لمفاتيح i18n؛ زر الدفع لافتة صادقة (Checkout PHASE 13) — لا وظائف وهمية
- [x] ~30 مفتاح ترجمة cart.* (ar/en) — لا نصوص خام
- [x] 161 اختبارًا (15 لـ cart: البنية/الدمج/المخزون/الكميات/الضريبة/الخصم/التصفير) + مبنى Android أخضر

## ✅ PHASE 13 — Checkout

- [x] مجال المبيعات: SaleOrder · OrderLine · حالة الطلب (pending_payment/paid…) · حالة الدفع (unpaid/partial/paid)
- [x] بناء الطلب من السلة (نقي): لقطة بنود وإجماليات Money · رقم طلب بشري متسلسل (ORD-0001) · عميل (زائر/باسم) · الكاشير
- [x] مصدر الطلبات المحلي (Offline-First): JSON على الجهاز + رقم تسلسلي محفوظ · ترتيب حتمي بالأحدث
- [x] مستودع الطلبات: إنشاء/قائمة (مفلترة بمتجر/فرع/مؤسسة)/جلب بالمعرف · واجهة ثابتة لمزامنة API لاحقًا
- [x] شاشة إتمام البيع: مراجعة البنود والإجماليات · معلومات المتجر/الكاشير · اختيار العميل · شاشة نجاح برقم الطلب
- [x] الطلب الجديد بحالة "بانتظار الدفع"؛ التحصيل (نقدي/بطاقة/QR) لافتة صادقة بالمرحلة 14 — لا وظائف وهمية
- [x] تبويب الطلبات الحقيقي: قائمة الطلبات المحفوظة (رقم/عميل/إجمالي/شارة دفع) · تحميل/خطأ/فراغ · سحب للتحديث
- [x] ربط زر الدفع في ورقة السلة بشاشة الإتمام؛ السلة تُصفَّر بعد حفظ الطلب
- [x] ~25 مفتاح ترجمة checkout.*/orders.* (ar/en) — لا نصوص خام
- [x] 169 اختبارًا (8 للمبيعات: رقم الطلب/العميل/البناء/المصدر/المستودع/التضييق/الفساد) + مبنى Android أخضر

## ✅ PHASE 14 — Payments

- [x] مجال المدفوعات المزود-محايد: Payment · PaymentMethod (نقدي/بطاقة/QR/محفظة) · PaymentState · TenderResult/Outcome
- [x] حسابات نقدية حقيقية عبر core/money: القبض/الباقي (computeTender) · فئات نقدية سريعة · إنشاء/إكمال/فشل الدفعة
- [x] واجهة PaymentProvider (بورت) + SimulatedPaymentProvider (يكتمل فورًا اليوم) — البوابة الحقيقية تُضاف لاحقًا بلا تغيير الشاشة
- [x] مستودع المدفوعات ينسّق: المزود → تخزين سجل الدفعة → تحديث حالة الطلب إلى "مدفوع" (orders.source.updateOrder)
- [x] النقدي يرفض القبض غير الكافٍ ويحفظ المُسلَّم والباقي؛ البطاقة/QR/المحفظة تُعالج عبر المزود
- [x] شاشة الدفع /(app)/payment?orderId=: المطلوب كبير · اختيار الطريقة · إدخال القبض والباقي لحظيًا بفئات سريعة · شاشة نجاح (طريقة/مُسلَّم/باقٍ/مرجع)
- [x] الربط: زر "متابعة الدفع" بعد الإتمام + ضغط طلب غير مدفوع في تبويب الطلبات → شاشة التحصيل؛ الطلب المدفوع يظهر بشارة "مدفوع"
- [x] حالات كاملة: تحميل/طلب غير موجود/خطأ/معالجة؛ ~30 مفتاح ترجمة pay.* (ar/en)
- [x] 180 اختبارًا (11 للمدفوعات: القبض/الباقي/الفئات/دورة الدفعة/المزود/المستودع/تحديث الطلب) + مبنى Android أخضر

## ✅ PHASE 15 — Receipts

- [x] مجال الإيصال النقي: Receipt/ReceiptLine/ReceiptTotalRow/ReceiptPayment + ترويسة المتجر
- [x] buildReceipt يجمع الإيصال من الطلب (+الدفعة) عبر منسّق مبالغ وتسميات مترجمة تُمرر من الواجهة (المجال مستقل عن i18n)
- [x] receiptToText: نص أحادي البعد بعرض 32 عمودًا (جاهز للطابعات الحرارية/المشاركة) مع فواصل وتوسيط
- [x] شاشة الإيصال /(app)/receipt?orderId=: بطاقة منسّقة (ترويسة/أصناف/إجماليات/ضريبة/دفع/قبض/باقٍ/مرجع/حالة)
- [x] مشاركة فعلية عبر Share المدمج (واتساب/طباعة حرارية)؛ الطباعة الحرارية المباشرة لافتة صادقة (ربط لاحق)
- [x] الربط: زر "عرض الإيصال" بعد الدفع + ضغط طلب مدفوع في تبويب الطلبات يفتح إيصاله؛ زر تحصيل للطلب غير المدفوع
- [x] حالات تحميل/غير موجود؛ ~7 مفاتيح receipt.* (ar/en)
- [x] 185 اختبارًا (5 للإيصال: البناء/الدفع/الخصم/النص) + مبنى Android أخضر

## ✅ PHASE 16 — Products Management (إدارة الكتالوج)

- [x] تحقق النموذج في المجال `domain/products/validation.ts` (الاسم/الباركود/السعر/الكمية — دوال نقية تُرجع مفاتيح أخطاء).
- [x] مُصنِّع المنتج `domain/products/factory.ts`: `createProductFromDraft`/`applyDraftToProduct`/`productToDraft` (حالة مخزون مشتقة، SKU تلقائي).
- [x] مصدر كتالوج دائم `LocalCatalogSource`: دمج الكتالوج التجريبي + تعديلات المستخدم المحفوظة (إضافة/تعديل/حذف) عبر التفضيلات.
- [x] مستودع المنتجات: `createProduct/updateProduct/deleteProduct/isBarcodeTaken` + تحقق طبقة بيانات ومنع تكرار الباركود + إبطال الذاكرة.
- [x] شاشة الإدارة `features/products/ProductsScreen.tsx`: بحث، قائمة، FAB إضافة، تعديل/حذف، حالات تحميل/خطأ/فراغ، تأكيد حذف.
- [x] ورقة النموذج `ProductFormSheet.tsx`: حقول الاسم/باركود/SKU/تصنيف (Chips)/سعر/كمية/شمول ضريبة + تحقق فوري.
- [x] الحماية بالصلاحيات: `PermissionGuard products.read` على الشاشة + فحص عند التنفيذ create/update/delete (إخفاء + إنفاذ).
- [x] مسار `/(app)/products` + مدخل في شاشة المزيد · ~50 مفتاح i18n عربي/إنجليزي.
- [x] 202 اختبارًا (17 لإدارة المنتجات) + مبنى Android أخضر `/tmp/majid-dist17`

## ✅ PHASE 17 — Inventory (المخزون · سجل حركات)

- [x] أنواع المجال `domain/inventory/types.ts`: InventoryMovement (استلام/تسوية/تحويل صادر-وارد/بيع/مرتجع)، InventoryLevel، طلبات العمليات.
- [x] منطق حركات نقي `domain/inventory/movements.ts`: أثر الحركة (زيادة/نقص/تعيين)، `applyMovement` (يمنع السالب)، `canDeduct`، `buildMovement` (تحقق + رصيد ناتج)، `summarizeLevels`/`totalStockValue`.
- [x] مصدر حركات دائم `LocalInventoryMovementsSource` (سجل Ledger على الجهاز) + مستودع `AppInventoryRepository`.
- [x] العمليات: `receiveStock` (استلام يزيد)، `adjustStock` (تسوية تعيّن الرصيد الفعلي بعد الجرد)، `transferStock` (خصم من المصدر؛ الوارد يُطبَّق لاحقًا مع المزامنة P23).
- [x] ربط رصيد المنتج: `productsRepository.setProductStock` + `withStockLevel` يحدّثان الكمية والحالة من الحركة (الكمية تُشتق من الحركة لا العكس).
- [x] شاشة `features/inventory/InventoryScreen.tsx`: تبويبا المستويات/الحركات، بطاقات ملخص (إجمالي/منخفض/نافد/قيمة تقديرية)، بحث، حالات تحميل/خطأ/فراغ.
- [x] ورقة `InventoryActionSheet` (استلام/تسوية/تحويل: كمية/سبب إلزامي/مرجع/وجهة) مع تحقق فوري.
- [x] الحماية: `PermissionGuard inventory.read` على الشاشة + إنفاذ `inventory.adjust`/`inventory.transfer` عند التنفيذ.
- [x] مسار `/(app)/inventory` + مدخل في شاشة المزيد · ~55 مفتاح i18n عربي/إنجليزي.
- [x] 213 اختبارًا (11 للمخزون: حساب الحركات/البناء/الملخص/استلام-تسوية-تحويل/رفض المخالفات) + مبنى Android أخضر `/tmp/majid-dist18`

## ✅ PHASE 18 — Procurement (المشتريات · المورّدون + أوامر الشراء)

- [x] أنواع المجال `domain/procurement/types.ts`: Supplier، PurchaseOrder + PurchaseOrderLine، حالة الأمر (مسودة/مقدَّم/معتمد/استلام جزئي/مستلَم/ملغى).
- [x] منطق نقي `domain/procurement/logic.ts`: تحقق المورّد، `calculateTotals` (subtotal/ضريبة/إجمالي بمال حقيقي)، `createPurchaseOrder`، آلة حالة `canTransition`/`transitionPurchaseOrder`، `recordReceipt` (استلام متراكب مقيَّد بالكمية المطلوبة).
- [x] مصادر دائمة `LocalSuppliersSource` + `LocalPurchaseOrdersSource` (تخزين على الجهاز، حفظ متسق للقائمة والتسلسل) + مستودع `AppProcurementRepository`.
- [x] دورة الحياة: إنشاء مسودة → تقديم → اعتماد → استلام لكل صنف؛ الاستلام يُنشئ حركة مخزون `receive` تزيد رصيد المنتج فعلًا (تكامل مع P17).
- [x] الشاشات: `ProcurementScreen` (تبويبا الأوامر/المورّدين + إجراءات سريعة)، `NewPurchaseOrderScreen` (مورّد + أصناف من الكتالوج + كمية/تكلفة + ضريبة + إجماليات حية)، `PurchaseOrderDetailScreen` (الأسطر/الاستلام/أزرار الحالة).
- [x] الحماية: `PermissionGuard procurement.read` + إنفاذ `procurement.create`/`procurement.approve`/`suppliers.manage` عند التنفيذ.
- [x] مسارات `/(app)/procurement` · `/(app)/po/new` · `/(app)/po/[id]` + مدخل في شاشة المزيد · ~90 مفتاح i18n عربي/إنجليزي.
- [x] 229 اختبارًا (16 للمشتريات: تحقق/إجماليات/انتقالات الحالة/الاستلام/تكامل المخزون) + مبنى Android أخضر `/tmp/majid-dist19`

## ✅ PHASE 19 — Customers + CRM + Loyalty (العملاء والولاء)

- [x] أنواع المجال `domain/customers/types.ts`: Customer (فرد/تجاري)، ولاء (إنفاق تراكمي/نقاط/شريحة)، وسوم، ملاحظات CRM، سجل مشتريات.
- [x] منطق الولاء النقي `loyalty.ts`: `pointsForAmount` (نقطة لكل 1000)، عتبات الشرائح برونزي→فضي→ذهبي→بلاتيني، `tierForSpent`، `recordPurchase` (يمنع التكرار، يرقّي الشريحة)، `loyaltySummary` (المتبقّي للترقية).
- [x] مُصنِّع وتحقق `factory.ts`: `validateCustomerDraft` (اسم/هاتف/بريد)، `createCustomerFromDraft`/`applyDraftToCustomer`/`customerToDraft`، تطبيع الهاتف، تفسير الوسوم.
- [x] مصدر دائم `LocalCustomersSource` + مستودع `AppCustomersRepository`: بحث بالاسم/الهاتف، CRUD، منع تكرار الهاتف، `addNote`، و`recordPurchaseFor` (يُحدّث الولاء بعد الدفع).
- [x] ربط دورة البيع: `OrderCustomer` يحمل `customerId`؛ شاشة الدفع تتيح اختيار عميل مسجّل (بحث فوري)؛ بعد الدفع الناجح في `usePayment` يُستدعى `recordPurchaseFor` لتُكتسب النقاط (فشل الولاء لا يُبطل الدفع).
- [x] الشاشات: `CustomersScreen` (قائمة/بحث/شريحة/نقاط/إنفاق + FAB)، `CustomerDetailScreen` (بطاقة هوية، بطاقة ولاء، سجل مشتريات، ملاحظات CRM، تعديل).
- [x] الحماية: `PermissionGuard customers.read` + إنفاذ `customers.manage` عند الإنشاء/التعديل/الملاحظات.
- [x] مسارات `/(app)/customers` · `/(app)/customer/[id]` + مدخل في شاشة المزيد · ~90 مفتاح i18n عربي/إنجليزي.
- [x] 242 اختبارًا (13 للعملاء/الولاء: تحقق/نقاط/شرائح/تسجيل شراء/منع تكرار/المستودع) + مبنى Android أخضر `/tmp/majid-dist20`

## ✅ PHASE 20 — Finance & Accounting (المالية والمحاسبة)

- [x] أنواع المجال `domain/finance/types.ts`: قيد مالي (داخل/خارج)، نوع القيد (بيع/ضريبة بيع/مشتريات/ضريبة شراء/مصروف)، مصروف يدوي، ملخص مالي، الفترات الزمنية.
- [x] منطق نقي `domain/finance/logic.ts`: اشتقاق القيود من المبيعات المدفوعة فقط (إيراد + ضريبة محصّلة) ومن أوامر الشراء المستلَمة فقط (تكلفة + ضريبة مدفوعة) ومن المصاريف؛ فلترة الفترة (`rangeForPeriod`/`filterEntries`)؛ `summarize` (إيراد/تكلفة/مصاريف/مجمل ربح/صافي ربح/نقد داخل-خارج)؛ تحقق وبناء المصروف.
- [x] مصدر دائم `LocalExpensesSource` + مستودع `AppFinanceRepository` يجمع القيود من طلبات البيع والمشتريات والمصاريف (لا قيود مخزّنة — كلها مشتقة لتبقى الأرقام متسقة).
- [x] الشاشات: `FinanceScreen` (تبويبات الفترة: اليوم/أسبوع/شهر/الكل، بطاقة صافي الربح، شبكة 8 مؤشرات، سجل قيود بأيقونات/إشارات +/−، FAB مصروف) وورقة `ExpenseFormSheet`.
- [x] الحماية: `PermissionGuard finance.read` + إنفاذ `finance.manage` عند إضافة مصروف.
- [x] مسار `/(app)/finance` + مدخل في شاشة المزيد · ~55 مفتاح i18n عربي/إنجليزي.
- [x] 251 اختبارًا (9 للمالية: اشتقاق القيود/الملخص/الفترات/المصروف/تجميع المستودع) + مبنى Android أخضر `/tmp/majid-dist21`

## ✅ PHASE 21 — HR (الموارد البشرية)

- [x] أنواع المجال `domain/hr/types.ts`: Employee (مسمى/راتب Money/تاريخ تعيين/حالة)، AttendanceRecord (بصمة دخول/خروج/دقائق/حالة)، نماذج الإدخال والملخصات.
- [x] منطق نقي `domain/hr/logic.ts`: تحقق الموظف (اسم/مسمى/راتب/هاتف/بريد)، `createEmployeeFromDraft`/`applyDraftToEmployee`/`employeeToDraft`، `minutesBetween`، `clockIn`/`clockOut` (يحسب الدقائق، idempotent)، `summarizeAttendance` (ساعات وفتح/إغلاق).
- [x] مصدر دائم `LocalHrSource` (موظفون + حضور في مفتاح واحد) + مستودع `AppHrRepository`: بحث/فلترة، إنشاء/تعديل، ومنع تكرار الدخول لموظف لديه فترة مفتوحة.
- [x] الشاشات: `HrScreen` (تبويبا الموظفون/الحضور، بحث، بطاقات موظفين براتب/حالة، أزرار بصمة دخول/خروج، سجل دوام بالساعات) وورقة `EmployeeFormSheet`.
- [x] الحماية: `PermissionGuard employees.read` + إنفاذ `hr.manage` (إنشاء/تعديل) و`attendance.manage` (البصمات) عند التنفيذ.
- [x] مسار `/(app)/hr` + مدخل في شاشة المزيد · ~50 مفتاح i18n عربي/إنجليزي.
- [x] 263 اختبارًا (12 للموارد البشرية: تحقق/بناء/وقت الدوام/دخول-خروج/منع تكرار/تجميع/المستودع) + مبنى Android أخضر `/tmp/majid-dist22`

## ✅ PHASE 22 — Reports & Analytics (التقارير والتحليلات)

- [x] أنواع المجال `domain/reports/types.ts`: SalesReport (إيراد/ضريبة/خصم/متوسط طلب/نمو)، PaymentMethodSlice، ProductPerformance، TimeSeriesPoint.
- [x] منطق نقي `domain/reports/logic.ts`: `periodRanges` (اليوم/أسبوع/شهر/الكل + الفترة السابقة)، `buildSalesReport` يشتق من الطلبات المدفوعة + الدفعات المكتملة (الإيراد لا يحصي غير المدفوعة، الدفعات الفاشلة تُستبعد)، توزيع طرق الدفع بالنسب، الأكثر مبيعًا (تجميع بنود الطلبات)، سلسلة زمنية يومية، ونسبة النمو مقابل الفترة السابقة (بلا قسمة على صفر).
- [x] `reportToText` يبني تقريرًا نصيًا 32-عمود للمشاركة الحرارية (Share) — صادق بلا تزوير.
- [x] إضافة `listAllPayments()` لمستودع المدفوعات + مستودع `AppReportsRepository` (قراءة فقط، يجمع الطلبات والدفعات ويفوّض الحساب للمجال).
- [x] الشاشة `ReportsScreen`: تبويبات الفترة، بطاقة الإيراد + سهم النمو (أعلى/أسفل)، شبكة 6 مؤشرات، رسم أعمدة View-only، أشرطة توزيع طرق الدفع، قائمة الأكثر مبيعًا، زر مشاركة التقرير النصي.
- [x] استبدال تبويب التقارير المؤقت بالشاشة الحقيقية + الحماية `PermissionGuard reports.view` والمشاركة بـ `reports.export`.
- [x] ~22 مفتاح i18n عربي/إنجليزي.
- [x] 272 اختبارًا (9 للتقارير: الفترات/الإيراد المدفوع فقط/الضريبة-الخصم/طرق الدفع/الأكثر مبيعًا/النمو/النص) + مبنى Android أخضر `/tmp/majid-dist23`

## ✅ PHASE 23 — Offline-First (العمل دون اتصال / المزامنة)

- [x] أنواع المجال `domain/sync/types.ts`: MutationRecord (كيان/إجراء/معرف محلي/حمولة/حالة/محاولات)، MutationStatus (pending·inflight·synced·failed)، ConnectivityState، SyncOutcome، QueueSummary.
- [x] منطق نقي `domain/sync/queue.ts`: إنشاء طفرة، إضافة (الأحدث أولًا في التخزين)، `nextPending` (الأقدم أولًا FIFO + حد دفعة 25)، markInflight (يعدّد المحاولات)، markSynced (يخزّن remoteRef داخل الحمولة)، markFailed (يعود pending حتى بلوغ maxAttempts=5 ثم failed دائم)، summarizeQueue، `mutationDedupKey` + findDuplicate (يمنع تكرار pending/inflight فقط)، prune (يُبقي غير المنسّقة كلها + أحدث 50 منسّقة).
- [x] `domain/sync/connectivity.ts`: منفذ `ConnectivityPort` (getState/subscribe) + `DefaultConnectivityPort` قابل للحقن (`.set()` للاختبارات؛ افتراضي online — لا اعتماد netinfo بعد).
- [x] `domain/sync` يصدّر واجهة `SyncAdapter` + `LocalSimulatedSyncAdapter` (صادق: الجهاز مصدر الحقيقة اليوم فينجح فورًا؛ تُستبدل ببوابة HTTP لاحقًا بلا إعادة كتابة).
- [x] مصدر `LocalSyncQueueSource` فوق AsyncStorage (مفتاح `pendingMutationQueue`، قراءة JSON آمنة، كتابة ذرّية كاملة).
- [x] مستودع `AppSyncRepository`: enqueue (إزالة تكرار + دفع تلقائي fire-and-forget)، flush (لا يرسل دون اتصال؛ دفعة 25؛ نجاح/فشل/إعادة محاولة؛ يبث SYNC_QUEUED/COMPLETED/FAILED)، list (الأحدث أولًا)، summary، prune.
- [x] ربط مفكوك عبر الناقل: المستودعات تبثّ أحداث المجال فقط (SALE_CREATED من الطلبات، PAYMENT_COMPLETED من الدفعات عند النجاح فقط)؛ `shared/sync/sync-bootstrap.ts` يترجم أحداث البيع/الدفع/المنتج/العميل/أمر الشراء/المصروف/الموظف/المخزون إلى طفرات ويستدعي flush أوليًا.
- [x] واجهة: `SyncProvider` (حالة الاتصال + ملخص الطابور + مزامنة يدوية)، `SyncStatusBar` (شريط دون اتصال / عدّاد معلّق/فاشل)، شاشة `SyncScreen` (حالة الاتصال + 4 بطاقات عدّاد + زر مزامنة + سجل الطفرات) مربوطة في «المزيد» بصلاحية `reports.view`، وشارة حية على تبويب المزيد.
- [x] 29 مفتاح i18n عربي/إنجليزي (حالات/كيانات/إجراءات/شرائط/شاشة).
- [x] 286 اختبارًا / 33 مجموعة (14 للمزامنة: المنطق النقي FIFO/الحالات/إعادة المحاولة/التجميع/التكرار + المستودع: دون اتصال لا يرسل، متصل ينسّق، فشل المزوّد، إزالة التكرار، التقليم) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist24`.

database · repositories · queue · mutations · sync · conflicts · connectivity

## ✅ PHASE 24 — AI Copilot (المساعد الذكي)

- [x] أنواع المجال `domain/ai/types.ts`: CopilotIntent (12 نية: ترحيب/مبيعات/إيراد/عدد طلبات/متوسط طلب/الأكثر مبيعًا/طرق دفع/مخزون منخفض/سعر منتج/ضريبة وخصم/مساعدة/مجهول)، CopilotPeriod، CopilotMessage (فقاعة محادثة + بطاقات + اقتراحات)، CopilotCard، CopilotParse، CopilotDataContext.
- [x] فهم لغة نقي `domain/ai/intents.ts`: `normalizeArabic` (توحيد الألف/التاء/الهمزات وإزالة التشكيل والرموز)، `parseCopilotQuery` (تطابق كلمات مفتاحية عربية/إنجليزية مع درجة ثقة بطول العبارة)، اكتشاف الفترة (اليوم/أسبوع/شهر/الكل، اليوم افتراضًا)، واستخراج اسم المنتج من أسئلة السعر. الترتيب يراعي الأسبقية (إجمالي المبيعات قبل الإيراد، الأكثر مبيعًا قبل المبيعات).
- [x] مولّد حقائق نقي `domain/ai/answers.ts`: `buildCopilotFacts` يحوّل النية + بيانات حقيقية (SalesReport/InventoryLevel/Product) إلى حقائق منظمة (قيم خام + بطاقات) بلا ترجمة؛ يفرّق الفترة الفارغة والمنتج غير الموجود والمخزون السليم. لا حسابات مالية هنا — كلها مقروءة من تقرير مبني عبر core/money.
- [x] طبقة تنسيق `features/copilot/copilot-service.ts`: تجمع البيانات انتقائيًا حسب النية (reports/inventory/products) عبر المستودعات، تبني الحقائق ثم تُرجِمها لنص وبطاقات عبر مُنسّق i18n محقون (تفادي استيراد الواجهة في الخدمة)؛ مع مسار خطأ صادق.
- [x] واجهة محادثة `features/copilot/CopilotScreen.tsx`: فقاعات مستخدم/مساعد، بطاقات أرقام ملونة (إيراد/طلبات/متوسط/ضريبة/خصم/أعلى المنتجات/طرق الدفع)، أسئلة مقترحة، مؤشر "أفكّر"، إدخال متعدد الأسطر مع إرسال، تمرير تلقائي، شريط علوي يوضح بصدق أنه مساعد محلي على الجهاز. محمية بـ `PermissionGuard reports.view`.
- [x] المسار `(app)/copilot.tsx` + مدخل في «المزيد» بأيقونة sparkles بصلاحية التقارير.
- [x] 36 مفتاح i18n عربي/إنجليزي (ترحيب/مساعدة/ردود/بطاقات/فترات/اقتراحات/حالات).
- [x] 313 اختبارًا / 34 مجموعة (27 لـ Copilot: التطبيع العربي، 13 حالة نية عربي/إنجليزي، الفترات، استخراج المنتج، توليد الحقائق لكل نية، الفترة الفارغة، المنتج غير الموجود، المخزون السليم) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist25`.

## ✅ PHASE 25 — AI Agents (الوكلاء الأذكياء + خط أمان الإجراءات)

- [x] أنواع المجال `domain/agents/types.ts`: AgentId (7: inventory/sales/finance/procurement/crm/cashier/business)، InsightSeverity (info/good/warning/critical)، AgentActionRoute (تنقّل داخلي فقط)، AgentAction (labelKey + permission + route)، AgentInsight (عنوان/نص/معاملات رقمية/مبالغ/إجراء اختياري)، AgentDefinition، AgentDataInput (أرقام خام فقط).
- [x] فهرس `domain/agents/agents-catalog.ts`: تعريف الوكلاء السبعة بأسماء/أوصاف/أيقونات وأدنى صلاحية قراءة لكل مجال (inventory.read/reports.view/finance.read/procurement.read/customers.read/orders.read).
- [x] محرّك قواعد نقي `domain/agents/rules.ts`: `runAgents` يشغّل 7 دوال قواعد — المخزون (نافد حرج/منخفض تحذير/سليم جيد)، المبيعات (لا مبيعات/نمو ▲/تراجع ▼ بنسبة مشتقة عكسيًا من نمو التقرير/ملخص)، المالية (مصروفات >50% من الإيراد تحذير بالنسبة/مصروفات معلومات)، المشتريات (أوامر معلّقة)، CRM (عملاء مميزون بلا شراء/نشطون)، الكاشير (طلبات غير مدفوعة حرج)، الأعمال (ملخص يومي بعدّ التنبيهات)؛ الفرز تنازليًا بالخطورة. لا مال يُحسب هنا — الأرقام من تقارير core/money.
- [x] **خط أمان الإجراءات** `domain/agents/safety.ts`: `applySafetyPipeline` يحجب الرؤية كاملةً إن لم يملك المستخدم صلاحية قراءة مجال وكيلها (منع تسريب)، ويُزيل زر الإجراء إن غابت صلاحيته مع إبقاء الرؤية. الأهم: **لا تنفيذ تلقائي إطلاقًا** — الإجراء ينقل المستخدم للشاشة (route) ليتصرف بنفسه؛ التنويه بذلك ظاهر في الواجهة.
- [x] خدمة `features/agents/agents-service.ts`: تجمع البيانات الحقيقية (تقرير اليوم/ملخص المخزون/أوامر الشراء/العملاء/الطلبات/مصروفات اليوم)، تبني AgentDataInput، تشغّل المحرّك، تمرّر عبر خط الأمان، ثم تُنسّق المبالغ عبر i18n المحقون وتُترجم العناوين/الأزرار.
- [x] شاشة `features/agents/AgentsScreen.tsx`: قائمة رؤى ملوّنة بالخطورة مع أيقونة الوكيل، زر إجراء آمن (تنقّل فقط)، تنويه أمان أعلى الشاشة، حالات تحميل/خطأ/فراغ، سحب للتحديث. المسار `(app)/agents.tsx` + مدخل «المزيد» بأيقونة rocket.
- [x] 56 مفتاح i18n عربي/إنجليزي (عناوين/نصوص الرؤى/أزرار/تنويه الأمان/حالات).
- [x] 332 اختبارًا / 35 مجموعة (19 للوكلاء: الفهرس 7، قواعد كل وكيل ونِسَب النمو/المصروفات، الفرز بالخطورة، وخط الأمان: حجب المجال، إزالة الزر دون صلاحية، وضمان أن الإجراءات تنقّل فقط بلا تنفيذ) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist26`.

## ✅ PHASE 26 — Security (الأمان: القفل التلقائي · البصمة · سلامة الجهاز)

- [x] مجال نقطي بحت `domain/security-lock/`: أنواع (SecuritySettings، LockState، AutoLockTimeout فوري/1/5/15/30/60 دقيقة، UnlockResult، DeviceSecurityReport، AppActivity) ومنطق `policy.ts` — إعدادات افتراضية آمنة، `timeoutMs`، `shouldLockOnForeground` (يقفل فقط عند وجود بيانات اعتماد + قفل مفعّل + تجاوز المهلة بعد الخلفية؛ الفوري يقفل عند أي خلفية)، `buildDeviceReport` (مستوى ثقة high/medium/low + تحذيرات من حقائق المنصة)، `normalizeSettings` (دمج آمن مع الافتراضي).
- [x] خدمة سلامة الجهاز `security/device/device-security.service.ts`: تغلّف expo-device (isDevice) وقياس البصمة عبر منفذ `DeviceFactsPort` قابل للحقن (منصة حقيقية + بديل اختبار)، وتغذّي منطق المجال النقي.
- [x] مستودع `AppSecurityRepository` (يقرأ/يكتب الإعدادات عبر مفتاح `securitySettings`، ينسّق فتح القفل: PIN عبر بصمة SHA-256 المملّحة في الخزنة الآمنة `verifyPin`، وبصمة عبر `promptBiometric` مع تمييز الإلغاء/عدم الإتاحة). أُضيف تمرير `verifyPin` لمستودع الجلسة.
- [x] `SecurityProvider` (`features/security/security-context.tsx`): يستمع لـ AppState (مقدمة/خلفية)، يسجّل لحظة الخلفية، ويطبّق قرار القفل النقي عند العودة للمقدمة؛ يوفّر حالة القفل + القفل اليدوي + الفتح بـ PIN/بصمة + حفظ/إعادة تحميل الإعدادات (بقيم آمنة خارج المزوّد).
- [x] `LockOverlay.tsx`: Modal بملء الشاشة يحجب المحتوى عند القفل (لا يتجاوز بالتنقل)، CodeInput بـ 4 أرقام مع خطأ PIN خاطئ، فتح تلقائي/يدوي بالبصمة عند توفّرها وتفعيلها.
- [x] `SecurityScreen.tsx`: تبديل القفل التلقائي + اختيار المهلة (شرائح)، تبديل فتح البصمة، طلب PIN للإجراءات الحساسة، زر "قفل الآن"، وبطاقة تقرير سلامة الجهاز (مستوى الثقة + تحذيرات المحاكاة/غياب البصمة). المسار `(app)/security.tsx` + مدخل «المزيد» بأيقونة درع.
- [x] ربط المزوّد والطبقة في الجذر `_layout.tsx` (حول ThemedStack داخل AppGate) + 25 مفتاح i18n عربي/إنجليزي.
- [x] 345 اختبارًا / 36 مجموعة (13 للأمان: تحويل المهلات، قرار القفل في كل حالة — لا اعتماد/معطّل/بلا خلفية/فوري/بعد المهلة/داخل النافذة، تقرير الجهاز high/medium/low والمحاكاة، ودمج الإعدادات) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist27`.

## ⬜ PHASE 27 — Audit Trail

## ✅ PHASE 27 — Audit Trail (سجل التدقيق)

- [x] أنواع المجال `domain/audit/types.ts`: AuditAction (بيع/دفع/منتج/عميل/شراء/مخزون/مصروف/موظف/قفل/فتح/تغيير إعدادات/خروج)، AuditSeverity (info/sensitive/security)، AuditEntry (ثابتة: فئة/مجال/أهمية/مفتاح ملخص+معاملات/منفّذ actor/مرجع/طابع زمني)، AuditCategory (9 مجالات + all للفلترة)، AuditFilter، AuditSummary.
- [x] منطق نقي `domain/audit/logic.ts`: `entryFromDomainEvent` يحوّل أحداث المجال (sale.created…employee.created) إلى مدخلات مع استخراج المرجع/المعاملات لكل حدث، ويُرجع null للضجيج (sync/connectivity/audit) لتفادي حلقة الالتقاط؛ `makeSecurityEntry` لأحداث الأمان؛ `filterEntries` (مجال/أهمية/فترة زمنية/بحث + ترتيب الأحدث أولًا)؛ `summarizeAudit` (عدّ لكل مجال/أهمية + عدّ الأمان).
- [x] مصدر `LocalAuditLogSource` (مفتاح `audit_log`): append-only إلحاق ذرّي كامل-الـ blob مع تقليم حدّه 1000 مدخلة (يُبقي الأحدث)، قراءة JSON آمنة تعيد [] عند الفساد وتطبّع الطوابع.
- [x] مستودع `AppAuditRepository` (record/list/summary + `sessionActor` لاشتقاق المنفّذ من الجلسة) مبثوثًا حدث `audit.recorded` (غير ملتقط أصلًا). رُبط في الحاوية.
- [x] التقاط تلقائي مفكوك `shared/audit/audit-bootstrap.ts` (`wireAudit`) يشترك بأحداث الكتابة الثمانية ويسجّلها بالمنفّذ الحالي؛ يُستدعى من AppGate عند الجاهزية. أحداث الأمان تُسجَّل مباشرة: قفل (يدوي+تلقائي فوري/عودة للمقدمة)، فتح (PIN/بصمة مع طريقة)، تغيير إعدادات الأمان، وتسجيل الخروج.
- [x] شاشة `AuditScreen`: قائمة مدخلات ملوّنة بالأهمية مع أيقونة المجال، ملخص (إجمالي/أمان/حسّاس)، تبويبات فلترة المجالات (أفقية)، بحث فوري، سحب-للتحديث، حالات تحميل/خطأ/فراغ؛ محمية بـ `PermissionGuard audit.read`. المسار `(app)/audit.tsx` + مدخل «المزيد».
- [x] أُضيف حدث `AUDIT_RECORDED` للناقل + 34 مفتاح i18n عربي/إنجليزي (مدخلات/مجالات/حالات/بحث).
- [x] 358 اختبارًا / 37 مجموعة (13 للتدقيق: ربط الأحداث، استبعاد الضجيج، المنفّذ، مدخلات الأمان، الفلترة/البحث/الفترة، التلخيص، append-only للمصدر/المستودع، ومرونة القراءة ضد الفساد) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist28`.

## ✅ PHASE 28 — Testing (اختبارات التكامل + البنية)

- [x] أدوات اختبار مشتركة `tests/helpers/factories.ts`: مصانع نقية (منتج/سلة/مجاميع/مدخلات طلب) لإعادة الاستخدام عبر الوحدة والتكامل بدل التهيئة المكررة.
- [x] **اختبار تكامل دورة حياة البيع** `tests/integration/sale-lifecycle.integration.test.ts`: يربط المستودعات الحقيقية عبر الناقل (orders+payments+reports+audit+sync) ويتحقق — إنشاء طلب → دفعة نقدية ناجحة → تسجيل تدقيق تلقائي (sale_created/payment_completed بدرجة sensitive) → تقرير مشتق يعكس الإيراد الحقيقي؛ ووضع عدم الاتصال يُبقي الطفرات معلّقة ثم تُنسّق عند عودة الاتصال؛ وCopilot (NLU عربي + الحقائق) يقرأ تقرير اليوم الحقيقي.
- [x] **اختبار تكامل RBAC** `tests/integration/security-rbac.integration.test.ts`: اشتقاق صلاحيات الأدوار الفعلية (الكاشير لا يملك reports.view/audit.read لكن يملك inventory.read)، البدل الشامل لـ super-admin، `assertPermission` يرمي BusinessRuleViolationError (إخفاء ليس أمنًا)، فرض النطاق عبر `authorize` (SCOPE_DENIED لفعل أوسع من نطاق المستخدم)، وخط أمان الوكلاء يحجب الرؤى ويزيل أزرار الإجراءات حسب صلاحيات الدور فعلًا.
- [x] **اختبار اكتمال i18n** `tests/unit/i18n/key-parity.test.ts`: تطابق تام لمجموعة مفاتيح ar/en (لا نص مفقود في لغة)، كل قيمة غير فارغة، لا تسريب رموز قالب {token} في النصوص الثابتة، ووجود مجموعات copilot/agents/security/audit بعدد متساوٍ في اللغتين.
- [x] **خطة E2E صادقة** `tests/e2e/README.md`: سبعة سيناريوهات قبول حرجة (بيع/دفع/إيصال، دون اتصال→مزامنة، القفل/الفتح، صلاحيات الدور، Copilot من بيانات حقيقية، التقاط التدقيق، حالات الفشل/الفراغ) موثّقة كخطة Maestro/Detox — لا تُدّعى مُمرَّة لأنها تتطلب محاكي/جهازًا غير متوفر في بيئة البناء.
- [x] 371 اختبارًا / 40 مجموعة (9 تكامل: 3 دورة بيع + 6 RBAC، و4 اكتمال i18n، + مصانع) + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist29` (ملفات الاختبار خارج حزمة الإنتاج).

## ✅ PHASE 29 — Performance (أداء القوائم والتذكير)

- [x] وحدة أداء مشتركة نقية `shared/performance/list.ts`: قيم نافذة محافظة (`LIST_PERFORMANCE`: initialNumToRender 8، maxToRenderPerBatch 8، windowSize 7، removeClippedSubviews، batching 50ms)، دوال ثبات المفاتيح `stableKey`/`stableKeyWithPrefix` (لا تعتمد على الفهرس المتغيّر فتُعاد الاستفادة من الصفوف)، مقارنة `sameRowIdentity` لـ React.memo، وحساب مواضع الصفوف الثابتة `fixedRowOffset`/`makeFixedLayout` (getItemLayout لقوائم الارتفاع الثابت) — كلها نقية قابلة للاختبار.
- [x] صفوف سجل التدقيق مغلّفة بـ `React.memo` (مكوّن `AuditRow` مستقل يقرأ الثيم/الترجمة بنفسه) و`renderItem` بمرجع ثابت و`keyExtractor={stableKey}` — القائمة الأطول (حتى 1000 مدخلة append-only) لا تُعيد رسم الصفوف غير المتغيّرة عند الفلترة/البحث/التمرير.
- [x] خصائص نافذة التمرير (initialNumToRender/maxToRenderPerBatch/windowSize/removeClippedSubviews/updateCellsBatchingPeriod) مطبّقة على القوائم الأثقل: الطلبات، المنتجات (الكتالوج)، الوكلاء، المزامنة، والتدقيق — بدء أسرع وقفزات أقل عند التمرير مع بقاء الاستجابة فورية.
- [x] 7 اختبارات وحدة للأداء (قيم النافذة، ثبات المفاتيح بالمجال، مقارنة memo، حساب إزاحات الصفوف وgetItemLayout) — 378 اختبارًا / 41 مجموعة + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist30`.

## ✅ PHASE 30 — Production Polish (صقل الإنتاج)

- [x] **حاجز أخطاء شامل** `features/error/CrashBoundary.tsx` + تصدير `ErrorBoundary` من جذر التوجيه: أي خطأ غير ممسوك في شاشة يعرض واجهة انهيار لائقة (داكنة افتراضيًا، رسالة عربية-إنجليزية، زر "إعادة المحاولة" يستدعي `retry`) بدل شاشة بيضاء/حمراء. مكتفٍ ذاتيًا بمكوّنات أساسية وألوان مضمّنة (لا يعتمد على مزودات قد تكون انهارت)؛ تفاصيل الخطأ التقنية تظهر في وضع التطوير فقط.
- [x] **تشديد إعدادات التطبيق** `app.json`: إزالة مكوّن `expo-localization` المكرّر من قائمة الإضافات (كان مُعلنًا مرتين)، ترتيب الإضافات، مع بقاء الهوية والشاشة/الأيقونة المتكيفة ومعرّفات الحزم `ai.majid.pos`.
- [x] **اختبارات صقل الإنتاج** `tests/unit/production/polish.test.ts` (7): صحة صيغة app.json وبيانات الهوية، معرّفات حزم المنصتين، تكوّن الشاشة/الأيقونة، عدم تكرار الإضافات، وجود حقل البيئة، وأن حاجز الأخطاء مكوّن قابل للرسم ولا يستدعي إعادة المحاولة قبل ضغط المستخدم.
- [x] 385 اختبارًا / 42 مجموعة + tsc/lint نظيفان + مبنى Android أخضر `/tmp/majid-dist-final`.

---

## 🎉 اكتمال المشروع — المراحل الـ30 كلها منجزة

أُنجز بناء MAJID POS AI عبر ثلاثين مرحلة متتالية: الأساس والتصميم، نقطة البيع والسلة والدفع، المخزون والمشتريات والعملاء، المالية والموارد البشرية، التقارير، ثم **Offline-First** (طابور الصادر والمزامنة)، **AI Copilot** (فهم لغة محلي)، **AI Agents** (7 وكلاء + خط أمان إجراءات)، **Security** (قفل تلقائي/بصمة/سلامة جهاز)، **Audit Trail** (سجل append-only)، ثم الاختبارات (تكامل + اكتمال i18n + خطة e2e)، الأداء (تذاكر القوائم/memo)، وصقل الإنتاج (حاجز أخطاء + إعدادات).

الأرقام الختامية: **387 اختبارًا / 42 مجموعة**، TypeScript صارم نظيف، ESLint صفر مشاكل، وحزم Android خضراء.

## 🚀 جاهزية الإصدار (إضافة بعد المرحلة 30)

- [x] **`eas.json`**: ثلاث ملامح بناء EAS — `development` (عميل تطوير، APK داخلي)، `preview` (APK معاينة staging)، `production` (AAB إنتاجي مع تزايد رقم النسخة تلقائيًا وملف إرسال داخلي). تُمرَّر البيئة عبر `EXPO_PUBLIC_APP_ENV` التي يقرؤها `core/config/env.ts` (development/staging/production) — مصدر واحد للحقيقة.
- [x] أُزيل حقل `extra.appEnvironment` المكرّر من `app.json` (لم يعد هناك مصدران للبيئة قد يتعارضان).
- [x] اختبارات الصقل تحقّق الآن من ملامح EAS الثلاث وقيم بيئتها (387 اختبارًا)، وحزمة `EXPO_PUBLIC_APP_ENV=production` تُبنى خضراء إلى `/tmp/majid-dist-prod`.

أوامر الإصدار: `eas build -p android --profile production` ثم `eas submit -p android --profile production`.

- [x] **شاشة «عن التطبيق»** `features/about/AboutScreen.tsx` + مسار `/(app)/about` + مدخل في «المزيد» (متاح لكل المستخدمين بلا صلاحية): تعرض الهوية، **رقم الإصدار** (من `constants`)، وشارة **بيئة البناء** (إنتاج/تجريبي/تطوير من `env`)، مع إفصاحين صادقين — أن التطبيق **يعمل دون اتصال ويحفظ البيانات محليًا**، وأن **المساعد الذكي قواعد محلية لا سحابة وهمية**. 12 مفتاح i18n عربي/إنجليزي + 4 اختبارات (391 اختبارًا / 43 مجموعة)، وحزمة إنتاج خضراء.


---

## PHASE 32 — SDK CONTRACTS & VERSIONING ✅

طبقة عقود موحّدة مُنسَّخة (`src/contracts/`) فوق PHASE 31 دون كسر شيء:

- **Semantic Versioning** + مصدر إصدار موحّد (`SDK_VERSION`، `DOMAIN_CONTRACT_VERSIONS` نسخة مستقلة لكل مجال).
- **سجلّ العقود** (current/min/max supported)، **محرّك التوافق** (SDK·عقد·API·مزوّد + تفاوض نسخ مستقبلي).
- **نظام الإهمال** (دورة حياة + بديل + دليل ترحيل + تتبّع استخدام)، **محرّك ترحيل** (سلاسل V1→V2→V3 حتمية).
- **فارق العقود** + **بوابة جودة** تفشل عند كسر بلا رفع MAJOR.
- **عقود Zod مُنسَّخة** لكل المجالات الحرجة + تحقق وقت التشغيل + تحقق مخرجات الذكاء.
- **أكواد أخطاء مستقرة**، **أحداث مُنسَّخة + Upcaster**، **أوامر غير متصلة مُنسَّخة**، **عقود API أساسية** (بلا خادم)، **عقود القدرات**.
- تكامل عبر `sdk.contracts` و `sdk.capabilities`.
- اختبارات: **675 اختبارًا / 56 مجموعة** كلها خضراء + tsc/lint نظيفان.
- وثائق: `CHANGELOG.md`، `docs/contracts-versioning.md`، `docs/migration-guide.md`.
