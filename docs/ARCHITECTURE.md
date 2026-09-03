# MAJID POS AI — Architecture Reference

## 1. الطبقات

```
┌────────────────────────────────────────────────────────────┐
│  src/app  (Expo Router — screens, layouts, guards)         │  Presentation
├────────────────────────────────────────────────────────────┤
│  src/features  (feature components, view models)           │
├────────────────────────────────────────────────────────────┤
│  Use Cases / Domain Services  (business logic)             │  Application
├────────────────────────────────────────────────────────────┤
│  src/domain/*  (18 bounded contexts, entities, rules)      │  Domain
├────────────────────────────────────────────────────────────┤
│  src/data/repositories  →  src/data/sources                │  Data
│       (Mock اليوم · API غدًا · Local DB للـ Offline)        │
└────────────────────────────────────────────────────────────┘
        ▲ cross-cutting: src/core · src/store · src/security
                         src/offline · src/i18n · src/design-system
```

**القاعدة:** UI ← Feature ← Use Case ← Repository ← Data Source. لا طبقة تتجاوز التي تحتها.

## 2. المجاميع السيادية (Bounded Contexts — 18)

`identity` · `tenancy` · `organization` · `store` · `products` · `sales` ·
`cart` · `payments` · `inventory` · `procurement` · `finance` · `customers` ·
`crm` · `loyalty` · `hr` · `ai` · `analytics` · `security`

كل سياق يملك: types · entities · use-cases · repository interface · events.
السياقات تتواصل عبر **Domain Events** فقط (لا استيراد مباشر بين السياقات).

## 3. نموذج الـ Multi-Tenant

```
Platform
└── Tenant (مستأجر)
    └── Organization (مؤسسة)
        └── Branch (فرع)
            └── Store (متجر)
                └── Users / Roles / Data
```

كل كيان تجاري يحمل: `tenantId` · `organizationId?` · `branchId?` · `storeId?`
(`TenantScoped` في `src/core/types/domain.ts`).

## 4. RBAC (يُبنى في PHASE 07)

```
User → Role(s) → Permissions → Policies → Resources → Actions
Permission { id, resource, action, scope }
Scopes: own · store · branch · organization · tenant · global
```

- الدور لا يحتوي Business Logic — فقط تعيين صلاحيات.
- الصلاحيات قابلة لإعادة الاستخدام بين الأدوار.
- حماية مزدوجة: إخفاء عناصر التنقل + فحص عند الوصول للشاشة/تنفيذ الإجراء.

## 5. حالات البيانات الموحدة

`AsyncState<T>` = `idle | loading | success | error | empty | offline`.
أي شاشة تتعامل مع بيانات يجب أن ترسم كل الحالات — لا شاشة بيضاء أبدًا.

## 6. معالجة الأخطاء

- الطبقات الداخلية ترمي `AppError` typed (Validation / NotFound /
  PermissionDenied / Offline / Conflict / BusinessRule ...).
- حدود الاستخدام تُغلّف بـ `wrap()` / `wrapAsync()` فتعيد `Result<T, AppError>`.
- الـ UI يترجم الخطأ إلى رسالة محلية + حالة Retry حين `retryable === true`.

## 7. المال والحسابات

كل العمليات المالية عبر `src/core/money`:
`Subtotal → Discount → Tax → Total → Payment → Change`.
- تحقق من تطابق العملة، نسبة بين 0–100، كمية غير سالبة.
- تقريب EPSILON-safe لخانتين عشريتين + تحويل للوحدات الصغرى للبوابات.

## 8. الأحداث (Domain Events)

`EventBus<TEvents>` مركزي (`appEventBus`) بأحداث موثقة في `DOMAIN_EVENTS`:
`sale.created` · `payment.completed` · `stock.updated` · `product.created` ·
`customer.created` · `purchase-order.created` · `expense.created` ·
`employee.created` · `sync.queued|completed|failed` · `connectivity.changed`.

## 9. Offline-First (PHASE 23)

```
Sale → Local Storage → Pending Mutation Queue → Connection Restored → Sync
                                                          ↓
                                              Conflict Resolution (يُحسم بإعداد)
```

المزامنة تبث أحداث `sync.*` وتُدخل في Audit Trail.

## 10. الأمان

- بيانات حساسة (session · PIN hash · biometric) في **Secure Storage** فقط.
- اللوججر يعتّم تلقائيًا: password · pin · token · otp · cvv · cardNumber ...
- Audit: User · Action · Resource · Timestamp · Role · Permission · Result.

## 11. AI Safety (PHASE 24/25)

الـ AI لا ينفذ إجراءً حساسًا مباشرة:
```
User → AI → Intent → Permission Check → Validation → Preview → Confirmation → Action
```

## 12. الإعدادات والبيئة

كل متغير بيئة يبدأ بـ `EXPO_PUBLIC_` ويُعرّف ويُتحقق منه عبر Zod في
`src/core/config/env.ts`. لا قراءة مباشرة لـ `process.env` في أي مكان آخر.
