/**
 * مزود سياق المستأجر (Tenancy Context) — قسم 16.
 * يوفّر السياق النشط (مستأجر/مؤسسة/فرع/متجر) للشاشات والبيانات،
 * يحمّل الهرمية بعد تسجيل الدخول، ويحفظ/يستعيد المتجر النشط.
 */
import {
  createContext, // لإنشاء سياق.
  useCallback, // لتثبيت الدوال.
  useContext, // للقراءة من السياق.
  useEffect, // لتحميل البيانات بعد تسجيل الدخول.
  useMemo, // لحساب القيم المشتقة.
  useState, // لحالة السياق.
  type ReactNode, // نوع الأبناء.
} from 'react';

import { asId, type ID } from '@/core/types/domain';
import { logger } from '@/core/logging/logger';
import type { Session } from '@/domain/identity/types';
import type { Scope } from '@/domain/security/scopes';
import { getRoleByCode } from '@/domain/security'; // لاشتقاق نطاق الدور.
import type { AccessibleStore, TenancyRepository } from '@/data/repositories/tenancy.repository';
import type { TenantData } from '@/data/sources/tenancy.source';
import {
  buildQueryScope, // بناء نطاق الاستعلام.
  toScopeContext, // تحويل السياق لمعرفات خام.
  type ActiveTenancyContext, // نوع السياق النشط.
  type QueryScope, // نوع نطاق الاستعلام.
} from '@/domain/tenancy/scope';

// القيم التي يوفّرها السياق.
export interface TenancyContextValue {
  ready: boolean; // هل حُمّلت الهرمية؟
  context: ActiveTenancyContext | null; // السياق النشط (المتجر المختار…).
  roleScope: Scope; // النطاق الأقصى لدور المستخدم.
  accessibleStores: AccessibleStore[]; // المتاجر التي يمكن تبديلها.
  canSwitchStore: boolean; // هل تبديل المتجر متاح؟
  queryScope: QueryScope | null; // نطاق استعلام البيانات.
  switchStore: (storeId: ID) => Promise<void>; // تبديل المتجر النشط.
  refresh: () => Promise<void>; // إعادة تحميل الهرمية.
}

// السياق نفسه (null خارج المزود).
const TenancyContext = createContext<TenancyContextValue | null>(null);

interface ProviderProps {
  children: ReactNode; // الشجرة.
  repository: TenancyRepository; // مستودع المستأجرين.
  session: Session | null; // الجلسة الحالية (من bootstrap).
  storeSetupCompleted: boolean; // هل أُعدّ المتجر؟ (قبلها لا نحمّل).
}

export function TenancyProvider({ children, repository, session, storeSetupCompleted }: ProviderProps) {
  const [hierarchy, setHierarchy] = useState<TenantData | null>(null); // الهرمية المحمّلة.
  const [context, setContext] = useState<ActiveTenancyContext | null>(null); // السياق النشط.
  const [accessibleStores, setAccessibleStores] = useState<AccessibleStore[]>([]); // المتاجر المتاحة.
  const [ready, setReady] = useState(false); // حالة التحميل.

  // نشتق نطاق الدور من كود دور الجلسة (افتراضي 'store').
  const roleScope: Scope = useMemo(() => {
    const code = session?.user.roleCode; // كود الدور.
    const role = code ? getRoleByCode(code) : undefined; // دور من الفهرس.
    return role?.scope ?? 'store'; // نطاق الدور أو الافتراضي.
  }, [session]);

  // هل تبديل المتجر متاح لهذا النطاق؟
  const canSwitchStore = useMemo(() => repository.canSwitchStore(roleScope), [repository, roleScope]);

  // تحميل الهرمية واختيار المتجر النشط.
  // ملاحظة: الشاشات لا تُركَّب إلا بعد تسجيل الدخول واكتمال الإعداد (الحراسة
  // في المسارات تضمن ذلك)، لذا فإن الجلسة هنا موجودة دائمًا وقت التحميل.
  const load = useCallback(async () => {
    if (!session) return;
    try {
      // 1) نحمّل الهرمية والمتاجر المتاحة.
      const data = await repository.loadHierarchy(String(session.user.id), roleScope);
      const stores = await repository.listAccessibleStores(String(session.user.id), roleScope);
      setHierarchy(data);
      setAccessibleStores(stores);
      // 2) نقرأ المتجر النشط المحفوظ أو نأخذ أول متجر.
      const savedId = await repository.getActiveStoreId();
      const targetId = savedId && data.stores.some((s) => String(s.id) === savedId)
        ? asId(savedId) // محفوظ وصالح.
        : stores[0]?.store.id; // الأول افتراضيًا.
      // 3) نبني السياق على المتجر المختار.
      if (targetId) {
        const ctx = repository.buildContext(data, targetId);
        setContext(ctx);
        if (!savedId) await repository.setActiveStoreId(targetId); // نحفظ الافتراضي.
      }
      setReady(true);
    } catch (error) {
      logger.error('Tenancy load failed', { error: String(error) });
      setReady(false);
    }
  }, [session, roleScope, repository]);

  // نحمّل بعد تسجيل الدخول واكتمال الإعداد. الحالات تُحدَّث فقط بعد نتيجة
  // التحميل (async) لتفادي setState متزامن داخل الـ effect.
  useEffect(() => {
    if (!session || !storeSetupCompleted) return;
    // التحميل async؛ تُحدَّث الحالة فقط بعد وصول البيانات (مثل bootstrap).
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Tenancy load failed', { error: String(error) }));
  }, [session, storeSetupCompleted, load]);

  // تبديل المتجر النشط (يحفظ ويعيد بناء السياق).
  const switchStore = useCallback(
    async (storeId: ID) => {
      if (!hierarchy) return;
      const ctx = repository.buildContext(hierarchy, storeId);
      if (!ctx) return;
      setContext(ctx); // نحدّث السياق فورًا.
      await repository.setActiveStoreId(storeId); // نحفظ الاختيار.
      logger.info('Active store switched', { storeId: String(storeId) });
    },
    [hierarchy, repository],
  );

  // نحسب نطاق استعلام البيانات من السياق + نطاق الدور.
  const queryScope = useMemo(
    () => (context ? buildQueryScope(context, roleScope) : null),
    [context, roleScope],
  );

  // نجمّع قيم السياق.
  const value = useMemo<TenancyContextValue>(
    () => ({
      ready,
      context,
      roleScope,
      accessibleStores,
      canSwitchStore,
      queryScope,
      switchStore,
      refresh: load,
    }),
    [ready, context, roleScope, accessibleStores, canSwitchStore, queryScope, switchStore, load],
  );

  return <TenancyContext.Provider value={value}>{children}</TenancyContext.Provider>;
}

// خطاف القراءة من السياق.
export function useTenancy(): TenancyContextValue {
  const ctx = useContext(TenancyContext);
  if (!ctx) throw new Error('useTenancy must be used within <TenancyProvider>');
  return ctx;
}

// إعادة تصدير أدوات النطاق للراحة في الشاشات.
export { toScopeContext };
