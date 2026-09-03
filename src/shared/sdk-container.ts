/**
 * تركيب ماجد SDK فوق البنية القائمة — PHASE 31 · أقسام 58 و65 و66.
 *
 * هذا الملف هو **الجسر الوحيد** بين الـSDK والتطبيق الحالي. مبدؤه:
 * الـSDK طبقة *تُضاف* لا تستبدل — لا يُعاد كتابة مستودع قائم، ولا تُنسخ
 * بيانات، ولا يُكسر استدعاء موجود. المستودعات الحقيقية تُغلَّف بمحوّلات
 * تحقق عقود الـSDK، والأحداث والتدقيق يُوصَلان بقناتَي التطبيق القائمتين.
 *
 * الترحيل تدريجي (قسم 66): الشاشات تنتقل للـSDK واحدة تلو الأخرى،
 * وما لم ينتقل بعد يظل يعمل بمستودعاته مباشرة دون أي تغيير.
 */
import { appEventBus } from '@/core/events/EventBus';
import { logger } from '@/core/logging/logger';
import { createMajidSDK, type MajidSDK, type SDKRepositories } from '@/sdk';
import {
  asBranchId,
  asOrganizationId,
  asRoleId,
  asStoreId,
  asTenantId,
  asUserId,
  type AuditEvent,
  type AuditLogger,
  type EventPublisher,
  type SDKContext,
  type SDKDomainEvent,
} from '@/sdk/core';
import { createLocalProductRepository } from '@/sdk/products';
import { createLocalRbacRepository } from '@/sdk/rbac';
import { getRoleByCode } from '@/domain/security/roles-catalog';
import type { Session } from '@/domain/identity/types';
import { productsRepository } from './container';

// المنطقة الزمنية الفعّالة للتطبيق (اليمن) — تُقرأ من إعدادات المتجر لاحقًا.
const APP_TIMEZONE = 'Asia/Aden';

/**
 * يحسم معرّف الدور المعتمد في فهرس المنصّة انطلاقًا من كوده.
 * الكود ('cashier') ثابت بين الطبقات، أما المعرّف فمُولَّد في الفهرس،
 * فالمطابقة به وحده تكسر التفويض بصمت.
 */
const resolveRoleId = (roleCode: string | undefined, fallbackId: unknown): string => {
  // بلا كود لا حسم — نُبقي المعرّف كما جاء من الجلسة.
  if (!roleCode) return String(fallbackId);
  // نبحث عن الدور في الفهرس بكوده.
  const role = getRoleByCode(roleCode);
  // وجوده يعني معرّفًا معتمدًا؛ غيابه يُبقي الأصل (فيفشل التفويض بوضوح).
  return role ? String(role.id) : String(fallbackId);
};

/**
 * ناشر أحداث يوصل أحداث الـSDK بناقل أحداث التطبيق القائم.
 *
 * أسماء أحداث الـSDK مسبوقة بـ'sdk.' بينما ناقل التطبيق يعرف أسماءً
 * مسطّحة ('sale.created'). نُسقِط البادئة فتصل الأحداث للمشتركين
 * الحاليين دون تعديل أي مشترك — وما لا يعرفه الناقل يُتجاهل بأمان
 * (النشر لا يجب أن يُسقط عملية تجارية نجحت أصلًا).
 */
const createBridgedEventPublisher = (): EventPublisher => ({
  publish: (event: SDKDomainEvent<string, unknown>) => {
    // الاسم بصيغة ناقل التطبيق (بلا بادئة 'sdk.').
    const legacyName = event.name.startsWith('sdk.') ? event.name.slice(4) : event.name;
    try {
      // الناقل مُقيَّد بأسماء معروفة؛ غير المعروف يُتجاهل بلا ضرر.
      appEventBus.emit(legacyName as Parameters<typeof appEventBus.emit>[0], event.payload);
    } catch (error) {
      // فشل النشر لا يُبطل العملية التي وقعت فعلًا — يُسجَّل فقط.
      logger.warn('SDK event bridge failed', { event: event.name, error: String(error) });
    }
  },
});

/**
 * مُسجّل تدقيق يكتب أحداث الـSDK في سجل التطبيق.
 *
 * ملاحظة أمنية مقصودة: نمرّر الحقول الوصفية فقط. حمولات العمليات قد
 * تحوي بيانات عميل أو مبالغ، وسجل التدقيق يُقرأ من شاشات أوسع صلاحية،
 * فنكتفي بما يثبت *من فعل ماذا ومتى* دون تفاصيل قد تُسرّب.
 */
const createBridgedAuditLogger = (): AuditLogger => ({
  record: (event: AuditEvent) => {
    // نكتب في سجل التطبيق عبر قناة السجلات الموحّدة.
    logger.info('audit', {
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId ?? '',
      actor: String(event.actor),
      timestamp: event.timestamp,
      // نتيجة العملية (نجاح/فشل) مهمة للتدقيق.
      result: event.result,
    });
  },
});

/**
 * يبني سياق الـSDK من جلسة التطبيق.
 *
 * الجلسة هي مصدر الحقيقة الوحيد للهوية والصلاحيات. غياب الجلسة يعني
 * سياقًا فارغًا — والـSDK يرفض حينها كل عملية تحتاج مستأجرًا
 * (`ContextError`)، وهو السلوك الصحيح: لا عمليات بلا هوية مؤكدة.
 */
export const contextFromSession = (session: Session | null): SDKContext => {
  // بلا جلسة: سياق فارغ يمنع كل عملية تحتاج نطاقًا.
  if (!session) {
    return { roleIds: [], permissions: [], locale: 'ar', currency: 'YER', timezone: APP_TIMEZONE };
  }
  // المستخدم صاحب الجلسة.
  const { user } = session;
  return {
    userId: asUserId(String(user.id)),
    tenantId: asTenantId(String(user.tenantId)),
    // الحقول الاختيارية تُحوَّل فقط متى وُجدت.
    organizationId: user.organizationId ? asOrganizationId(String(user.organizationId)) : undefined,
    branchId: user.branchId ? asBranchId(String(user.branchId)) : undefined,
    storeId: user.storeId ? asStoreId(String(user.storeId)) : undefined,
    // الأدوار: نحسمها بكود الدور لا بمعرّفه.
    //
    // سبب ذلك فارق حقيقي بين المصدرين: الجلسة تحمل معرّفًا مبسّطًا
    // ('role-cashier') بينما فهرس المنصّة يولّد معرّفات مرقّمة
    // ('role-cashier-23'). المطابقة بالمعرّف تفشل صامتة فيسقط نطاق
    // المستخدم إلى 'own' وتُمنع كل عملية. الكود هو المُعرّف المستقر
    // بين الطبقتين، فنحسم به ونرجع للمعرّف الخام متى غاب.
    roleIds: [asRoleId(String(resolveRoleId(user.roleCode, user.roleId)))],
    // الصلاحيات المسطّحة كما أصدرتها الجلسة.
    permissions: session.permissions,
    locale: 'ar',
    currency: 'YER',
    timezone: APP_TIMEZONE,
  };
};

/**
 * يبني حزمة المستودعات التي يحتاجها الـSDK.
 *
 * ما له محوّل جاهز يُغلَّف الآن (المنتجات فوق `AppProductsRepository`،
 * والصلاحيات فوق فهرس المنصّة). وما لم يُغلَّف بعد (فواتير · دفعات ·
 * مخزون · عملاء) يُمرَّر تنفيذه هنا عند بنائه في مراحل الترحيل التالية
 * بترتيب قسم 66: Products → Cart → POS → Sales → Payments → Inventory.
 */
export const buildSDKRepositories = (
  // المستودعات التي بُني لها محوّل بعد (تُمرَّر من الاستدعاء).
  pending: Omit<SDKRepositories, 'products' | 'rbac'>,
  // مصدر المستأجر النشط للمحوّلات التي تحتاجه.
  tenantIdOf: () => SDKContext['tenantId'],
): SDKRepositories => ({
  // المنتجات: محوّل فوق مستودع التطبيق القائم (غير معدَّل).
  products: createLocalProductRepository({ legacy: productsRepository, defaultTenantId: tenantIdOf }),
  // الصلاحيات: محوّل فوق فهرس الأدوار والصلاحيات القائم.
  rbac: createLocalRbacRepository(),
  // البقية تُمرَّر كما هي حتى تُبنى محوّلاتها.
  ...pending,
});

// خيارات إنشاء نسخة الـSDK للتطبيق.
export interface CreateAppSDKOptions {
  readonly session: Session | null; // الجلسة الحالية.
  readonly repositories: Omit<SDKRepositories, 'products' | 'rbac'>; // المستودعات غير المُغلَّفة بعد.
  readonly taxRatePercent?: number; // نسبة الضريبة الفعّالة للمتجر.
}

/**
 * ينشئ نسخة SDK جاهزة للتطبيق بجلسة محددة.
 *
 * تُستدعى من طبقة التركيب (مزوّد React) لا من شاشة: الشاشة تستهلك
 * الـSDK ولا تركّبه، حفاظًا على اتجاه الاعتماد SDK → Use Case → UI.
 */
export const createAppSDK = (options: CreateAppSDKOptions): MajidSDK => {
  // السياق المشتق من الجلسة.
  const context = contextFromSession(options.session);
  // التركيب الكامل بالحقن عبر الواجهات وحدها.
  return createMajidSDK({
    context,
    repositories: buildSDKRepositories(options.repositories, () => context.tenantId),
    // الأحداث والتدقيق موصولان بقناتَي التطبيق القائمتين.
    events: createBridgedEventPublisher(),
    audit: createBridgedAuditLogger(),
    defaultTaxRatePercent: options.taxRatePercent,
  });
};
