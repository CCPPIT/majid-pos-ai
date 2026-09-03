/**
 * مجال المصادقة — PHASE 31 · أقسام 11 و44.
 *
 * ملاحظة معمارية: عقد مزوّد المصادقة (`AuthProvider`) وجلسته (`AuthSession`)
 * مُعرَّفان مرة واحدة في النواة (`sdk/core/client/providers`). هذا المجال
 * لا يُعيد تعريفهما — يبني فوقهما خدمة تربط الجلسة بسياق الـSDK.
 *
 * ممنوع منعًا باتًا وضع مفتاح خاص أو سر خدمة داخل هذا المجال (قسم 65):
 * كلمات المرور والرموز تمرّ عبر المنفذ ولا تُخزَّن ولا تُسجَّل هنا إطلاقًا.
 */
import {
  AuthenticationError,
  asBranchId,
  asOrganizationId,
  asRoleId,
  asStoreId,
  asTenantId,
  asUserId,
  createAuditEvent,
  failure,
  success,
  systemClock,
  type AsyncResult,
  type AuditLogger,
  type AuthCredentials,
  type AuthProvider,
  type AuthSession,
  type Clock,
  type ISODateTime,
  type Result,
  type SDKContextStore,
} from '@/sdk/core';

// نعيد تصدير عقود النواة ليستوردها المستهلك من مجال المصادقة.
export type { AuthProvider, AuthSession, AuthCredentials, AuthPrincipal, AuthTokens } from '@/sdk/core';

// الواجهة العلنية لخدمة المصادقة (sdk.auth).
export interface AuthService {
  // يسجّل الدخول ويملأ سياق الـSDK بالكامل.
  login(credentials: AuthCredentials): AsyncResult<AuthSession>;
  // يسجّل الخروج ويمسح السياق.
  logout(): AsyncResult<void>;
  // الجلسة الحالية (null عند غيابها).
  getSession(): AsyncResult<AuthSession | null>;
  // هل المستخدم مصادَق عليه الآن؟
  isAuthenticated(): boolean;
  // يجدّد الجلسة قبل انتهائها.
  refresh(): AsyncResult<AuthSession>;
}

// تبعيات الخدمة.
export interface AuthServiceDependencies {
  readonly provider: AuthProvider; // منفذ المصادقة (عقد النواة).
  readonly contextStore: SDKContextStore; // حاوية السياق.
  readonly audit: AuditLogger; // التدقيق.
  readonly clock?: Clock; // الساعة.
}

// يستخرج نوع بيانات الاعتماد للتسجيل في التدقيق (بلا أي قيمة سرية).
const credentialKind = (credentials: AuthCredentials): string => credentials.kind;

// ينشئ خدمة المصادقة بالحقن.
export const createAuthService = (deps: AuthServiceDependencies): AuthService => {
  // الساعة المستخدمة (محجوزة للتوسعات الزمنية مثل مهلة الجلسة).
  const clock = deps.clock ?? systemClock;

  return {
    // ── تسجيل الدخول ──
    login: async (credentials) => {
      // (1) ننفّذ الدخول عبر المنفذ (الـSDK لا يعرف كيف يتم التحقق).
      const session = await deps.provider.signIn(credentials);
      // (2) الفشل يُسجَّل بنوع الطريقة فقط — لا رمز ولا كلمة مرور ولا جزء منها.
      if (!session.success) {
        deps.audit.record(
          createAuditEvent({
            actor: 'system',
            action: 'auth.login',
            resource: 'session',
            result: 'failure',
            metadata: { method: credentialKind(credentials) },
            timestamp: clock.now(),
          }),
        );
        return session;
      }
      // (3) الهوية العائدة من المزوّد.
      const principal = session.data.principal;
      // (4) نملأ سياق الـSDK — مصدر الحقيقة لكل المجالات بعد هذه اللحظة.
      deps.contextStore.set({
        // كل معرّف يمر بمحوّله الرسمي (لا تحويل قسري بـ as).
        userId: asUserId(principal.userId),
        tenantId: principal.tenantId === undefined ? undefined : asTenantId(principal.tenantId),
        organizationId:
          principal.organizationId === undefined ? undefined : asOrganizationId(principal.organizationId),
        branchId: principal.branchId === undefined ? undefined : asBranchId(principal.branchId),
        storeId: principal.storeId === undefined ? undefined : asStoreId(principal.storeId),
        // أكواد الأدوار تُحوَّل لمعرّفات أدوار مُعلَّمة.
        roleIds: principal.roleCodes.map(asRoleId),
        permissions: principal.permissions,
      });
      // (5) أثر تدقيق للدخول الناجح.
      deps.audit.record(
        createAuditEvent({
          actor: asUserId(principal.userId),
          tenantId: principal.tenantId === undefined ? undefined : asTenantId(principal.tenantId),
          action: 'auth.login',
          resource: 'session',
          metadata: { method: credentialKind(credentials) },
          timestamp: clock.now(),
        }),
      );
      // الجلسة.
      return session;
    },

    // ── تسجيل الخروج ──
    logout: async () => {
      // نقرأ المنفّذ قبل المسح لأجل التدقيق.
      const context = deps.contextStore.get();
      // ننفّذ الخروج عبر المنفذ.
      const result = await deps.provider.signOut();
      // الفشل يُمرَّر كما هو.
      if (!result.success) return result;
      // نمسح السياق كاملًا (لا بقايا صلاحيات بعد الخروج).
      deps.contextStore.clear();
      // أثر التدقيق.
      deps.audit.record(
        createAuditEvent({
          actor: context.userId ?? 'system',
          tenantId: context.tenantId,
          action: 'auth.logout',
          resource: 'session',
          timestamp: clock.now(),
        }),
      );
      // نجاح.
      return success(undefined);
    },

    // ── الجلسة الحالية ──
    getSession: async () => deps.provider.getSession(),

    // ── حالة المصادقة ──
    isAuthenticated: () => {
      // السياق الحالي.
      const context = deps.contextStore.get();
      // المصادقة تعني وجود مستخدم ومستأجر معًا.
      return context.userId !== undefined && context.tenantId !== undefined;
    },

    // ── التجديد ──
    refresh: async () => {
      // نجدّد عبر المنفذ.
      const session = await deps.provider.refresh();
      // الفشل يعني جلسة منتهية غير قابلة للتجديد.
      if (!session.success) return session;
      // نحدّث الصلاحيات في السياق (قد تكون تغيّرت منذ الدخول).
      deps.contextStore.set({
        roleIds: session.data.principal.roleCodes.map(asRoleId),
        permissions: session.data.principal.permissions,
      });
      // الجلسة المجدّدة.
      return session;
    },
  };
};

// يتحقق أن الجلسة ما زالت صالحة زمنيًا (دالة نقية).
export const isSessionValid = (session: AuthSession, now: ISODateTime): boolean =>
  // المقارنة مع لحظة انتهاء الرمز.
  new Date(now).getTime() < new Date(session.tokens.expiresAt).getTime();

// يبني فشل مصادقة موحّدًا (رسالة عامة تمنع تخمين أي الحقلين خاطئ).
export const authFailure = (): Result<never> =>
  failure(new AuthenticationError('sdk.auth.error.invalidCredentials'));
