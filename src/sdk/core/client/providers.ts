/**
 * عقود المزوّدات (Provider Abstractions) — PHASE 31 · قسم 39.
 * الـSDK لا يعرف مزوّدًا واحدًا بعينه: يعرّف واجهات ويستقبل تنفيذها بالحقن.
 * يُمنع منعًا باتًا وضع مفاتيح/أسرار خادم داخل هذه الطبقة (قسم 65).
 */
import type { Result } from '../result/result';
import type { Money } from '../types/money';
import type { ISODateTime } from '../types/datetime';
import type { SDKContext } from '../context/sdk-context';
import type { DeviceId, PaymentId, SaleId } from '../identifiers/ids';

/** ─────────────── مزوّد المصادقة (AuthProvider) — قسم 11 ─────────────── */

// رموز الوصول التي يعيدها مزوّد المصادقة.
export interface AuthTokens {
  readonly accessToken: string; // رمز الوصول (يُخزَّن في التخزين الآمن فقط).
  readonly refreshToken?: string; // رمز التجديد (اختياري حسب المزوّد).
  readonly expiresAt: ISODateTime; // لحظة انتهاء الصلاحية.
  readonly tokenType: 'Bearer' | 'Opaque'; // نوع الرمز.
}

// بيانات هوية المستخدم كما يعيدها المزوّد (بدون أسرار).
export interface AuthPrincipal {
  readonly userId: string; // معرّف المستخدم.
  readonly displayName: string; // الاسم المعروض.
  readonly tenantId?: string; // المستأجر.
  readonly organizationId?: string; // المؤسسة.
  readonly branchId?: string; // الفرع.
  readonly storeId?: string; // المتجر الافتراضي.
  readonly roleCodes: readonly string[]; // أكواد الأدوار.
  readonly permissions: readonly string[]; // الصلاحيات المسطّحة.
}

// بيانات الاعتماد المقبولة عند تسجيل الدخول (اتحاد مميّز حسب الطريقة).
export type AuthCredentials =
  | { readonly kind: 'pin'; readonly pin: string } // رقم سري.
  | { readonly kind: 'otp'; readonly identifier: string; readonly code: string } // رمز تحقق.
  | { readonly kind: 'biometric'; readonly promptMessage: string } // بصمة/وجه.
  | { readonly kind: 'token'; readonly token: string }; // استئناف بجلسة محفوظة.

// جلسة كاملة: الهوية + الرموز + الطوابع.
export interface AuthSession {
  readonly principal: AuthPrincipal; // الهوية.
  readonly tokens: AuthTokens; // الرموز.
  readonly issuedAt: ISODateTime; // لحظة الإصدار.
}

// عقد مزوّد المصادقة (محلي اليوم، خادم غدًا — دون تغيير أي شاشة).
export interface AuthProvider {
  readonly id: string; // معرّف المزوّد (للسجلات).
  // يسجّل الدخول ببيانات اعتماد ويُعيد جلسة.
  signIn(credentials: AuthCredentials): Promise<Result<AuthSession>>;
  // ينهي الجلسة الحالية.
  signOut(): Promise<Result<void>>;
  // يجدّد الجلسة (رمز جديد قبل الانتهاء).
  refresh(refreshToken?: string): Promise<Result<AuthSession>>;
  // يقرأ الجلسة المحفوظة إن وُجدت (null عند غيابها).
  getSession(): Promise<Result<AuthSession | null>>;
}

/** ─────────────── مزوّد التخزين (StorageProvider) — قسم 31 ─────────────── */

// عقد التخزين المفتاح/قيمة (عادي أو آمن حسب التنفيذ المحقون).
export interface StorageProvider {
  readonly id: string; // معرّف المزوّد.
  readonly secure: boolean; // هل التخزين مشفّر (Secure Store)؟
  // يقرأ نصًّا بمفتاح (null عند الغياب).
  get(key: string): Promise<Result<string | null>>;
  // يكتب نصًّا بمفتاح.
  set(key: string, value: string): Promise<Result<void>>;
  // يحذف مفتاحًا.
  remove(key: string): Promise<Result<void>>;
  // يسرد المفاتيح ببادئة محددة (للتنظيف والهجرة).
  keys(prefix?: string): Promise<Result<readonly string[]>>;
}

/** ─────────────── مزوّد الشبكة (NetworkProvider) — قسم 31 ─────────────── */

// أفعال HTTP المدعومة.
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// طلب شبكي مجرّد (لا يعرف الـSDK تفاصيل النقل).
export interface NetworkRequest {
  readonly method: HttpMethod; // الفعل.
  readonly path: string; // المسار النسبي (يُركَّب على عنوان الأساس).
  readonly query?: Readonly<Record<string, string | number | boolean>>; // معاملات الاستعلام.
  readonly body?: unknown; // الجسم (يُسلسل في التنفيذ).
  readonly headers?: Readonly<Record<string, string>>; // ترويسات إضافية.
  readonly timeoutMs?: number; // مهلة العملية.
}

// استجابة شبكية مجرّدة.
export interface NetworkResponse<T = unknown> {
  readonly status: number; // كود الحالة.
  readonly data: T; // الجسم المفكوك.
  readonly headers: Readonly<Record<string, string>>; // ترويسات الاستجابة.
}

// حالة الاتصال الحالية.
export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

// عقد مزوّد الشبكة.
export interface NetworkProvider {
  readonly id: string; // معرّف المزوّد.
  // ينفّذ طلبًا ويُعيد استجابة أو خطأ مصنّفًا.
  request<T>(request: NetworkRequest): Promise<Result<NetworkResponse<T>>>;
  // يقرأ حالة الاتصال الحالية.
  connectivity(): Promise<ConnectivityStatus>;
  // يشترك في تغيّر حالة الاتصال ويُعيد دالة إلغاء.
  onConnectivityChange(listener: (status: ConnectivityStatus) => void): () => void;
}

/** ─────────────── مزوّد الدفع (PaymentProvider) — قسم 19 ─────────────── */

// طرق الدفع المجرّدة (قابلة للتوسع دون كسر العقد).
export type PaymentMethodKind = 'cash' | 'card' | 'qr' | 'wallet' | 'other';

// طلب تفويض دفعة لدى المزوّد.
export interface PaymentAuthorizationRequest {
  readonly paymentId: PaymentId; // معرّف الدفعة المحلي.
  readonly saleId: SaleId; // الفاتورة المرتبطة.
  readonly reference: string; // مرجع بشري (رقم الفاتورة).
  readonly method: PaymentMethodKind; // الطريقة.
  readonly amount: Money; // المبلغ.
}

// نتيجة عملية لدى المزوّد.
export interface PaymentProviderResult {
  readonly providerReference: string; // مرجع العملية لدى المزوّد.
  readonly authorized: boolean; // هل تم التفويض؟
  readonly captured: boolean; // هل تم التحصيل؟
  readonly at: ISODateTime; // لحظة العملية.
}

// عقد مزوّد الدفع (نقدي محلي · بوابة خارجية لاحقًا).
export interface PaymentProvider {
  readonly id: string; // معرّف المزوّد.
  // هل يدعم هذه الطريقة؟
  supports(method: PaymentMethodKind): boolean;
  // يفوّض المبلغ (حجزه دون تحصيل).
  authorize(request: PaymentAuthorizationRequest): Promise<Result<PaymentProviderResult>>;
  // يحصّل مبلغًا مفوَّضًا سابقًا.
  capture(providerReference: string, amount: Money): Promise<Result<PaymentProviderResult>>;
  // يلغي تفويضًا قبل التحصيل.
  cancel(providerReference: string): Promise<Result<PaymentProviderResult>>;
  // يسترجع مبلغًا محصَّلًا (كليًا أو جزئيًا).
  refund(providerReference: string, amount: Money): Promise<Result<PaymentProviderResult>>;
}

/** ─────────────── مزوّد الإشعارات (NotificationProvider) ─────────────── */

// قناة الإشعار.
export type NotificationChannel = 'local' | 'push' | 'inApp';

// إشعار مجرّد.
export interface NotificationMessage {
  readonly channel: NotificationChannel; // القناة.
  readonly titleKey: string; // مفتاح ترجمة العنوان.
  readonly bodyKey: string; // مفتاح ترجمة النص.
  readonly params?: Readonly<Record<string, string | number>>; // معاملات الترجمة.
  readonly deeplink?: string; // مسار داخلي عند النقر.
}

// عقد مزوّد الإشعارات.
export interface NotificationProvider {
  readonly id: string; // معرّف المزوّد.
  // يرسل إشعارًا.
  send(message: NotificationMessage): Promise<Result<void>>;
}

/** ─────────────── مزوّد الذكاء الاصطناعي (AIProvider) — قسم 39 ─────────── */

// طلب توليد للذكاء الاصطناعي.
export interface AIGenerationRequest {
  readonly prompt: string; // نص المستخدم.
  readonly locale: 'ar' | 'en'; // لغة الرد.
  // حقائق أعمال حقيقية تُحقن كسياق (لا يخترع النموذج أرقامًا).
  readonly facts?: Readonly<Record<string, string | number>>;
  readonly maxTokens?: number; // حد الطول (للمزوّد البعيد).
}

// رد الذكاء الاصطناعي.
export interface AIGenerationResponse {
  readonly text: string; // النص الناتج.
  readonly confidence: number; // درجة الثقة 0..1.
  readonly provider: string; // المزوّد الذي ولّد الرد.
  readonly at: ISODateTime; // لحظة التوليد.
}

// عقد مزوّد الذكاء الاصطناعي (قواعد محلية اليوم · نموذج سحابي لاحقًا).
export interface AIProvider {
  readonly id: string; // معرّف المزوّد.
  // هل المزوّد متاح الآن (مفتاح تشغيل/اتصال)؟
  isAvailable(): boolean;
  // يولّد ردًّا نصيًّا من طلب.
  generate(request: AIGenerationRequest): Promise<Result<AIGenerationResponse>>;
}

/** ─────────────── مزوّد التحليلات (AnalyticsProvider) ─────────────── */

// حدث تحليلي (سلوك الاستخدام لا بيانات الأعمال الحساسة).
export interface AnalyticsEvent {
  readonly name: string; // اسم الحدث.
  readonly properties?: Readonly<Record<string, string | number | boolean>>; // خصائصه.
}

// عقد مزوّد التحليلات.
export interface AnalyticsProvider {
  readonly id: string; // معرّف المزوّد.
  // يتتبّع حدثًا سلوكيًا.
  track(event: AnalyticsEvent): void;
}

/** ─────────────── مزوّد المصادقة الحيوية (BiometricProvider) ─────────── */

// نتيجة محاولة المصادقة الحيوية.
export interface BiometricOutcome {
  readonly success: boolean; // هل نجحت؟
  readonly reason?: string; // مفتاح سبب الفشل.
}

// عقد المصادقة الحيوية.
export interface BiometricProvider {
  readonly id: string; // معرّف المزوّد.
  // هل الجهاز يدعم البصمة/الوجه ومسجّل فيه بيانات؟
  isAvailable(): Promise<boolean>;
  // يطلب مصادقة حيوية برسالة محددة.
  authenticate(promptMessage: string): Promise<Result<BiometricOutcome>>;
}

/** ─────────────── مزوّد الجهاز (DeviceProvider) ─────────────── */

// معلومات الجهاز غير الحساسة.
export interface DeviceInfo {
  readonly deviceId: DeviceId; // معرّف الجهاز.
  readonly platform: 'ios' | 'android' | 'unknown'; // المنصة.
  readonly isEmulator: boolean; // هل محاكي؟
}

// عقد مزوّد الجهاز.
export interface DeviceProvider {
  readonly id: string; // معرّف المزوّد.
  // يقرأ معلومات الجهاز الحالية.
  info(): Promise<DeviceInfo>;
}

/** ─────────────── حزمة المزوّدات ─────────────── */

/**
 * الفهرس الكامل لمنافذ المنصّة الممكنة (المرجع المعماري لقسم 42).
 *
 * ملاحظة تسمية مقصودة: هذا العقد يصف *كل* ما يمكن وصله بالـSDK نظريًا،
 * بينما `SDKProviders` في `client/majid-sdk.ts` يصف ما يقبله
 * `createMajidSDK` فعليًا اليوم. مفهومان مختلفان فاسمان مختلفان —
 * توحيدهما تحت اسم واحد يخلق تصديرين متنافسين من الحاجز العلني.
 */
export interface PlatformProviderPorts {
  readonly auth?: AuthProvider; // المصادقة.
  readonly storage?: StorageProvider; // التخزين.
  readonly secureStorage?: StorageProvider; // التخزين الآمن.
  readonly network?: NetworkProvider; // الشبكة.
  readonly payment?: PaymentProvider; // الدفع.
  readonly notifications?: NotificationProvider; // الإشعارات.
  readonly ai?: AIProvider; // الذكاء الاصطناعي.
  readonly analytics?: AnalyticsProvider; // التحليلات.
  readonly biometric?: BiometricProvider; // المصادقة الحيوية.
  readonly device?: DeviceProvider; // الجهاز.
}

// عقد التفويض الذي يستخدمه الـSDK قبل كل عملية حسّاسة (قسم 57).
export interface AuthorizationGate {
  // هل يملك السياق الإذن المطلوب؟ (نتيجة منطقية فقط؛ الخطأ يبنيه المستدعي).
  isAllowed(context: SDKContext, permission: string): boolean;
}
