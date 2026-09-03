/**
 * مصدر سجل المدفوعات (PHASE 14).
 * يخزّن الدفعات محليًا (JSON على الجهاز) — Offline-First؛
 * تُزامن/تُجلب من البوابة/API لاحقًا دون تغيير المستودع.
 */
import { STORAGE_KEYS } from '@/core/config/constants';
import { logger } from '@/core/logging/logger';
import type { Payment } from '@/domain/payments/types';

// واجهة تخزين نصية.
export interface PaymentsStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
}

// واجهة المصدر.
export interface PaymentsSource {
  listPayments(): Promise<Payment[]>;
  appendPayment(payment: Payment): Promise<void>;
}

// مصدر محلي فوق مخزن نصي.
export class LocalPaymentsSource implements PaymentsSource {
  constructor(private readonly store: PaymentsStore) {}

  async listPayments(): Promise<Payment[]> {
    try {
      const raw = await this.store.getString(STORAGE_KEYS.payments);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Payment[];
      // الأحدث أولًا.
      return [...parsed].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch (error) {
      logger.warn('Failed to parse payments', { error: String(error) });
      return [];
    }
  }

  async appendPayment(payment: Payment): Promise<void> {
    const existing = await this.listPayments();
    await this.store.setString(STORAGE_KEYS.payments, JSON.stringify([payment, ...existing]));
  }
}
