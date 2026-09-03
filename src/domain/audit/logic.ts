/**
 * منطق سجل التدقيق النقي (PHASE 27).
 * يحوّل أحداث المجال إلى مدخلات تدقيق ثابتة، ويفلتر/يلخّص السجل. لا تخزين
 * ولا ترجمة هنا — فقط تحويل وقراءة، سهل الاختبار ومستقل عن المنصات.
 */
import type { DomainEventName } from '@/core/events/EventBus';
import type {
  AuditAction,
  AuditCategory,
  AuditEntry,
  AuditFilter,
  AuditSeverity,
  AuditSummary,
} from './types';

// المنفّذ الافتراضي (إجراء محلي على الجهاز بلا مستخدم مميّز).
export const DEVICE_ACTOR = { id: 'device', label: 'device' };

// وصف ربط كل حدث مجال بمدخلة التدقيق.
interface EventMapping {
  action: AuditAction; // الفئة.
  category: Exclude<AuditCategory, 'all'>; // المجال.
  severity: AuditSeverity; // الأهمية.
  summaryKey: string; // مفتاح نص الملخص.
}

// خريطة أحداث المجال → مدخلة تدقيق (أحداث الكتابة المهمة فقط؛ أحداث المزامنة/الاتصال ضجيج تُستبعد).
const EVENT_MAP: Partial<Record<DomainEventName, EventMapping>> = {
  'sale.created': { action: 'sale_created', category: 'sales', severity: 'info', summaryKey: 'audit.entry.sale_created' },
  'payment.completed': { action: 'payment_completed', category: 'payments', severity: 'sensitive', summaryKey: 'audit.entry.payment_completed' },
  'product.created': { action: 'product_created', category: 'catalog', severity: 'info', summaryKey: 'audit.entry.product_created' },
  'customer.created': { action: 'customer_created', category: 'customers', severity: 'info', summaryKey: 'audit.entry.customer_created' },
  'purchase-order.created': { action: 'purchase_order_created', category: 'procurement', severity: 'info', summaryKey: 'audit.entry.purchase_order_created' },
  'stock.updated': { action: 'stock_updated', category: 'inventory', severity: 'info', summaryKey: 'audit.entry.stock_updated' },
  'expense.created': { action: 'expense_created', category: 'finance', severity: 'sensitive', summaryKey: 'audit.entry.expense_created' },
  'employee.created': { action: 'employee_created', category: 'hr', severity: 'info', summaryKey: 'audit.entry.employee_created' },
};

// عدّاد تسلسلي لمعرّفات المدخلات.
let seq = 0;

// يقرأ أول قيمة نصية/رقمية موجودة من الحمولة عبر مفاتيح متعددة.
function pick(payload: Record<string, unknown> | null, ...keys: string[]): string | undefined {
  if (!payload) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

// بيانات المنفّذ.
export interface AuditActor {
  id: string; // المعرف.
  label: string; // التسمية.
}

// يبني مدخلة تدقيق من حدث مجال (يعيد undefined إن لم يكن الحدث مدقَّقًا).
export function entryFromDomainEvent(
  eventType: DomainEventName,
  payload: unknown,
  actor: AuditActor = DEVICE_ACTOR,
  now: string = new Date().toISOString(),
): AuditEntry | null {
  const mapping = EVENT_MAP[eventType];
  if (!mapping) return null; // حدث غير مُدقَّق (مزامنة/اتصال/غير معروف).

  const data = (payload ?? {}) as Record<string, unknown>;
  seq += 1;

  // نستخرج المرجع البشري ومعاملات الترجمة حسب نوع الحدث.
  let entityRef: string | undefined;
  const summaryParams: Record<string, string | number> = {};

  switch (mapping.action) {
    case 'sale_created':
      entityRef = pick(data, 'orderNumber', 'orderId');
      summaryParams.ref = entityRef ?? '';
      break;
    case 'payment_completed':
      entityRef = pick(data, 'orderNumber', 'orderId');
      summaryParams.ref = entityRef ?? '';
      summaryParams.method = pick(data, 'method') ?? '';
      break;
    case 'product_created':
      entityRef = pick(data, 'nameAr', 'name', 'sku', 'productId', 'id');
      summaryParams.ref = entityRef ?? '';
      break;
    case 'customer_created':
      entityRef = pick(data, 'fullName', 'name', 'phone', 'customerId', 'id');
      summaryParams.ref = entityRef ?? '';
      break;
    case 'purchase_order_created':
      entityRef = pick(data, 'orderNumber', 'supplierNameAr', 'supplierName', 'id');
      summaryParams.ref = entityRef ?? '';
      break;
    case 'stock_updated':
      entityRef = pick(data, 'productName', 'nameAr', 'productId');
      summaryParams.ref = entityRef ?? '';
      if (pick(data, 'quantity')) summaryParams.quantity = pick(data, 'quantity') as string;
      break;
    case 'expense_created':
      entityRef = pick(data, 'category', 'note', 'id');
      summaryParams.ref = entityRef ?? '';
      if (pick(data, 'amount')) summaryParams.amount = pick(data, 'amount') as string;
      break;
    case 'employee_created':
      entityRef = pick(data, 'fullName', 'name', 'id');
      summaryParams.ref = entityRef ?? '';
      break;
    default:
      break;
  }

  return {
    id: `audit-${Date.now()}-${seq}`,
    action: mapping.action,
    category: mapping.category,
    severity: mapping.severity,
    summaryKey: mapping.summaryKey,
    summaryParams,
    actorId: actor.id,
    actorLabel: actor.label,
    entityRef,
    occurredAt: now,
  };
}

// يبني مدخلة تدقيق مباشرة (لأحداث الأمان: قفل/فتح/خروج/إعدادات).
export function makeSecurityEntry(
  action: Extract<AuditAction, 'app_locked' | 'app_unlocked' | 'security_settings_changed' | 'session_signed_out'>,
  summaryKey: string,
  severity: AuditSeverity,
  actor: AuditActor = DEVICE_ACTOR,
  summaryParams: Record<string, string | number> = {},
  now: string = new Date().toISOString(),
): AuditEntry {
  seq += 1;
  return {
    id: `audit-${Date.now()}-${seq}`,
    action,
    category: 'security',
    severity,
    summaryKey,
    summaryParams,
    actorId: actor.id,
    actorLabel: actor.label,
    occurredAt: now,
  };
}

// يفلتر المدخلات (الأحدث أولًا) حسب المرشّح.
export function filterEntries(entries: readonly AuditEntry[], filter: AuditFilter = {}): AuditEntry[] {
  const search = filter.search?.trim().toLowerCase();
  return entries
    .filter((e) => {
      if (filter.category && e.category !== filter.category) return false; // مجال.
      if (filter.severity && e.severity !== filter.severity) return false; // أهمية.
      if (filter.since && e.occurredAt < filter.since) return false; // بداية.
      if (filter.until && e.occurredAt > filter.until) return false; // نهاية.
      if (search) {
        const hay = `${e.entityRef ?? ''} ${e.actorLabel} ${e.action}`.toLowerCase();
        if (!hay.includes(search)) return false; // نص.
      }
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); // الأحدث أولًا.
}

// يلخّص السجل إحصائيًا.
export function summarizeAudit(entries: readonly AuditEntry[]): AuditSummary {
  const summary: AuditSummary = {
    total: entries.length,
    byCategory: {},
    bySeverity: { info: 0, sensitive: 0, security: 0 },
    securityCount: 0,
  };
  for (const e of entries) {
    // عدّ لكل مجال (عدا 'all' الفلتري).
    if (e.category !== 'all') {
      summary.byCategory[e.category] = (summary.byCategory[e.category] ?? 0) + 1;
    }
    summary.bySeverity[e.severity] = (summary.bySeverity[e.severity] ?? 0) + 1;
    if (e.category === 'security') summary.securityCount += 1;
  }
  return summary;
}
