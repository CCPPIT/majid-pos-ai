/**
 * مصدر تخزين سجل التدقيق (PHASE 27).
 * سجل append-only يُحفظ كـ JSON على الجهاز. القراءة آمنة (تعيد قائمة فارغة
 * عند الفساد)، والإلحاق ذرّي (قراءة-تعديل-كتابة كاملة) مع حد أقصى للحجم
 * يحتفظ بالأحدث. يطبّع الطوابع الزمنية لتفادي فشل سلاسل المقارنة.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { AuditEntry } from '@/domain/audit';

// واجهة المخزن النصي (مثل مصدر المزامنة/التفضيلات).
export interface AuditStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// واجهة مصدر السجل.
export interface AuditLogSource {
  list(): Promise<AuditEntry[]>; // كل المدخلات (الأحدث أولًا).
  appendAll(entries: AuditEntry[]): Promise<void>; // إلحاق دفعة ذرّي.
  replaceAll(entries: AuditEntry[]): Promise<void>; // استبدال كامل (للتقليم).
}

// أقصى عدد مدخلات محفوظة (يحتفظ بالأحدث بعد التقليم).
const MAX_ENTRIES = 1000;

// قراءة آمنة للقائمة من المخزن.
async function read(store: AuditStore): Promise<AuditEntry[]> {
  try {
    const raw = await store.getString(STORAGE_KEYS.auditLog);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { entries: AuditEntry[] } | AuditEntry[];
    const list = Array.isArray(parsed) ? parsed : parsed.entries ?? [];
    // نطبّع الطوابع لسلسلة قابلة للمقارنة ونرتب الأحدث أولًا.
    return list
      .map((e) => ({ ...e, occurredAt: typeof e.occurredAt === 'string' ? e.occurredAt : new Date().toISOString() }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  } catch (error) {
    logger.warn('Audit log read failed', { error: String(error) });
    return [];
  }
}

// المصدر المحلي للسجل.
export class LocalAuditLogSource implements AuditLogSource {
  constructor(private readonly store: AuditStore) {} // نستقبل المخزن.

  async list(): Promise<AuditEntry[]> {
    return read(this.store);
  }

  // إلحاق مدخلات جديدة مع التقليم للحد الأقصى (الأحدث تبقى).
  async appendAll(entries: AuditEntry[]): Promise<void> {
    const current = await read(this.store);
    const merged = [...entries, ...current].slice(0, MAX_ENTRIES);
    await this.write(merged);
  }

  async replaceAll(entries: AuditEntry[]): Promise<void> {
    await this.write(entries.slice(0, MAX_ENTRIES));
  }

  // كتابة كاملة ذرّية.
  private async write(entries: AuditEntry[]): Promise<void> {
    await this.store.setString(STORAGE_KEYS.auditLog, JSON.stringify({ entries }));
  }
}
