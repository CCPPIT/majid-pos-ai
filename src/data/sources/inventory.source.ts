/**
 * مصدر حركات المخزون المحلي الدائم (PHASE 17).
 * يخزّن سجل الحركات (Ledger) ورقمه التسلسلي على الجهاز (Offline-First).
 * اليوم عبر التفضيلات النصية، وغدًا تُستبدل الطبقة بقاعدة بيانات محلية/مزامنة.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { InventoryMovement } from '@/domain/inventory/types';

// واجهة تخزين نصية.
export interface MovementStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// البيانات المحفوظة لحركات المخزون.
interface PersistedMovements {
  movements: InventoryMovement[]; // الحركات (الأحدث أولًا).
  sequence: number; // آخر رقم تسلسلي.
}

// واجهة المصدر.
export interface InventoryMovementsSource {
  list(): Promise<InventoryMovement[]>;
  append(movement: InventoryMovement): Promise<void>;
  nextSequence(): Promise<number>;
}

export class LocalInventoryMovementsSource implements InventoryMovementsSource {
  constructor(private readonly store: MovementStore) {} // نستقبل المخزن.

  // قراءة الحركات المحفوظة (تسامح مع الفساد).
  private async read(): Promise<PersistedMovements> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.inventoryMovements);
      if (!raw) return { movements: [], sequence: 0 };
      const parsed = JSON.parse(raw) as PersistedMovements;
      return { movements: parsed.movements ?? [], sequence: parsed.sequence ?? 0 };
    } catch (error) {
      logger.warn('Failed to parse inventory movements', { error: String(error) });
      return { movements: [], sequence: 0 };
    }
  }

  // كتابة الحركات.
  private async write(data: PersistedMovements): Promise<void> {
    await this.store.setString(STORAGE_KEYS.inventoryMovements, JSON.stringify(data));
  }

  // قائمة كل الحركات (الأحدث أولًا).
  async list(): Promise<InventoryMovement[]> {
    const data = await this.read();
    // فرز تنازلي بزمن الحدوث.
    return [...data.movements].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  // إضافة حركة جديدة في بداية السجل.
  async append(movement: InventoryMovement): Promise<void> {
    const data = await this.read();
    await this.write({ ...data, movements: [movement, ...data.movements] });
  }

  // الرقم التسلسلي التالي (يُحفظ فورًا لضمان التفرّد).
  async nextSequence(): Promise<number> {
    const data = await this.read();
    const next = data.sequence + 1;
    await this.write({ ...data, sequence: next });
    return next;
  }
}
