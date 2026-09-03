/**
 * خط أمان إجراءات الوكلاء (Action Safety Pipeline) — PHASE 25.
 * مبدأ: الوكلاء للقراءة فقط. أي رؤية تخص مجالًا لا يملك المستخدم صلاحية
 * قراءته تُحذف كاملة (لا تسريب بيانات)، والإجراء المقترح يظهر فقط لمن يملك
 * صلاحيته. الأهم: لا يوجد أي تنفيذ تلقائي للكتابة — الإجراء ينقل المستخدم
 * إلى الشاشة المعنية ليتصرف بنفسه (إخفاء الواجهة ليس أمنًا؛ هنا نتحقق أيضًا).
 */
import { hasPermission } from '@/security/permissions/permission';
import { AGENT_BY_ID } from './agents-catalog';
import type { AgentInsight } from './types';

// نتيجة تمرير الرؤى عبر خط الأمان.
export interface SafeInsights {
  visible: AgentInsight[]; // الرؤى المسموح برؤيتها (مع إجراءات مُفلترة).
  hiddenCount: number; // عدد الرؤى المحجوبة (لمعلوماتية المستخدم إن لزم).
}

// يطبّق خط الأمان: فلترة الرؤى حسب الصلاحيات و فلترة أزرار الإجراءات.
export function applySafetyPipeline(
  insights: readonly AgentInsight[],
  permissions: readonly string[],
): SafeInsights {
  const visible: AgentInsight[] = [];
  let hiddenCount = 0;

  for (const insight of insights) {
    const agent = AGENT_BY_ID[insight.agentId];
    // إن لم يملك المستخدم صلاحية قراءة مجال الوكيل، تُحجب الرؤية كاملةً.
    if (!hasPermission(permissions, agent.requiredPermission)) {
      hiddenCount += 1;
      continue;
    }
    // زر الإجراء يظهر فقط لمن يملك صلاحيته (وإلا يُزال الزر مع بقاء الرؤية).
    const action =
      insight.action && hasPermission(permissions, insight.action.permission) ? insight.action : undefined;
    visible.push(action === insight.action ? insight : { ...insight, action });
  }

  return { visible, hiddenCount };
}
