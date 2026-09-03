/**
 * خطاف لوحة التحكم (PHASE 10).
 * يجمع: العناصر المرئية حسب الصلاحيات (من السجل)، والمؤشرات المحمّلة
 * من المستودع بنطاق الاستعلام الحالي، وحالة موحدة (loading/ready/error/empty).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { logger } from '@/core/logging/logger';
import { visibleWidgets, type WidgetDefinition } from '@/domain/security/dashboard-widgets';
import type { DashboardRepository } from '@/data/repositories/dashboard.repository';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import type { DashboardStatus } from '@/domain/dashboard/types';

// ما يعرضه الخطاف للشاشة.
export interface DashboardViewModel {
  status: DashboardStatus; // الحالة الموحدة.
  widgets: WidgetDefinition[]; // العناصر المرئية (مفلترة بالصلاحية).
  contextStoreName: string; // اسم المتجر النشط (للترويسة).
  contextBranchName: string; // اسم الفرع.
  currency: string; // عملة العرض.
  ready: boolean; // هل سياق المستأجر والبيانات جاهزة؟
  refresh: () => Promise<void>; // إعادة التحميل (إعادة المحاولة/السحب).
}

// الخطاف: يستقبل المستودع وصلاحيات المستخدم (يُحقنان من الجذر/الشاشة).
export function useDashboard(repository: DashboardRepository, permissions: readonly string[]): DashboardViewModel {
  const tenancy = useTenancy(); // سياق الاستئجار (النطاق + السياق).
  const [status, setStatus] = useState<DashboardStatus>({ kind: 'loading' }); // الحالة.

  // نطاق الاستعلام والعملة من سياق المستأجر.
  const scope = tenancy.queryScope;
  const currency = tenancy.context?.currency ?? 'YER';
  const contextStoreName = tenancy.context?.storeName ?? '';
  const contextBranchName = tenancy.context?.branchName ?? '';

  // دالة التحميل: تجلب اللقطة وتصنّف الحالة.
  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const snapshot = await repository.getSnapshot(scope, currency); // جلب المؤشرات.
      // لا مؤشرات فعليًا → حالة فراغ.
      if (Object.keys(snapshot.metrics).length === 0) {
        setStatus({ kind: 'empty' });
      } else {
        setStatus({ kind: 'ready', snapshot });
      }
    } catch (error) {
      logger.error('Dashboard load failed', { error: String(error) });
      setStatus({ kind: 'error', messageKey: 'dashboard.loadFailed' });
    }
  }, [repository, scope, currency]);

  // نحمّل/نعيد التحميل عند جاهزية السياق أو تغير النطاق/العملة.
  useEffect(() => {
    if (!tenancy.ready) return; // ننتظر جاهزية المستأجر أولًا.
    // التحميل async لتجنب setState متزامن داخل الـ effect.
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Dashboard effect failed', { error: String(error) }));
  }, [load, tenancy.ready]);

  // عناصر السجل المفلترة بصلاحيات الدور (مرتبة بترتيب السجل الثابت).
  const widgets = useMemo<WidgetDefinition[]>(() => visibleWidgets(permissions), [permissions]);

  return {
    status,
    widgets,
    contextStoreName,
    contextBranchName,
    currency,
    ready: tenancy.ready,
    refresh: load,
  };
}
