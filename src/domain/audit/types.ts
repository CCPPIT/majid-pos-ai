/**
 * أنواع سجل التدقيق (Audit Trail) — PHASE 27.
 * سجل غير قابل للتعديل (append-only) يلتزم من فعل ماذا ومتى وأي مجال.
 * كل عملية كتابة مهمة في المتجر تُسجَّل كمدخلة تدقيق لأغراض التتبع والمساءلة.
 * منطق نقي هنا؛ التخزين والالتقاط في طبقتي البيانات والأمان. كل سطر بتعليق عربي.
 */
import type { ISODateString } from '@/core/types/domain';

// فئة الإجراء المُدقَّق (نوع العملية).
export type AuditAction =
  | 'sale_created' // إنشاء عملية بيع.
  | 'payment_completed' // إتمام دفعة.
  | 'product_created' // إنشاء منتج.
  | 'customer_created' // إنشاء عميل.
  | 'purchase_order_created' // إنشاء أمر شراء.
  | 'stock_updated' // تحديث مخزون.
  | 'expense_created' // إنشاء مصروف.
  | 'employee_created' // إنشاء موظف.
  | 'app_locked' // قفل التطبيق.
  | 'app_unlocked' // فتح القفل (PIN/بصمة).
  | 'security_settings_changed' // تغيير إعدادات الأمان.
  | 'session_signed_out'; // تسجيل خروج.

// مستوى خطورة/أهمية المدخلة.
export type AuditSeverity = 'info' | 'sensitive' | 'security';

// مدخلة تدقيق واحدة (ثابتة بعد الإنشاء).
export interface AuditEntry {
  id: string; // معرف فريد.
  action: AuditAction; // الفئة.
  category: AuditCategory; // المجال (للفلترة/الأيقونة).
  severity: AuditSeverity; // الأهمية.
  // وصف بشري مُترجَم لاحقًا (مفتاح + معاملات).
  summaryKey: string; // مفتاح نص الملخص.
  summaryParams: Record<string, string | number>; // معاملات الترجمة.
  actorId: string; // منفّذ الإجراء (معرف المستخدم أو 'system'/'device').
  actorLabel: string; // تسمية المنفّذ (رقم/اسم) للعرض.
  entityRef?: string; // مرجع الكيان (رقم طلب/دفعة…).
  occurredAt: ISODateString; // لحظة الحدوث.
}

// المجالات القابلة للفلترة.
export type AuditCategory =
  | 'sales' // مبيعات.
  | 'payments' // مدفوعات.
  | 'inventory' // مخزون.
  | 'catalog' // منتجات.
  | 'customers' // عملاء.
  | 'procurement' // مشتريات.
  | 'finance' // مالية.
  | 'hr' // موارد بشرية.
  | 'security' // أمان/جلسة.
  | 'all'; // (للفلترة فقط)

// مرشّح استعلام السجل.
export interface AuditFilter {
  category?: Exclude<AuditCategory, 'all'>; // مجال محدد.
  severity?: AuditSeverity; // أهمية محددة.
  since?: ISODateString; // بداية الفترة.
  until?: ISODateString; // نهاية الفترة.
  search?: string; // نص بحث في المرجع/المنفّذ.
}

// ملخص إحصائيات السجل.
export interface AuditSummary {
  total: number; // إجمالي المدخلات.
  byCategory: Partial<Record<Exclude<AuditCategory, 'all'>, number>>; // لكل مجال.
  bySeverity: Record<AuditSeverity, number>; // لكل أهمية.
  securityCount: number; // مدخلات الأمان (قفل/فتح/إعدادات/خروج).
}
